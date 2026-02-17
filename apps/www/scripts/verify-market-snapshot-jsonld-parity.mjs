import fs from 'node:fs/promises'
import process from 'node:process'
import {
  DEFAULT_TOLERANCE,
  collectExpectedSnapshotRoutes,
  extractDatasetJsonLdFromScripts,
  extractScriptTags,
  findJsonLdScripts,
  findMissingHtmlRoutes,
  printGateResult,
  readJsonFile,
  toRelativePath,
} from './lib/snapshot-parity-utils.mjs'

const GATE = 'B'

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

function compareNumeric(expected, actual) {
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

async function main() {
  const rootDir = process.cwd()
  const expectedRoutes = await collectExpectedSnapshotRoutes(rootDir)
  const missingRoutes = await findMissingHtmlRoutes(expectedRoutes)

  const errors = missingRoutes.map((routeInfo) => ({
    gate: GATE,
    slug: routeInfo.slug,
    route: routeInfo.route,
    routeType: routeInfo.routeType,
    artifactPath: toRelativePath(rootDir, routeInfo.artifactPath),
    reason: 'Missing static export HTML for expected route',
    htmlPath: toRelativePath(rootDir, routeInfo.htmlPath),
  }))

  let checked = 0

  for (const routeInfo of expectedRoutes) {
    if (missingRoutes.some((missing) => missing.route === routeInfo.route)) {
      continue
    }

    checked += 1
    const relativeHtmlPath = toRelativePath(rootDir, routeInfo.htmlPath)
    const relativeArtifactPath = toRelativePath(rootDir, routeInfo.artifactPath)

    let artifact
    try {
      // eslint-disable-next-line no-await-in-loop
      artifact = await readJsonFile(routeInfo.artifactPath)
    } catch (error) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactPath: relativeArtifactPath,
        reason: 'Artifact JSON is missing or invalid',
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    let html
    try {
      // eslint-disable-next-line no-await-in-loop
      html = await fs.readFile(routeInfo.htmlPath, 'utf8')
    } catch (error) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactPath: relativeArtifactPath,
        htmlPath: relativeHtmlPath,
        reason: 'Static export HTML could not be read',
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    const scripts = extractScriptTags(html)
    const jsonLdScripts = findJsonLdScripts(scripts)
    const dataset = extractDatasetJsonLdFromScripts(jsonLdScripts)
    if (!dataset) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactPath: relativeArtifactPath,
        htmlPath: relativeHtmlPath,
        reason: 'Dataset JSON-LD block is missing',
      })
      continue
    }

    const mappingMismatches = []
    const expectedTemporalCoverage = `P${artifact.json.windowDays}D`

    if ((dataset.dateModified ?? null) !== (artifact.json.computedAt ?? null)) {
      mappingMismatches.push({
        field: 'dateModified',
        expected: artifact.json.computedAt ?? null,
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

    if ((dataset.measurementTechnique ?? null) !== (artifact.json.methodology?.measurementTechnique ?? null)) {
      mappingMismatches.push({
        field: 'measurementTechnique',
        expected: artifact.json.methodology?.measurementTechnique ?? null,
        actual: dataset.measurementTechnique ?? null,
      })
    }

    const additionalProperty = buildAdditionalPropertyMap(dataset)
    const numericMismatches = []
    for (const [name, getter] of Object.entries(NUMERIC_PROPERTY_MAP)) {
      const expectedValue = getter(artifact.json)
      const actualValue = additionalProperty[name]
      const mismatch = compareNumeric(expectedValue, actualValue)
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
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactPath: relativeArtifactPath,
        htmlPath: relativeHtmlPath,
        tolerance: DEFAULT_TOLERANCE,
        mappingMismatches,
        numericMismatches,
      })
    }
  }

  printGateResult(GATE, checked, errors)
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
