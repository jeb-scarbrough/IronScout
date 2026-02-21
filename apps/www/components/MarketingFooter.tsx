import Link from 'next/link'

export function MarketingFooter() {
  return (
    <footer className="border-t border-iron-800 mt-16">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Browse by caliber — SEO internal links */}
        <div className="mb-8 pb-8 border-b border-iron-800/50">
          <p className="text-xs text-iron-500 uppercase tracking-wider font-semibold mb-4">
            Browse Ammo Prices
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-iron-500">
            <Link href="/calibers" className="hover:text-iron-300 transition-colors">
              All Calibers
            </Link>
            <Link href="/brands" className="hover:text-iron-300 transition-colors">
              Brands
            </Link>
            <Link href="/ammo/handgun" className="hover:text-iron-300 transition-colors">
              Handgun
            </Link>
            <Link href="/ammo/rifle" className="hover:text-iron-300 transition-colors">
              Rifle
            </Link>
            <Link href="/ammo/rimfire" className="hover:text-iron-300 transition-colors">
              Rimfire
            </Link>
            <Link href="/ammo/shotgun" className="hover:text-iron-300 transition-colors">
              Shotgun
            </Link>
            <span className="text-iron-700">|</span>
            <Link href="/caliber/9mm" className="hover:text-iron-300 transition-colors">
              9mm
            </Link>
            <Link href="/caliber/556-nato" className="hover:text-iron-300 transition-colors">
              5.56 NATO
            </Link>
            <Link href="/caliber/308-winchester" className="hover:text-iron-300 transition-colors">
              .308 Win
            </Link>
            <Link href="/caliber/22-lr" className="hover:text-iron-300 transition-colors">
              .22 LR
            </Link>
            <Link href="/caliber/45-acp" className="hover:text-iron-300 transition-colors">
              .45 ACP
            </Link>
            <Link href="/caliber/12-gauge" className="hover:text-iron-300 transition-colors">
              12 Gauge
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-iron-500">
          <Link href="/" className="hover:text-iron-300 transition-colors">
            Home
          </Link>
          <Link href="/about" className="hover:text-iron-300 transition-colors">
            About
          </Link>
          <Link href="/retailers" className="hover:text-iron-300 transition-colors">
            Retailers
          </Link>
          <Link href="/privacy" className="hover:text-iron-300 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-iron-300 transition-colors">
            Terms of Service
          </Link>
        </div>
        <p className="text-iron-600 text-sm mt-4">
          &copy; {new Date().getFullYear()} IronScout. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
