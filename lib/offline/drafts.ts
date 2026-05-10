const draftKey = "safetrack:offline-incident-drafts";

export interface OfflineDraft {
  id: string;
  createdAt: string;
  payload: Record<string, string | number | boolean | null | undefined>;
  lastError?: string;
}

export function queueOfflineDraft(payload: OfflineDraft["payload"]) {
  if (typeof window === "undefined") return;
  const existing = readOfflineDrafts();
  const draft: OfflineDraft = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), payload };
  window.localStorage.setItem(draftKey, JSON.stringify([...existing, draft]));
  window.dispatchEvent(new Event("safetrack:offline-drafts"));
}

export function readOfflineDrafts(): OfflineDraft[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(draftKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineDraft[];
  } catch {
    return [];
  }
}

export function clearOfflineDraft(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(draftKey, JSON.stringify(readOfflineDrafts().filter((draft) => draft.id !== id)));
  window.dispatchEvent(new Event("safetrack:offline-drafts"));
}

export function updateOfflineDraftError(id: string, lastError: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(draftKey, JSON.stringify(readOfflineDrafts().map((draft) => (draft.id === id ? { ...draft, lastError } : draft))));
  window.dispatchEvent(new Event("safetrack:offline-drafts"));
}

export async function syncOfflineDrafts() {
  const drafts = readOfflineDrafts();
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
        updateOfflineDraftError(draft.id, error);
        results.push({ id: draft.id, ok: false, error });
        continue;
      }

      clearOfflineDraft(draft.id);
      results.push({ id: draft.id, ok: true, referenceNumber: result.referenceNumber });
    } catch {
      const error = "Network unavailable during sync.";
      updateOfflineDraftError(draft.id, error);
      results.push({ id: draft.id, ok: false, error });
    }
  }

  return results;
}
