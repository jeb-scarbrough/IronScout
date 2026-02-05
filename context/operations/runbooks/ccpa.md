# CCPA / CPRA Runbook — IronScout v1

**Status:** v1 Operational Runbook
**Applies to:** Consumer product (IronScout)
**Regulation:** California Consumer Privacy Act (CCPA) as amended by CPRA

---

## 1. Purpose

This runbook defines how IronScout complies with CCPA/CPRA in practice.

Goals:

* Meet statutory obligations
* Minimize legal and operational risk
* Preserve user trust
* Avoid over-engineering in v1

This document is operational, not marketing copy.

---

## 2. Applicability Determination

### Current Status (v1)

As of v1, IronScout:

* Has **no revenue**, and
* Does not meet CCPA statutory thresholds for mandatory compliance.

Accordingly, CCPA/CPRA is **not legally triggered at this time**.

### Forward-Looking Position

IronScout intentionally operates as **CCPA-ready by design** because:

* Applicability is triggered immediately upon crossing revenue or data-volume thresholds
* CCPA obligations apply to **previously collected data** once thresholds are met
* Retrofitting compliance after growth creates legal and operational risk

Therefore:

* IronScout follows CCPA-aligned practices voluntarily in v1
* This runbook is enforced as an internal operational standard
* Public posture remains conservative and rights-respecting

This approach minimizes future compliance debt and diligence risk.

---

## 3. Personal Data We Collect (v1)

This section reflects the current Prisma schema and is authoritative for v1.

### Direct Identifiers

* `users.email`
* `users.id` (internal identifier)
* `Account.providerAccountId`
* `Session.sessionToken`

### Authentication & Security Data

* OAuth tokens (`Account.refresh_token`, `access_token`, `id_token`)
* Session expiry timestamps
* Verification tokens (`VerificationToken`)

### User-Generated Data

* Saved items / watchlist records
* Alerts and notification preferences
* Optional user context fields

### Usage & Technical Metadata

* IP address (transient, logs only)
* Device / browser metadata (if captured)
* Timestamps on user actions

### Support & Ops Data

* Support communications linked by email or userId

### Explicitly NOT Collected

* Government-issued identifiers
* Biometric data
* Payment card or bank data (v1)
* Precise geolocation
* Sensitive personal information as defined by CPRA

---

## 4. Data Use Principles

Personal data is used only to:

* Provide core product functionality
* Operate alerts and monitoring
* Secure accounts
* Provide support

IronScout:

* Does **not** sell personal data
* Does **not** use behavioral advertising
* Does **not** perform cross-site tracking
* Does **not** use data brokers

---

## 5. Third-Party Processors (v1)

Examples:

* Authentication provider
* Email delivery service
* Infrastructure / hosting
* Error monitoring

All third parties are treated as **service providers** under CCPA.
Contracts must prohibit secondary data use.

---

## 6. Consumer Rights Supported

IronScout supports the following CCPA/CPRA rights:

* Right to Know (Access)
* Right to Delete
* Right to Correct
* Right to Opt-Out of Sale/Share (non-applicable but honored)
* Right to Non-Discrimination

Requests are handled via the DSAR workflow.

---

## 7. DSAR Handling (Summary)

**Intake Channels**

* [privacy@ironscout.com](mailto:privacy@ironscout.com)
* In-app support

**Timelines**

* Acknowledge: ≤ 10 days
* Fulfill: ≤ 45 days (one extension allowed)

**Verification**

* Authenticated session or email verification

**Execution**

* Manual, logged, repeatable

See `DSAR_SOP.md` for full procedure.

### 7A. DSAR Export Checklist (v1)

Use this checklist for **Right to Know / Access** requests. Export only data tied to the verified user. Provide JSON or CSV.

**Redaction rule:** Do not include secrets that would enable account takeover. If the field is a credential (tokens, API keys, session tokens), either **omit** it or include a **masked** form.

#### Primary subject table

* `users` (required)

  * Include: `id`, `email`, `name`, `image`, `emailVerified`, `tier`, `status`, `createdAt`, `updatedAt`
  * Include if present: `deletionRequestedAt`, `deletionScheduledFor`
  * Exclude: `password` (or export as `passwordPresent: true/false`)

#### Auth tables (credential-bearing)

* `Account` (by `userId`)

  * Include: `provider`, `providerAccountId`, `type`, `expires_at`, `scope`, `token_type`, `session_state`
  * Exclude or mask: `refresh_token`, `access_token`, `id_token`
* `Session` (by `userId`)

  * Include: `id`, `expires`
  * Exclude or mask: `sessionToken`
* `VerificationToken`

  * Not user-scoped by FK; export only if you can confidently associate it to the user email. Prefer **exclude** in v1 unless required.

#### Product monitoring & alerts

* `watchlist_items` (by `userId`, include soft-deleted rows)

  * Include: `id`, `productId`, `collectionId`, `intentType`, `querySnapshot`, `notificationsEnabled`, `priceDropEnabled`, `backInStockEnabled`, `minDropPercent`, `minDropAmount`, cooldown fields, `createdAt`, `updatedAt`, `deletedAt`
* `watchlist_collections` (by `userId`)

  * Include: `id`, `name`, `createdAt`, `updatedAt`
* `alerts` (by `userId`)

  * Include: `id`, `productId`, `watchlistItemId`, `ruleType`, `isEnabled`, `createdAt`, `updatedAt`
  * Include if present: suppression fields (`suppressedAt`, `suppressedBy`, `suppressedReason`)

#### User “Gun Locker” (if enabled)

* `user_guns` (by `userId`)

  * Include: `id`, `caliber`, `nickname`, `imageUrl`, `createdAt`, `updatedAt`
* `firearm_ammo_preferences` (by `userId`, include soft-deleted rows)

  * Include: `id`, `firearmId`, `ammoSkuId`, `useCase`, `createdAt`, `updatedAt`, `deletedAt`, `deleteReason`

#### Reports / feedback

* `product_reports` (where `userId = users.id`)

  * Include: `id`, `productId`, `priceId`, `issueType`, `description`, `status`, `reviewedBy`, `reviewNotes`, `createdAt`, `updatedAt`, `resolvedAt`

#### Subscriptions (legacy / if present)

* `subscriptions` (where `userId = users.id`)

  * Note: consumer billing is not offered in v1, but records may exist.
  * Include: `id`, `type`, `status`, `startDate`, `endDate`, `amount`, `currency`
  * Exclude or mask: `stripeId`

#### Data API subscriptions (if offered)

* `data_subscriptions` (by `userId`)

  * Include: `id`, `plan`, `status`, `rateLimit`, `createdAt`, `updatedAt`
  * Exclude or mask: `apiKey`

#### Query analytics (user-linked)

* `search_query_logs` (where `userId = users.id`)

  * Include: `id`, `queryHash`, `queryLength`, `queryPiiFlag`, `queryNormRedacted`, `lensId`, `intentCalibers`, `resultCount`, `responseTimeMs`, `referrer`, `userAgent`, `gunLockerCalibers`, `createdAt`
* `price_check_query_logs` (where `userId = users.id`)

  * Include: `id`, `caliber`, `pricePerRound`, `classification`, `referrer`, `userAgent`, `gunLockerCalibers`, `createdAt`

#### Event tables (only if you consider them "user-linked" in v1)

* `click_events`

  * Include only if you can reliably associate events to the user (e.g., sessionId ↔ user session). Otherwise treat as operational analytics and **exclude**.
* `pixel_events`

  * Merchant-scoped; generally **not** consumer DSAR scope unless you explicitly link a user identity to it.

**Packaging guidance (what to send back)**

* `user.json` (users)
* `auth.json` (Account, Session)
* `watchlist.json` (watchlist_items, watchlist_collections)
* `alerts.json`
* `gun_locker.json` (user_guns, firearm_ammo_preferences) if applicable
* `reports.json` (product_reports) if any
* `subscriptions.json` (subscriptions, data_subscriptions) if any

**Minimal completeness check**

* Every exported row must be attributable to `users.id` (direct FK) or explicitly justified.
* No exported credential enables login or impersonation.

---

## 8. Deletion & Retention Rules

### Deletion

* User account data is deleted or anonymized on verified request
* Alerts and saved items are removed
* Identifiers are scrubbed

### Query Analytics Anonymization

* `search_query_logs` and `price_check_query_logs`: `userId`, `userAgent`, `referrer`, `gunLockerCalibers` anonymized on account deletion. Rows preserved for aggregate analytics.
* `queryNormRedacted` retained as-is (already PII-redacted at write time).
* Retention: 1 year, then automated purge (implementation deferred).

### Retention Exceptions

Data may be retained if required for:

* Security
* Fraud prevention
* Legal compliance

Any retained data must be minimized and justified.

---

## 9. Opt-Out of Sale / Share

IronScout does not sell or share personal data as defined by CPRA.

Nevertheless:

* Opt-out requests are accepted
* User accounts are flagged
* No ad-tech or sharing behavior is permitted

---

## 10. Audit & Recordkeeping

For each DSAR, retain for 24 months:

* Request details
* Verification method
* Actions taken
* Completion date

Access to DSAR logs is restricted.

---

## 11. Incident Handling

If a privacy-related incident occurs:

1. Escalate immediately to Ops/Legal owner
2. Assess scope and user impact
3. Contain and remediate
4. Notify users and regulators if required

Silence is not an acceptable response.

---

## 12. Ownership & Review

**Owner:** Operations / Legal

**Review cadence:**

* At major product changes
* At data collection changes
* At least annually

---

## Guiding Principle

> CCPA compliance is an operational discipline, not a legal checkbox.

---

## Appendix A — DSAR Access Export Checklist (Schema‑Backed)

Use this checklist when fulfilling **Right to Know / Access** requests. Export in JSON or CSV. Include timestamps and primary keys.

### Core Identity

* `users`

  * `id`, `email`, `emailVerified`, `createdAt`, `updatedAt`

### Authentication (NextAuth)

* `Account`

  * `provider`, `providerAccountId`, `type`, `scope`, `token_type`, `expires_at`, `createdAt`
  * **Exclude** secret values from output where feasible; note presence and purpose.
* `Session`

  * `sessionToken` (redact), `expires`, `createdAt`, `updatedAt`
* `VerificationToken`

  * `identifier`, `expires`, `createdAt`

### User-Generated Content

* Watchlist / Saved Items (all user-owned rows)
* Alerts / Notification preferences (all user-owned rows)

### Usage & Activity (if retained)

* Event records tied to `userId` (names, timestamps, object references)
* Last login / access timestamps
* `search_query_logs` (search query analytics, by `userId`)
* `price_check_query_logs` (price check analytics, by `userId`)

### Support & Communications

* Support tickets or emails linked by `email` or `userId`

### Derived / Exclusions (Document Only)

* Aggregated or anonymized analytics (excluded)
* Operational logs without persistent identity linkage (excluded)

### Third-Party Processors (Disclosure)

* Auth provider (authentication & session management)
* Email service (notifications)
* Infrastructure/hosting (data storage & processing)

### Delivery Notes

* Provide a brief legend explaining tables and purposes
* State any redactions and why
* Confirm completion date and contact for follow-up
