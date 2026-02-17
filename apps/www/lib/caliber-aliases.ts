const CALIBER_SLUG_ALIASES: Record<string, string> = {
  '556': '556-nato',
  '308': '308-winchester',
}

export function resolveCaliberSlug(slug: string): string {
  return CALIBER_SLUG_ALIASES[slug] ?? slug
}

export function getCaliberAliasEntries(): Array<[string, string]> {
  return Object.entries(CALIBER_SLUG_ALIASES)
}
