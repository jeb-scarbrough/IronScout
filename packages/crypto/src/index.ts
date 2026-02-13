/**
 * @ironscout/crypto
 *
 * Cryptographic utilities for IronScout.
 * Provides credential encryption and outbound link signing.
 */

export {
  loadCredentialKey,
  validateCredentialKey,
  clearKeyCache,
  encryptSecret,
  decryptSecret,
  buildFeedCredentialAAD,
  encryptFeedPassword,
  decryptFeedPassword,
} from './secrets'

export {
  buildCanonicalPayload,
  computeOutboundSignature,
  verifyOutboundSignature,
} from './outbound-signing'
export type { OutboundPayload } from './outbound-signing'

export { buildOutboundUrl } from './outbound-url'
export type { BuildOutboundUrlOptions } from './outbound-url'
