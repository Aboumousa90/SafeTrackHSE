const legacyDraftKey = "safetrack:offline-incident-drafts";
const dbName = "safetrack-offline";
const storeName = "incident-drafts";

export interface OfflineDraft {
  id: string;
  createdAt: string;
  payload: Record<string, string | number | boolean | null | undefined>;
  lastError?: string;
}

function openDraftsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDraftsDb();
  try {
    return await action(db.transaction(storeName, mode).objectStore(storeName));
  } finally {
    db.close();
  }
}

/**
 * One-time migration of drafts queued by the previous localStorage
 * implementation, so nothing already queued on a device is lost.
 */
async function migrateLegacyDrafts() {
  const raw = window.localStorage.getItem(legacyDraftKey);
  if (!raw) return;

  try {
    const legacy = JSON.parse(raw) as OfflineDraft[];
    await withStore("readwrite", async (store) => {
      for (const draft of legacy) {
        await runRequest(store.put(draft));
      }
    });
    window.localStorage.removeItem(legacyDraftKey);
  } catch {
    // Leave the legacy key in place; the next attempt may succeed.
  }
}

function notifyDraftsChanged() {
  window.dispatchEvent(new Event("safetrack:offline-drafts"));
}

export async function queueOfflineDraft(payload: OfflineDraft["payload"]) {
  if (typeof window === "undefined") return;
  const draft: OfflineDraft = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), payload };
  await withStore("readwrite", (store) => runRequest(store.add(draft)));
  notifyDraftsChanged();
}

export async function readOfflineDrafts(): Promise<OfflineDraft[]> {
  if (typeof window === "undefined") return [];
  try {
    await migrateLegacyDrafts();
    return await withStore("readonly", (store) => runRequest(store.getAll() as IDBRequest<OfflineDraft[]>));
  } catch {
    return [];
  }
}

export async function clearOfflineDraft(id: string) {
  if (typeof window === "undefined") return;
  await withStore("readwrite", (store) => runRequest(store.delete(id)));
  notifyDraftsChanged();
}

export async function updateOfflineDraftError(id: string, lastError: string) {
  if (typeof window === "undefined") return;
  await withStore("readwrite", async (store) => {
    const draft = await runRequest(store.get(id) as IDBRequest<OfflineDraft | undefined>);
    if (draft) {
      await runRequest(store.put({ ...draft, lastError }));
    }
  });
  notifyDraftsChanged();
}

export async function syncOfflineDrafts() {
  const drafts = await readOfflineDrafts();
  const results: Array<{ id: string; ok: boolean; referenceNumber?: string; error?: string }> = [];

  for (const draft of drafts) {
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft.payload),
      });
      const result = (await response.json()) as { referenceNumber?: string; error?: string };

      if (!response.ok) {
        const error = result.error ?? "Draft sync failed.";
        await updateOfflineDraftError(draft.id, error);
        results.push({ id: draft.id, ok: false, error });
        continue;
      }

      await clearOfflineDraft(draft.id);
      results.push({ id: draft.id, ok: true, referenceNumber: result.referenceNumber });
    } catch {
      const error = "Network unavailable during sync.";
      await updateOfflineDraftError(draft.id, error);
      results.push({ id: draft.id, ok: false, error });
    }
  }

  return results;
}
