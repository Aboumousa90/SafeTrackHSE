# SafeTrack HSE

SafeTrack is a multi-tenant HSE incident management platform built with Next.js 14, Supabase, Claude AI, PDF exports, Resend email, Web Push, PWA offline support, and NL/EN/FR foundations.

## Development

```bash
pnpm install
pnpm dev --hostname 127.0.0.1 --port 3010
```

Open `http://127.0.0.1:3010/dashboard`.

## Verification

Run static checks and production build:

```bash
pnpm verify
```

Run the route/API smoke suite against a running local server:

```bash
pnpm smoke
```

Override the target URL when needed:

```bash
$env:SAFETRACK_BASE_URL="https://your-preview-url"; pnpm smoke
```

## Production Readiness

Use `/super-admin` or `/api/readiness` to review missing production configuration, including Supabase, Anthropic, Resend, Web Push VAPID keys, RLS migration status, PWA readiness, and reporting templates.
