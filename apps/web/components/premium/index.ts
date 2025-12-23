// Premium feature components

// Badges for displaying performance characteristics
// Note: BestValueBadge removed from exports per ADR-006 (no deal scores/value judgments)
export {
  PerformanceBadges,
  BulletTypeBadge,
  PressureRatingBadge,
} from './performance-badges'

// Price verdict - everyone gets conclusion, premium gets reasoning
export { PriceVerdict, InlineVerdict } from './price-verdict'

// Premium filters panel
export { PremiumFilters } from './premium-filters'

// AI explanation banner
export { AIExplanationBanner } from './ai-explanation-banner'

// Upgrade banner (existing)
export { UpgradeBanner } from './upgrade-banner'
