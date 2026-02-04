# Error Pages Strategy

This document describes the **branded error page strategy** across IronScout apps.
The goal is to provide clear, conservative guidance without implying guarantees.

---

## Principles

- Keep language factual and non-prescriptive.
- Offer safe next steps (retry, sign in, return home).
- Provide a support contact when the user is blocked.
- Avoid claims of guarantees or SLAs.

---

## Consumer Web (`apps/web`)

### Global Error
- `apps/web/app/error.tsx`
- Used for unhandled runtime errors (500-class).
- Includes retry and support guidance with an optional error ID.

### Not Found
- `apps/web/app/not-found.tsx`
- Used for 404 routes.

### Auth Errors
- `apps/web/app/auth/error/page.tsx`
- NextAuth routes send errors here via `pages.error`.
- Handles `AccessDenied`, `OAuthAccountNotLinked`, `Configuration`, `Verification`.

### Status Pages
- `apps/web/app/status/[code]/page.tsx`
- Branded pages for common HTTP statuses:
  - 401, 403, 404, 429, 500, 501, 502, 503
- Use for explicit redirects from routes or error handlers.

---

## Admin Portal (`apps/admin`)

### Global Error
- `apps/admin/app/error.tsx`

### Not Found
- `apps/admin/app/not-found.tsx`

### Auth Errors
- `apps/admin/app/auth/error/page.tsx`
- NextAuth already points to `/auth/error`.

### Status Pages
- `apps/admin/app/status/[code]/page.tsx`
- Same code set as web (401, 403, 404, 429, 500, 501, 503).

---

## Merchant Portal (`apps/merchant`)

### Global Error
- `apps/merchant/app/error.tsx`

### Not Found
- `apps/merchant/app/not-found.tsx`

### Auth Errors
- `apps/merchant/app/(auth)/error/page.tsx`
- Used for auth-related failures in the merchant portal.

### Status Pages
- `apps/merchant/app/status/[code]/page.tsx`

---

## Marketing Site (`apps/www`)

### Global Error
- `apps/www/app/error.tsx`

### Not Found
- `apps/www/app/not-found.tsx`

### Status Pages
- `apps/www/app/status/[code]/page.tsx`

---

## Support Contact

All branded error pages may include:
- `support@ironscout.ai` (mailto link)

This is a support channel, not a guarantee of response time.

---

## When to Use Status Pages

Use `/status/[code]` when:
- A known failure mode should route the user to a branded page.
- You want consistent UX for 401/403/404/429/5xx errors.

Do **not** expose internal error details. If available, include an error ID only.
