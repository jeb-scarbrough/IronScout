/**
 * Scraper adapter registry metadata shared across apps.
 */
export declare const KNOWN_ADAPTERS: readonly [{
    readonly id: "sgammo";
    readonly name: "SGAmmo";
    readonly domain: "sgammo.com";
    readonly productPathPattern: "/product/";
}, {
    readonly id: "primaryarms";
    readonly name: "Primary Arms";
    readonly domain: "primaryarms.com";
    readonly productPathPattern: "/product/";
}, {
    readonly id: "midwayusa";
    readonly name: "MidwayUSA";
    readonly domain: "midwayusa.com";
    readonly productPathPattern: "/product/";
}];
export type KnownAdapter = (typeof KNOWN_ADAPTERS)[number];
//# sourceMappingURL=index.d.ts.map