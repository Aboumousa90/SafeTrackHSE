"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  Gauge,
  Home,
  ListChecks,
  PlusCircle,
  Settings,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { OfflineSyncStatus } from "@/components/offline/offline-sync-status";
import { PushSubscriptionControl } from "@/components/push/push-subscription-control";
import { localeNames } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/types";
import type { Company, TenantUser } from "@/lib/types";

const nav = [
  { href: "/dashboard", label: "dashboard", icon: Home },
  { href: "/incidents", label: "incidents", icon: Siren },
  { href: "/incidents/new", label: "newIncident", icon: PlusCircle },
  { href: "/analysis", label: "analysis", icon: ShieldCheck },
  { href: "/measures", label: "measures", icon: ListChecks },
  { href: "/proactive", label: "proactive", icon: ClipboardCheck },
  { href: "/observation-rounds", label: "rounds", icon: Gauge },
  { href: "/analytics", label: "analytics", icon: BarChart3 },
  { href: "/reports", label: "reports", icon: FileText },
  { href: "/settings", label: "settings", icon: Settings },
  { href: "/super-admin", label: "platformAdmin", icon: Building2 },
] as const;

const locales: Locale[] = ["nl", "en", "fr"];

export function AppShell({ children, company, user }: { children: React.ReactNode; company: Company; user: TenantUser }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <OfflineBanner />
      <OfflineSyncStatus />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-[#102A3A] text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading text-xl font-bold">SafeTrack</p>
            <p className="text-xs text-white/60">{t.shell.commandCenter}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white", active && "bg-white text-[#102A3A] hover:bg-white hover:text-[#102A3A]")}
              >
                <Icon className="h-4 w-4" />
                {t.nav[item.label]}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-white/70">
          <p className="font-semibold text-white">{company.name}</p>
          <p>{company.subscriptionPlan} plan</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t.shell.tenantWorkspace}</p>
            <h1 className="font-heading text-lg font-bold">{company.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Language"
              className="hidden h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 md:block"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              {locales.map((item) => (
                <option key={item} value={item}>
                  {localeNames[item]}
                </option>
              ))}
            </select>
            <PushSubscriptionControl />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user.fullName}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-semibold text-slate-600">
              <Icon className="h-4 w-4" />
              {t.nav[item.label]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
