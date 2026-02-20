/**
 * FAQPage JSON-LD schemas for caliber pages.
 * Keyed by caliber slug. Each value is a complete FAQPage schema object
 * ready to be injected as a <script type="application/ld+json"> block.
 */
export const faqSchemas: Record<string, object> = {
  '9mm': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are 9mm ammo prices in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'FMJ range ammo runs $0.17–0.25 per round for brass-cased (Blazer Brass, Federal American Eagle, Winchester White Box) and $0.14–0.18/rd for steel-cased. Premium JHP defense loads like Federal HST and Speer Gold Dot run $0.55–1.00/rd. Prices have stabilized since the post-pandemic normalization of 2023–2024.',
        },
      },
      {
        '@type': 'Question',
        name: 'What 9mm ammo should I buy for concealed carry and self-defense?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '124gr JHP loads are the standard for concealed carry. Federal HST 124gr and Speer Gold Dot 124gr are the most common law enforcement duty loads with the deepest real-world performance data at $0.55–0.85/rd. Standard-pressure 147gr loads offer less recoil in compact pistols. Mid-tier options like Sig V-Crown deliver solid terminal performance at $0.50–0.70/rd.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it cheaper to buy 9mm ammo in bulk?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Case quantities of 500–1,000 rounds typically save 10–15% over box pricing, putting bulk FMJ at $0.15–0.20/rd from the best deals. Most retailers offer free shipping at $99–$150, which works out to roughly 500–750 rounds of FMJ — making bulk the clear value play for range ammo.',
        },
      },
      {
        '@type': 'Question',
        name: "What's the difference between 9mm and 9mm +P?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: "9mm +P is loaded to higher chamber pressure (around 10% more velocity) for increased terminal performance. Common in defense loads like Federal HST 124gr +P and Speer Gold Dot 124gr +P. It generates more recoil and isn't recommended for all firearms — check your owner's manual. Standard-pressure 124gr and 147gr JHP loads perform well in modern designs with less felt recoil, especially in compact pistols.",
        },
      },
      {
        '@type': 'Question',
        name: 'What 9mm ammo is best for range and training?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '115gr FMJ is the universal range standard. Blazer Brass, Magtech, Federal American Eagle, and Winchester White Box all perform similarly at typical handgun distances — the price difference between brands is usually just $0.01–0.03/rd. Choose based on price and availability. At these margins, shipping cost matters as much as sticker price. Compare current prices across retailers to find the best deal.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where can I find 9mm ammo in stock right now?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '9mm is the highest-volume handgun caliber in America and is widely available from online retailers. IronScout tracks in-stock 9mm ammo across multiple retailers with daily price updates and availability monitoring. Set up a free price alert to get notified when prices drop or specific products come back in stock.',
        },
      },
    ],
  },

  '556-nato': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are 5.56 NATO ammo prices in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'M193 55gr FMJ runs $0.28–0.38/rd from domestic manufacturers like Federal and Winchester. M855 62gr green tip runs $0.30–0.42/rd. Match-grade loads (77gr Sierra MatchKing) run $0.75–1.50/rd. Bulk 1,000-round cases of M193 can be found for $0.25–0.32/rd with free shipping.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I shoot 5.56 NATO in a .223 Remington chamber?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No — 5.56 NATO is loaded to higher pressures than .223 Remington and can be unsafe in a .223-only chamber. You can safely shoot .223 in a 5.56 chamber. A .223 Wylde chamber handles both safely and accurately. Always check your barrel markings before shooting.',
        },
      },
      {
        '@type': 'Question',
        name: 'What 5.56 ammo should I buy for home defense?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Soft-point and ballistic-tip loads in 55–62gr reduce over-penetration risk compared to FMJ. Hornady V-MAX 55gr, Speer Gold Dot 64gr, and Federal Fusion 62gr are popular choices at $0.60–1.00/rd. Avoid M855 green tip for home defense — its steel penetrator core increases over-penetration risk through interior walls.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it cheaper to buy 5.56 ammo in bulk?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Significantly. Loose-packed 1,000-round cases of M193 run $0.25–0.32/rd versus $0.35–0.45/rd for 20-round boxes. That's 25–35% savings on case quantities. Most retailers offer free shipping on cases, eliminating the cost that often negates small-quantity savings.",
        },
      },
      {
        '@type': 'Question',
        name: "What's the difference between M193 and M855 ammo?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'M193 is a 55gr FMJ at ~3,240 fps — the original military ball load, best for general range use. M855 is a 62gr FMJ with a steel penetrator tip at ~3,020 fps, designed for better penetration at longer ranges. M193 is generally cheaper and more accurate in 1:9 twist barrels; M855 performs better in 1:7 twist. Some indoor ranges ban M855 due to the steel core.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where can I find 5.56 NATO ammo in stock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '5.56 NATO is widely produced by domestic and international manufacturers and is generally in stock at most online retailers. IronScout tracks availability across multiple retailers with daily updates. Set up a free price alert to get notified of price drops and restocks on specific loads.',
        },
      },
    ],
  },

  '308-winchester': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are .308 Winchester ammo prices in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'FMJ/ball ammo runs $0.55–0.80/rd for 147–150gr loads from Federal, Winchester, and PPU. Match-grade loads (168gr Sierra MatchKing, Hornady ELD Match) run $1.00–2.00/rd. Hunting loads like Federal Fusion and Hornady Interlock fall between at $0.90–1.50/rd. Bulk 500-round cases of FMJ can bring costs down to $0.45–0.65/rd.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is .308 Winchester the same as 7.62x51 NATO?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Nearly identical but not exactly the same. .308 Winchester is loaded to slightly higher pressures than 7.62x51 NATO, but the dimensions are the same. In practice, most modern rifles chambered in .308 safely fire 7.62x51 and vice versa. 7.62 NATO surplus ammo is often the cheapest way to shoot .308 at the range.',
        },
      },
      {
        '@type': 'Question',
        name: 'What .308 ammo is best for deer hunting?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '150gr soft-point or bonded-core loads are the most popular choice for whitetail. Federal Fusion 150gr, Hornady InterLock 150gr, and Remington Core-Lokt 150gr are proven performers at $0.90–1.30/rd. For larger game or longer shots, step up to 165–180gr controlled-expansion loads like Nosler Partition or Federal Trophy Bonded at $1.50–2.50/rd.',
        },
      },
      {
        '@type': 'Question',
        name: '.308 Winchester vs 6.5 Creedmoor — which should I choose?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '6.5 Creedmoor shoots flatter and drifts less in wind beyond 500 yards with less recoil. .308 hits harder inside 400 yards, has cheaper ammo, and is available everywhere. For long-range target shooting, 6.5 CM has a ballistic advantage. For hunting, general use, and ammo availability, .308 remains the more versatile choice. .308 FMJ starts at $0.55/rd versus $0.75/rd for 6.5 CM.',
        },
      },
      {
        '@type': 'Question',
        name: 'What .308 ammo should I buy for long-range target shooting?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '168gr and 175gr HPBT match loads are the standard. Federal Gold Medal Match 168gr Sierra MatchKing is the benchmark at $1.20–1.60/rd. Hornady ELD Match 178gr offers excellent ballistic consistency at similar prices. For practice at distance without the match ammo cost, 147gr FMJ at $0.55–0.70/rd is adequate for training fundamentals.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it cheaper to buy .308 in bulk?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Yes. 500-round cases of FMJ run $0.45–0.65/rd versus $0.60–0.85/rd for 20-round boxes — roughly 20–25% savings. .308 is heavy, so shipping costs matter. Look for free shipping thresholds or buy enough to justify flat-rate shipping. Compare case prices across retailers to find the best delivered cost.",
        },
      },
    ],
  },

  '22-lr': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are .22 LR ammo prices in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Bulk .22 LR runs $0.04–0.08/rd for 325–525 round boxes of Federal AutoMatch, CCI Blazer, and Winchester 333. Standard velocity target ammo like CCI Standard Velocity runs $0.07–0.10/rd. Premium match ammo (Eley, SK, Lapua) runs $0.12–0.30/rd. Prices have returned to near pre-pandemic levels.',
        },
      },
      {
        '@type': 'Question',
        name: 'Why is .22 LR ammo sometimes hard to find?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: ".22 LR is the highest-volume cartridge produced worldwide, but demand spikes cause shortages faster than any other caliber because buyers purchase in bulk (500–5,000 rounds at a time). Production has largely caught up since the 2020–2022 shortages, but popular loads like CCI Mini-Mag and Federal AutoMatch still sell out during promotional pricing. Set up in-stock alerts for consistent availability.",
        },
      },
      {
        '@type': 'Question',
        name: 'What .22 LR ammo is most reliable in semi-automatic pistols and rifles?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "High-velocity 36–40gr loads feed most reliably in semi-autos. CCI Mini-Mag 40gr ($0.08–0.12/rd) is the gold standard for reliability. Federal AutoMatch and Winchester Super-X also cycle well. Avoid subsonic and standard-velocity loads in semi-autos unless your firearm is specifically tuned for them — they often don't generate enough blowback to cycle the action.",
        },
      },
      {
        '@type': 'Question',
        name: 'Is .22 LR good for self-defense?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: ".22 LR is not recommended as a primary self-defense caliber due to limited terminal performance and higher failure-to-fire rates compared to centerfire ammo. However, a .22 you can shoot accurately is better than a larger caliber you can't control. If .22 LR is your only option, use high-velocity hollow points like CCI Stinger or CCI Velocitor for maximum energy transfer.",
        },
      },
      {
        '@type': 'Question',
        name: 'Is it cheaper to buy .22 LR in bulk?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Absolutely. Bulk packs of 325–525 rounds run $0.04–0.06/rd, while 50-round boxes of the same ammo cost $0.07–0.10/rd. Buying a 5,000-round case drops the per-round cost even further. At these prices, shipping cost becomes a significant factor — look for free shipping thresholds or buy enough to justify flat-rate shipping.',
        },
      },
      {
        '@type': 'Question',
        name: ".22 LR vs .22 WMR — what's the difference?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: '.22 WMR (Winchester Magnum Rimfire) is a longer, more powerful cartridge than .22 LR with roughly 2x the muzzle energy. .22 WMR runs $0.15–0.30/rd versus $0.04–0.10/rd for .22 LR. The two are not interchangeable — they use different diameter cases. .22 LR is far cheaper for plinking and target shooting; .22 WMR is better suited for small game hunting and varmint control at longer distances.',
        },
      },
    ],
  },

  '45-acp': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are .45 ACP ammo prices in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'FMJ range ammo (230gr ball) runs $0.30–0.45/rd from Federal, Blazer, and Winchester. Premium JHP defense loads like Federal HST 230gr and Speer Gold Dot 230gr run $0.70–1.20/rd. Steel-cased options from Tula and Wolf offer budget range ammo at $0.25–0.32/rd where available.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is .45 ACP better than 9mm for stopping power?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Modern JHP ammunition has largely closed the terminal performance gap. .45 ACP delivers a larger bullet diameter (0.452" vs 0.355") and more energy per round, but 9mm allows higher capacity and faster follow-up shots. FBI testing shows modern 9mm JHP (Federal HST, Speer Gold Dot) meets the same penetration and expansion standards as .45 ACP loads. Most law enforcement has transitioned to 9mm for these reasons.',
        },
      },
      {
        '@type': 'Question',
        name: 'What .45 ACP ammo should I buy for self-defense?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '230gr JHP is the standard defense load weight. Federal HST 230gr ($0.80–1.10/rd) and Speer Gold Dot 230gr ($0.75–1.00/rd) lead the market with the most real-world data. Hornady Critical Duty 220gr +P is optimized for barrier penetration. For lighter recoil, 185gr JHP loads offer faster velocity with slightly less felt recoil in full-size 1911s and polymer frames.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it cheaper to buy .45 ACP in bulk?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. 500-round cases of 230gr FMJ run $0.28–0.38/rd versus $0.35–0.50/rd for 50-round boxes — roughly 15–20% savings. .45 ACP is heavier than 9mm, so shipping costs are higher. Free shipping thresholds typically require $150+ orders, which works out to about 400–500 rounds at current prices.',
        },
      },
      {
        '@type': 'Question',
        name: 'What grain weight .45 ACP should I use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "230gr is the standard weight for both range and defense — it's what .45 ACP was designed around and what most firearms are tuned for. 185gr loads offer faster velocity and slightly less recoil, popular in target shooting. 200gr splits the difference and is common in semi-wadcutter target loads. For defensive use, stick with 230gr JHP from a major manufacturer for the most reliable feeding and terminal performance.",
        },
      },
      {
        '@type': 'Question',
        name: 'Where can I find .45 ACP ammo in stock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '.45 ACP is a mature caliber with stable production from every major domestic manufacturer. Availability is generally good, though specific defense loads can go in and out of stock. IronScout tracks .45 ACP across multiple online retailers with daily price updates. Set up a free alert for your preferred load to get notified of restocks and price drops.',
        },
      },
    ],
  },

  '12-gauge': {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are 12 gauge ammo prices in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Target loads (7.5–8 shot) run $0.25–0.40/rd for Federal Top Gun and Winchester AA. Buckshot (00 buck) runs $0.60–1.20/rd. Slugs run $0.75–2.00/rd depending on type. Premium defense buckshot like Federal FliteControl runs $1.00–1.50/rd. Bulk cases of 250 target shells can drop costs to $0.22–0.30/rd.',
        },
      },
      {
        '@type': 'Question',
        name: "What's the difference between birdshot, buckshot, and slugs?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Birdshot (size 6–9) contains many small pellets for birds and clays — effective to 40 yards, minimal penetration. Buckshot (00, #1, #4) contains fewer large pellets for deer and defense — effective to 25–50 yards with serious terminal energy. Slugs are single projectiles for maximum range and penetration — effective to 100+ yards. For home defense, 00 buckshot is the most common recommendation among professionals.',
        },
      },
      {
        '@type': 'Question',
        name: 'What 12 gauge ammo is best for home defense?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '00 buckshot is the standard. Federal FliteControl 00 buck ($1.00–1.50/rd) produces the tightest patterns at indoor distances due to its rear-opening wad design. Hornady Critical Defense 00 buck and Remington Reduced Recoil 00 buck are also proven options. Reduced-recoil loads deliver adequate terminal performance with significantly less felt recoil, which matters for follow-up shots.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it cheaper to buy 12 gauge shells in bulk?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "For target loads, yes — cases of 250 shells run $0.22–0.30/rd versus $0.30–0.45/rd for 25-round boxes. That's 20–30% savings. Buckshot and slugs are rarely sold in true bulk quantities, so savings are smaller. 12 gauge shells are heavy and bulky — shipping costs are significant, so free shipping thresholds matter more than with handgun ammo.",
        },
      },
      {
        '@type': 'Question',
        name: 'What 12 gauge shells do I need for trap and skeet?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '2¾-inch target loads with 7.5 or 8 shot in 1 oz or 1⅛ oz at 1,145–1,200 fps. Federal Top Gun, Winchester AA, and Remington STS are the most popular. For competition, Winchester AA and Remington STS offer more consistent patterns but cost $0.35–0.50/rd versus $0.25–0.35/rd for promotional target loads. At the volume most clay shooters burn through, the price difference adds up fast.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where can I find 12 gauge ammo in stock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '12 gauge is the most popular shotgun caliber in America with broad availability. Target loads are almost always in stock; specialty defense loads like Federal FliteControl can be harder to find. IronScout tracks 12 gauge availability across multiple retailers with daily updates. Set up a free price alert to catch restocks and deal pricing on specific loads.',
        },
      },
    ],
  },
}
