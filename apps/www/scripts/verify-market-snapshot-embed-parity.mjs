import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  DEFAULT_DIFF_LIMIT,
  DEFAULT_TOLERANCE,
  buildKeyFieldMismatches,
  collectExpectedSnapshotRoutes,
  diffJson,
  extractScriptTags,
  findMissingHtmlRoutes,
  findScriptByIdAndType,
  printGateResult,
  readJsonFile,
  sha256,
  stableStringify,
  toRelativePath,
} from './lib/snapshot-parity-utils.mjs'

const GATE = 'A'

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
    const htmlPath = routeInfo.htmlPath
    const artifactPath = routeInfo.artifactPath
    const relativeHtmlPath = toRelativePath(rootDir, htmlPath)
    const relativeArtifactPath = toRelativePath(rootDir, artifactPath)

    let artifact
    try {
      // eslint-disable-next-line no-await-in-loop
      artifact = await readJsonFile(artifactPath)
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
      html = await fs.readFile(htmlPath, 'utf8')
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
    const scriptId = `market-snapshot-${routeInfo.slug}`
    const embedScript = findScriptByIdAndType(scripts, scriptId, 'application/json')
    if (!embedScript) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactPath: relativeArtifactPath,
        htmlPath: relativeHtmlPath,
        reason: `Embedded snapshot script is missing (id="${scriptId}")`,
      })
      continue
    }

    let embeddedSnapshot
    try {
      embeddedSnapshot = JSON.parse(embedScript.content)
    } catch (error) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactPath: relativeArtifactPath,
        htmlPath: relativeHtmlPath,
        reason: 'Embedded snapshot JSON is not parseable',
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }

    const keyMismatches = buildKeyFieldMismatches(artifact.json, embeddedSnapshot, [
      'computedAt',
      'windowStart',
      'windowEnd',
      'schemaVersion',
      'caliberSlug',
    ])
    const artifactCanonicalSha256 = sha256(stableStringify(artifact.json))
    const embeddedCanonicalSha256 = sha256(stableStringify(embeddedSnapshot))
    const declaredEmbeddedSha256 = embedScript.attributes['data-artifact-sha256'] ?? null
    const declaredHashMismatch =
      typeof declaredEmbeddedSha256 === 'string'
      && declaredEmbeddedSha256.length > 0
      && declaredEmbeddedSha256 !== embeddedCanonicalSha256

    if (!declaredHashMismatch && artifactCanonicalSha256 === embeddedCanonicalSha256) {
      continue
    }

    const diffs = diffJson(artifact.json, embeddedSnapshot, {
      tolerance: DEFAULT_TOLERANCE,
      limit: DEFAULT_DIFF_LIMIT,
    })

    if (declaredHashMismatch || keyMismatches.length > 0 || diffs.length > 0) {
      errors.push({
        gate: GATE,
        slug: routeInfo.slug,
        route: routeInfo.route,
        routeType: routeInfo.routeType,
        artifactPath: relativeArtifactPath,
        htmlPath: relativeHtmlPath,
        tolerance: DEFAULT_TOLERANCE,
        keyMismatches,
        diffs,
        declaredEmbeddedSha256,
        embeddedCanonicalSha256,
        artifactCanonicalSha256,
        declaredHashMismatch,
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
