"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-warning px-4 py-2 text-center text-sm font-bold text-slate-950">
      {t.shell.offline}
    </div>
  );
}
