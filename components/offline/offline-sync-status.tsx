"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { readOfflineDrafts, syncOfflineDrafts, type OfflineDraft } from "@/lib/offline/drafts";

export function OfflineSyncStatus() {
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(true);

  const refreshDrafts = useCallback(() => {
    void readOfflineDrafts().then(setDrafts);
  }, []);

  const syncDrafts = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    const queued = await readOfflineDrafts();
    if (queued.length === 0) return;

    setSyncing(true);
    const results = await syncOfflineDrafts();
    refreshDrafts();
    const synced = results.filter((result) => result.ok).length;
    const failed = results.length - synced;
    setMessage(failed > 0 ? `${synced} draft(s) synced, ${failed} still queued.` : `${synced} offline draft(s) synced.`);
    setSyncing(false);
  }, [syncing, refreshDrafts]);

  useEffect(() => {
    refreshDrafts();
    setOnline(navigator.onLine);
    const refresh = () => refreshDrafts();
    const syncWhenOnline = () => {
      setOnline(true);
      void syncDrafts();
    };
    const markOffline = () => setOnline(false);
    window.addEventListener("online", syncWhenOnline);
    window.addEventListener("offline", markOffline);
    window.addEventListener("safetrack:offline-drafts", refresh);
    return () => {
      window.removeEventListener("online", syncWhenOnline);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("safetrack:offline-drafts", refresh);
    };
  }, [syncDrafts, refreshDrafts]);

  if (drafts.length === 0 && !message) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 z-40 rounded-lg border border-amber-200 bg-white p-3 shadow-panel lg:bottom-4 lg:left-auto lg:right-4 lg:w-96">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <WifiOff className="h-4 w-4 text-warning" />
            {t.shell.offlineQueue}
          </div>
          <p className="mt-1 text-sm text-slate-600">{drafts.length} {t.shell.waitingForSync}</p>
          {message ? <p className="mt-1 text-xs font-semibold text-primary">{message}</p> : null}
        </div>
        <Button variant="secondary" disabled={syncing || !online || drafts.length === 0} onClick={() => void syncDrafts()}>
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {t.shell.sync}
        </Button>
      </div>
      {drafts.length > 0 ? (
        <div className="mt-3 space-y-2">
          {drafts.slice(0, 3).map((draft) => (
            <div key={draft.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">{String(draft.payload.title ?? "Incident draft")}</p>
              <p>{new Date(draft.createdAt).toLocaleString()}</p>
              {draft.lastError ? <p className="mt-1 text-red-700">{draft.lastError}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
