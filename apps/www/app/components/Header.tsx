'use client';

import { MarketingHeader, type MarketingHeaderProps } from '@ironscout/ui/components/marketing-header';
import { BRAND } from '../../lib/brand';

type HeaderProps = Pick<MarketingHeaderProps, 'currentPage'>;

/**
 * Header component for www app.
 * Wraps the shared MarketingHeader with app-specific brand configuration.
 */
export function Header({ currentPage }: HeaderProps) {
  return (
    <MarketingHeader
      currentPage={currentPage}
      websiteUrl={BRAND.wwwUrl}
      appUrl={BRAND.appUrl}
    />
  );
}
