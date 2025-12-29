# Pricing and Tiers

This document defines IronScout’s pricing philosophy and tier boundaries.

It describes **what additional automation a user may pay for**, not additional certainty, authority, or guarantees.

---

## Pricing Philosophy

IronScout does not sell predictions, recommendations, or “best deals.”

We provide:
- Access to market context
- Monitoring over time
- Signals when something meaningfully changes

Paid tiers improve **automation and timing**, not judgment or outcomes.

---

## Free Tier

The Free tier allows users to explore prices and monitor items manually.

### Included

- Full access to search across retailers
- Current prices and availability
- Limited historical context
- Dashboard visibility into standout deals when they exist
- **Limited alerts for explicitly saved items only**

Alerts in the Free tier:
- Are rare and interruption-worthy
- Apply only to items the user has explicitly saved
- Are subject to strict caps

Saved Searches do not trigger alerts in the Free tier.

---

## Premium Tier

Premium exists for users who want IronScout to **watch the market on their behalf** and notify them sooner.

### Included

- Faster detection of price and availability changes
- Automated alerts for explicitly saved items
- Priority alert delivery within global caps
- Reduced chance of missing time-sensitive moments

Premium improves **speed and automation**, not alert volume, urgency, or scope.

Premium does not:
- Increase the number of alerts sent
- Lower alert thresholds
- Expand alerts to Saved Searches in v1
- Introduce predictions or recommendations

---

## Alert Scope and Limits

Alert behavior for all tiers is governed by:

- `context/operations/alerts_policy_v1.md`

This includes:
- Which events are alert-eligible
- Cooldowns and caps
- Explicitly disallowed alert types

Pricing tiers must not override alert policy.

---

## What IronScout Does Not Sell

Regardless of tier, IronScout does not provide:
- Guarantees
- Purchase recommendations
- Deal scores or rankings
- Predictive pricing
- Exclusive or hidden inventory

Users remain in control of all buying decisions.

---

## Future Considerations

Expansion of alert scope or automation (e.g., Saved Search alerts) requires:
- Proven signal quality
- Documented thresholds
- An explicit ADR amendment

No tier changes imply future features by default.

---

## Summary

Free gives access.  
Premium saves time.

Neither tier sells certainty.

Trust is the product.
