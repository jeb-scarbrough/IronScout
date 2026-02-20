import type { SitePluginRegistration } from '../types.js'
import { plugin as brownellsPlugin } from './brownells/index.js'

export const SITE_PLUGIN_REGISTRATIONS: SitePluginRegistration[] = [
  { manifest: brownellsPlugin.manifest, load: async () => brownellsPlugin },
  // __SITE_PLUGIN_REGISTRATIONS_INSERT__
]
