import process from 'node:process'
import {
  DEFAULT_DIFF_LIMIT,
  DEFAULT_TOLERANCE,
  buildKeyFieldMismatches,
  collectExpectedSnapshotRoutes,
  diffJson,
  extractDatasetJsonLdFromScripts,
  extractScriptTags,
  findJsonLdScripts,
  findScriptByIdAndType,
  printGateResult,
  sha256,
  stableStringify,
} from './lib/snapshot-parity-utils.mjs'

const GATE = 'CANARY'
const DEFAULT_BASE_URL = 'https://www.ironscout.ai'
const CANARY_ALLOW_TIMESTAMP_DRIFT =
  (process.env.MARKET_SNAPSHOT_CANARY_ALLOW_TIMESTAMP_DRIFT ?? 'true').toLowerCase() !== 'false'
const ALLOW_MISSING_PROD_ARTIFACTS =
  (process.env.ALLOW_MISSING_PROD_ARTIFACTS ?? '').toLowerCase() === '1'
  || (process.env.ALLOW_MISSING_PROD_ARTIFACTS ?? '').toLowerCase() === 'true'

const NUMERIC_PROPERTY_MAP = {
  medianPricePerRound: (artifact) => artifact.pricePerRound?.median,
  p25PricePerRound: (artifact) => artifact.pricePerRound?.p25,
  p75PricePerRound: (artifact) => artifact.pricePerRound?.p75,
  minPricePerRound: (artifact) => artifact.pricePerRound?.min,
  maxPricePerRound: (artifact) => artifact.pricePerRound?.max,
  sampleCount: (artifact) => artifact.counts?.sampleCount,
  daysWithData: (artifact) => artifact.counts?.daysWithData,
  productCount: (artifact) => artifact.counts?.productCount,
  retailerCount: (artifact) => artifact.counts?.retailerCount,
}

function buildIndexArtifactHashMap(indexPayload) {
  const map = new Map()
  const artifacts = Array.isArray(indexPayload?.artifacts) ? indexPayload.artifacts : []
  for (const entry of artifacts) {
    if (!entry || typeof entry !== 'object') continue
    if (typeof entry.caliberSlug !== 'string') continue
    if (typeof entry.artifactSha256 !== 'string' || entry.artifactSha256.length === 0) continue
    map.set(entry.caliberSlug, entry.artifactSha256)
  }
  return map
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null) return []
  return [value]
}

function buildAdditionalPropertyMap(dataset) {
  const out = {}
  for (const entry of asArray(dataset?.additionalProperty)) {
    if (!entry || typeof entry !== 'object') continue
    if (typeof entry.name !== 'string') continue
    out[entry.name] = entry.value
  }
  return out
}

function parseFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function numericMismatch(expected, actual) {
  if (expected === null) {
    return actual === undefined || actual === null
      ? null
      : { expected, actual, delta: null }
  }
  const expectedNumber = parseFiniteNumber(expected)
  const actualNumber = parseFiniteNumber(actual)
  if (expectedNumber === null || actualNumber === null) {
    return { expected, actual, delta: null }
  }
  const delta = Math.abs(expectedNumber - actualNumber)
  if (delta > DEFAULT_TOLERANCE) {
    return { expected: expectedNumber, actual: actualNumber, delta }
  }
  return null
}

function hasOnlyTimestampDiffs(keyMismatches, diffs) {
  const allowedFields = new Set(['computedAt', 'windowStart', 'windowEnd'])
  const allowedPointers = new Set(['/computedAt', '/windowStart', '/windowEnd'])
  if (diffs.length === 0 && keyMismatches.length === 0) return false

  for (const mismatch of keyMismatches) {
    if (!allowedFields.has(mismatch.field)) return false
  }
  for (const diff of diffs) {
    if (!allowedPointers.has(diff.pointer)) return false
  }
  return true
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching ${url}`)
  }
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { accept: 'text/html' } })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching ${url}`)
  }
  return response.text()
}

async function main() {
  const rootDir = process.cwd()
  const baseUrl = (process.env.MARKET_SNAPSHOT_CANARY_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const indexUrl = `${baseUrl}/market-snapshots/30d/index.json`
  const expectedRoutes = await collectExpectedSnapshotRoutes(rootDir)
  const errors = []
  const warnings = []
  const artifactBySlug = new Map()
  const slugArtifactFailure = new Set()
  const blockedArtifacts = []
  let indexArtifactHashBySlug = new Map()

  try {
    const indexPayload = await fetchJson(indexUrl)
    indexArtifactHashBySlug = buildIndexArtifactHashMap(indexPayload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isNotPublished404 = message.includes('HTTP 404')
    if (ALLOW_MISSING_PROD_ARTIFACTS && isNotPublished404) {
      blockedArtifacts.push({
        slug: 'index',
        artifactUrl: indexUrl,
        reason: 'Snapshot index is not yet published in production (HTTP 404)',
      })
    } else {
      errors.push({
        gate: GATE,
        reason: 'Failed to fetch production snapshot index',
        indexUrl,
        message,
      })
    }
  }

  let checked = 0

  for (const routeInfo of expectedRoutes) {
    checked += 1
    const routeUrl = `${baseUrl}${routeInfo.route}`
    const artifactUrl = `${baseUrl}/market-snapshots/30d/${routeInfo.slug}.json`

    let artifact = artifactBySlug.get(routeInfo.slug) ?? null
    if (!artifact) {
      try {
        // eslint-disable-next-line no-await-in-loop
        artifact = await fetchJson(artifactUrl)
        artifactBySlug.set(routeInfo.slug, artifact)
      } catch (error) {
        if (!slugArtifactFailure.has(routeInfo.slug)) {
          slugArtifactFailure.add(routeInfo.slug)
          const message = error instanceof Error ? error.message : String(error)
          const isNotPublished404 = message.includes('HTTP 404')
          if (ALLOW_MISSING_PROD_ARTIFACTS && isNotPublished404) {
            blockedArtifacts.push({
              slug: routeInfo.slug,
              artifactUrl,
              reason: 'Artifact not yet published in production (HTTP 404)',
            })
          } else {
            errors.push({
              gate: GATE,
              slug: routeInfo.slug,
              route: routeInfo.route,
              routeType: routeInfo.routeType,
              artifactUrl,
              routeUrl,
              reason: 'Failed to fetch production artifact JSON',
              message,
            })
          }
        }
        continue
      }
    }
    const artifactCanonicalSha256 = sha256(stableStringify(artifact))
    const indexArtifactSha256 = indexArtifactHashBySlug.get(routeInfo.slug) ?? null
    if (indexArtifactHashBySlug.size > 0 && indexArtifactSha256 === null) {
      errors.push({
        gate: GATE,
        check: 'Index->Artifact',
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        indexUrl,
        reason: 'Snapshot slug is missing from production index.json',
      })
      continue
    }
    if (typeof indexArtifactSha256 === 'string' && indexArtifactSha256 !== artifactCanonicalSha256) {
      errors.push({
        gate: GATE,
        check: 'Index->Artifact',
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        indexUrl,
        expectedArtifactSha256: indexArtifactSha256,
        actualArtifactSha256: artifactCanonicalSha256,
        reason: 'Artifact hash does not match index artifactSha256',
      })
      continue
    }

    let html
    try {
      // eslint-disable-next-line no-await-in-loop
      html = await fetchText(routeUrl)
    } catch (error) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        reason: 'Failed to fetch production route HTML',
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    const scripts = extractScriptTags(html)
    const snapshotScript = findScriptByIdAndType(
      scripts,
      `market-snapshot-${routeInfo.slug}`,
      'application/json'
    )

    if (!snapshotScript) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        reason: 'Embedded snapshot JSON script missing in production HTML',
      })
      continue
    }

    let embedded
    try {
      embedded = JSON.parse(snapshotScript.content)
    } catch (error) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        reason: 'Embedded snapshot JSON parse failed in production HTML',
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }
    const embeddedCanonicalSha256 = sha256(stableStringify(embedded))
    const declaredEmbeddedSha256 = snapshotScript.attributes['data-artifact-sha256'] ?? null
    const declaredHashMismatch =
      typeof declaredEmbeddedSha256 === 'string'
      && declaredEmbeddedSha256.length > 0
      && declaredEmbeddedSha256 !== embeddedCanonicalSha256
    const embedArtifactHashMismatch = embeddedCanonicalSha256 !== artifactCanonicalSha256
    const declaredArtifactHashMismatch =
      typeof declaredEmbeddedSha256 === 'string'
      && declaredEmbeddedSha256.length > 0
      && declaredEmbeddedSha256 !== artifactCanonicalSha256

    if (declaredHashMismatch) {
      errors.push({
        gate: GATE,
        check: 'EmbedDeclaredHash->EmbedPayload',
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        declaredEmbeddedSha256,
        embeddedCanonicalSha256,
        reason: 'Embedded declared artifact hash does not match embedded payload hash',
      })
      continue
    }

    if (embedArtifactHashMismatch || declaredArtifactHashMismatch) {
      const keyMismatches = buildKeyFieldMismatches(artifact, embedded, [
        'computedAt',
        'windowStart',
        'windowEnd',
        'schemaVersion',
        'caliberSlug',
      ])
      const diffs = diffJson(artifact, embedded, {
        tolerance: DEFAULT_TOLERANCE,
        limit: DEFAULT_DIFF_LIMIT,
      })

      const mismatchPayload = {
        gate: GATE,
        check: 'Artifact->Embed',
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        tolerance: DEFAULT_TOLERANCE,
        indexArtifactSha256,
        declaredEmbeddedSha256,
        keyMismatches,
        diffs,
        embeddedCanonicalSha256,
        artifactCanonicalSha256,
      }

      if (CANARY_ALLOW_TIMESTAMP_DRIFT && hasOnlyTimestampDiffs(keyMismatches, diffs)) {
        warnings.push({ ...mismatchPayload, reason: 'Timestamp-only mismatch accepted by canary grace mode' })
      } else {
        errors.push(mismatchPayload)
      }
    }

    const dataset = extractDatasetJsonLdFromScripts(findJsonLdScripts(scripts))
    if (!dataset) {
      errors.push({
        gate: GATE,
        check: 'Artifact->JSON-LD',
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        reason: 'Dataset JSON-LD missing in production HTML',
      })
      continue
    }

    const mappingMismatches = []
    const expectedTemporalCoverage = `P${artifact.windowDays}D`
    if ((dataset.dateModified ?? null) !== (artifact.computedAt ?? null)) {
      mappingMismatches.push({
        field: 'dateModified',
        expected: artifact.computedAt ?? null,
        actual: dataset.dateModified ?? null,
      })
    }
    if ((dataset.temporalCoverage ?? null) !== expectedTemporalCoverage) {
      mappingMismatches.push({
        field: 'temporalCoverage',
        expected: expectedTemporalCoverage,
        actual: dataset.temporalCoverage ?? null,
      })
    }
    if ((dataset.measurementTechnique ?? null) !== (artifact.methodology?.measurementTechnique ?? null)) {
      mappingMismatches.push({
        field: 'measurementTechnique',
        expected: artifact.methodology?.measurementTechnique ?? null,
        actual: dataset.measurementTechnique ?? null,
      })
    }

    const additionalProperty = buildAdditionalPropertyMap(dataset)
    const numericMismatches = []
    for (const [name, getter] of Object.entries(NUMERIC_PROPERTY_MAP)) {
      const expectedValue = getter(artifact)
      const actualValue = additionalProperty[name]
      const mismatch = numericMismatch(expectedValue, actualValue)
      if (mismatch) {
        numericMismatches.push({
          key: name,
          expected: mismatch.expected,
          actual: mismatch.actual,
          delta: mismatch.delta,
        })
      }
    }

    if (mappingMismatches.length > 0 || numericMismatches.length > 0) {
      const mismatchPayload = {
        gate: GATE,
        check: 'Artifact->JSON-LD',
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactUrl,
        routeUrl,
        tolerance: DEFAULT_TOLERANCE,
        mappingMismatches,
        numericMismatches,
      }

      const onlyDateModifiedMismatch =
        mappingMismatches.length > 0
        && mappingMismatches.every((entry) => entry.field === 'dateModified')
        && numericMismatches.length === 0

      if (CANARY_ALLOW_TIMESTAMP_DRIFT && onlyDateModifiedMismatch) {
        warnings.push({ ...mismatchPayload, reason: 'dateModified-only mismatch accepted by canary grace mode' })
      } else {
        errors.push(mismatchPayload)
      }
    }
  }

  if (ALLOW_MISSING_PROD_ARTIFACTS && blockedArtifacts.length > 0) {
    warnings.push({
      gate: GATE,
      status: 'CANARY_BLOCKED_ARTIFACTS_NOT_PUBLISHED',
      blockedArtifactCount: blockedArtifacts.length,
      blockedArtifacts,
    })
  }

  if (errors.length === 0 && ALLOW_MISSING_PROD_ARTIFACTS && blockedArtifacts.length > 0) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          gate: GATE,
          status: 'CANARY_BLOCKED_ARTIFACTS_NOT_PUBLISHED',
          checked,
          blockedArtifactCount: blockedArtifacts.length,
          blockedArtifacts,
          warningCount: warnings.length,
          warnings,
        },
        null,
        2
      )
    )
    process.exit(0)
  }

  printGateResult(GATE, checked, errors, warnings)
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        gate: GATE,
        fatal: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  )
  process.exit(1)
})
