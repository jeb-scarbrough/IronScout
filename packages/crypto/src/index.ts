/**
 * @ironscout/crypto
 *
 * Cryptographic utilities for IronScout.
 * Provides credential encryption for affiliate and retailer feeds.
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
