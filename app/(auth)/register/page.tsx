"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t.auth.onboarding}</CardTitle>
          <p className="text-sm text-slate-500">{t.auth.onboardingDescription}</p>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="font-semibold text-primary">{t.auth.backToSignIn}</Link>
        </CardContent>
      </Card>
    </main>
  );
}
