"use client";

import { WifiOff } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle><WifiOff className="mr-2 inline h-5 w-5" />{t.offline.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>{t.offline.body1}</p>
          <p>{t.offline.body2}</p>
        </CardContent>
      </Card>
    </main>
  );
}
