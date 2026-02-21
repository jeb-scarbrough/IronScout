import type { ScrapePluginManifest, SitePluginRegistration, ScrapeSitePlugin } from './types.js'
import { SITE_PLUGIN_REGISTRATIONS } from './sites/index.js'
import psl from 'psl'

const registrations = new Map<string, SitePluginRegistration>()
const domainOwners = new Map<string, string>()

function registrableDomainForBaseUrl(baseUrl: string): string {
  let host: string
  try {
    host = new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return baseUrl.toLowerCase()
  }

  const registrable = psl.get(host)
  return (registrable ?? host).toLowerCase()
}

function validateManifest(manifest: ScrapePluginManifest): void {
  if (!manifest.id.trim()) {
    throw new Error('Plugin manifest.id is required')
  }
  if (manifest.baseUrls.length === 0) {
    throw new Error(`Plugin '${manifest.id}' must define at least one base URL`)
  }
}

export function registerSitePlugin(registration: SitePluginRegistration): void {
  validateManifest(registration.manifest)

  if (registrations.has(registration.manifest.id)) {
    throw new Error(`Plugin '${registration.manifest.id}' is already registered`)
  }

  for (const baseUrl of registration.manifest.baseUrls) {
    const registrableDomain = registrableDomainForBaseUrl(baseUrl)
    const existingOwner = domainOwners.get(registrableDomain)
    if (existingOwner && existingOwner !== registration.manifest.id) {
      throw new Error(
        `Plugin '${registration.manifest.id}' collides with '${existingOwner}' on registrable domain '${registrableDomain}'`
      )
    }
  }

  for (const baseUrl of registration.manifest.baseUrls) {
    const registrableDomain = registrableDomainForBaseUrl(baseUrl)
    domainOwners.set(registrableDomain, registration.manifest.id)
  }

  registrations.set(registration.manifest.id, registration)
}

for (const registration of SITE_PLUGIN_REGISTRATIONS) {
  registerSitePlugin(registration)
}

export function getRegisteredSitePluginIds(): string[] {
  return [...registrations.keys()].sort((a, b) => a.localeCompare(b))
}

export function getRegisteredSitePluginManifest(siteId: string): ScrapePluginManifest | undefined {
  return registrations.get(siteId)?.manifest
}

export async function loadSitePlugin(siteId: string): Promise<ScrapeSitePlugin | undefined> {
  const registration = registrations.get(siteId)
  if (!registration) {
    return undefined
  }
  return registration.load()
}

export function assertRegistryParity(expectedIds: string[]): {
  ok: boolean
  missingInPluginRegistry: string[]
  unknownPluginIds: string[]
} {
  const knownIds = new Set(expectedIds)
  const pluginIds = new Set(registrations.keys())

  const missingInPluginRegistry = [...knownIds]
    .filter(id => !pluginIds.has(id))
    .sort((a, b) => a.localeCompare(b))

  const unknownPluginIds = [...pluginIds]
    .filter(id => !knownIds.has(id))
    .sort((a, b) => a.localeCompare(b))

  return {
    ok: missingInPluginRegistry.length === 0 && unknownPluginIds.length === 0,
    missingInPluginRegistry,
    unknownPluginIds,
  }
}
