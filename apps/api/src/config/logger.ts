/**
 * API Logger Configuration
 *
 * Pre-configured loggers for API components
 */

import { createLogger } from '@ironscout/logger'

// Root logger for API service
export const logger = createLogger('api')

// Pre-configured child loggers for common components
export const loggers = {
  server: logger.child('server'),
  auth: logger.child('auth'),
  search: logger.child('search'),
  payments: logger.child('payments'),
  alerts: logger.child('alerts'),
  watchlist: logger.child('watchlist'),
  products: logger.child('products'),
  dashboard: logger.child('dashboard'),
  admin: logger.child('admin'),
  email: logger.child('email'),
  ai: logger.child('ai'),
}
