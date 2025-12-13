# IronScout TODO / Feature Backlog

## High Priority

### Dealer Subscription Enforcement
**Status:** Not Started  
**Target:** TBD

Implement subscription-based access control for dealers:

1. **Portal Access Control**
   - Enforce login restrictions based on dealer subscription status
   - If subscription is inactive/expired, restrict access to dealer portal
   - Show appropriate messaging for expired subscriptions (renewal prompt, contact support, etc.)

2. **Feed Ingestion Automation**
   - Skip automatic feed ingestion for dealers with inactive/expired subscriptions
   - Modify `DealerFeedIngest` worker to check subscription status before processing
   - Feeds should remain configured but not processed until subscription is active

3. **Admin Override Capability**
   - Add admin UI to manually trigger feed update for any dealer
   - Bypass subscription check when admin initiates manual feed run
   - Use case: Business decisions to maintain data for strategic dealers
   - Audit log the manual trigger with admin identity and reason

**Implementation Notes:**
- Need to add subscription tracking to Dealer model (or link to Subscription model)
- Consider grace period for recently expired subscriptions
- Email notifications for upcoming/recent expiration

---

### End User Subscription Enforcement
**Status:** Not Started  
**Target:** TBD

Implement subscription-based access control for end users (consumers):

1. **Feature Gating by Tier**
   - Enforce FREE vs PREMIUM feature limits at API level
   - FREE: 3 alerts max, 20 search results, basic AI, daily digest
   - PREMIUM: Unlimited alerts, 100 results, advanced AI, real-time notifications

2. **Expired Premium Handling**
   - Gracefully downgrade expired PREMIUM users to FREE tier
   - Preserve alerts beyond limit but disable excess (re-enable on renewal)
   - Show renewal prompts when accessing premium-only features

3. **Subscription Status Checks**
   - Validate subscription status on login
   - Check Stripe subscription status for active/canceled/past_due
   - Handle payment failures gracefully (grace period before downgrade)

4. **UI/UX for Expired Users**
   - Clear messaging about expired subscription
   - Easy path to renewal
   - Show what features are now restricted

**Implementation Notes:**
- Integrate with existing Stripe subscription handling
- Consider webhook handling for subscription status changes
- Cache subscription status to avoid repeated Stripe API calls

---

## Medium Priority

### Signout Redirect to Main Site
**Status:** Not Started  
**Target:** TBD

On signout from any portal (dealer, admin), redirect user to https://www.ironscout.ai/ instead of staying on subdomain.

- Update dealer portal signout to redirect to main site
- Update admin portal signout to redirect to main site
- Ensure session/cookies are properly cleared across subdomains

---

## Low Priority / Nice-to-Have

*(empty)*

---

## Completed

*(empty)*

---

*Last updated: December 12, 2025*
