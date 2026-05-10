"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useLanguage } from "@/components/i18n/language-provider";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        {searchParams.get("error") === "tenant_profile_missing" ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            {t.auth.missingProfile}
          </p>
        ) : null}
        <LoginForm />
      </div>
    </main>
  );
}
