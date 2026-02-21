/**
 * Scraper adapter registry metadata shared across apps.
 */
export type ScraperPluginMode = 'html' | 'json';
export interface ScraperPluginRateLimit {
    requestsPerSecond?: number;
    minDelayMs?: number;
    maxConcurrent?: number;
}
export interface ScraperRegistryEntry {
    id: string;
    name: string;
    domain: string;
    productPathPattern: string;
    owner: string;
    mode: ScraperPluginMode;
    version: string;
    baseUrls: string[];
    rateLimit?: ScraperPluginRateLimit;
}
export declare const KNOWN_ADAPTERS: readonly [{
    readonly id: "brownells";
    readonly name: "Brownells";
    readonly domain: "brownells.com";
    readonly productPathPattern: "/ammunition/";
    readonly owner: "harvester";
    readonly mode: "html";
    readonly version: "1.0.0";
    readonly baseUrls: ["https://www.brownells.com"];
}, {
    readonly id: "midwayusa";
    readonly name: "MidwayUSA";
    readonly domain: "midwayusa.com";
    readonly productPathPattern: "/product/";
    readonly owner: "harvester";
    readonly mode: "html";
    readonly version: "1.0.0";
    readonly baseUrls: ["https://www.midwayusa.com"];
}, {
    readonly id: "primaryarms";
    readonly name: "Primary Arms";
    readonly domain: "primaryarms.com";
    readonly productPathPattern: "/product/";
    readonly owner: "harvester";
    readonly mode: "json";
    readonly version: "1.0.0";
    readonly baseUrls: ["https://www.primaryarms.com"];
}, {
    readonly id: "sgammo";
    readonly name: "SGAmmo";
    readonly domain: "sgammo.com";
    readonly productPathPattern: "/product/";
    readonly owner: "harvester";
    readonly mode: "html";
    readonly version: "1.0.0";
    readonly baseUrls: ["https://www.sgammo.com"];
    readonly rateLimit: {
        readonly requestsPerSecond: 0.5;
        readonly minDelayMs: 500;
        readonly maxConcurrent: 1;
    };
}];
export type KnownAdapter = (typeof KNOWN_ADAPTERS)[number];
//# sourceMappingURL=index.d.ts.map