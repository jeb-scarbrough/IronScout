export declare const KNOWN_ADAPTERS: readonly [{
  readonly id: "sgammo";
  readonly name: "SGAmmo";
  readonly domain: "sgammo.com";
}, {
  readonly id: "primaryarms";
  readonly name: "Primary Arms";
  readonly domain: "primaryarms.com";
}, {
  readonly id: "midwayusa";
  readonly name: "MidwayUSA";
  readonly domain: "midwayusa.com";
}]
export type KnownAdapter = (typeof KNOWN_ADAPTERS)[number]
