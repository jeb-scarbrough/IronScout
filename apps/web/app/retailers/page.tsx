import { redirect } from 'next/navigation'
import { BRAND } from '@/lib/brand'

/**
 * Retailers marketing page has moved to the www site.
 * Redirect for any old links.
 */
export default function RetailersPage() {
  redirect(`${BRAND.website}/retailers`)
}
