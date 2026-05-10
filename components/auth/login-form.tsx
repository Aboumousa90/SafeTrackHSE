"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ShieldCheck } from "lucide-react";
import { signIn } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";

export function LoginForm() {
  const [state, action] = useFormState(signIn, {});
  const { t } = useLanguage();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <CardTitle>{t.auth.signInTitle}</CardTitle>
        <p className="text-sm text-slate-500">{t.auth.signInDescription}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-2">
            <Label>{t.auth.email}</Label>
            <Input name="email" type="email" autoComplete="email" required placeholder="hse.manager@company.com" />
          </div>
          <div className="grid gap-2">
            <Label>{t.auth.password}</Label>
            <Input name="password" type="password" autoComplete="current-password" required />
          </div>
          {state.error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
          <SubmitButton signingIn={t.auth.signingIn} signInLabel={t.auth.signIn} />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton({ signingIn, signInLabel }: { signingIn: string; signInLabel: string }) {
  const status = useFormStatus();
  return <Button className="w-full" disabled={status.pending}>{status.pending ? signingIn : signInLabel}</Button>;
}
