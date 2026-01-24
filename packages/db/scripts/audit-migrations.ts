#!/usr/bin/env tsx
/**
 * Migration Drift Audit Script
 *
 * Analyzes all migrations against schema.prisma to find:
 * 1. Indexes referencing non-existent columns
 * 2. Indexes on non-existent tables
 * 3. Schema indexes without corresponding migrations
 * 4. Duplicate index definitions across migrations
 * 5. Column mismatches between migrations and schema
 *
 * Usage: pnpm audit:migrations
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MIGRATIONS_DIR = path.join(__dirname, '../migrations')
const SCHEMA_PATH = path.join(__dirname, '../schema.prisma')

// ANSI colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

interface IndexDef {
  name: string
  table: string
  columns: string[]
  isPartial: boolean
  source: string // migration name
  raw: string
}

interface SchemaModel {
  name: string
  tableName: string
  columns: string[]
  columnMaps: Map<string, string> // prismaName -> dbName from @map
  indexes: Array<{
    columns: string[]
    name?: string
  }>
}

interface AuditResult {
  orphanedIndexes: Array<{ index: IndexDef; issue: string }>
  missingMigrationIndexes: Array<{ model: string; index: { columns: string[]; name?: string } }>
  duplicateIndexes: Array<{ name: string; sources: string[] }>
  columnMismatches: Array<{ table: string; column: string; inMigration: string; notInSchema: boolean }>
  warnings: string[]
}

/**
 * Parse all migration SQL files and extract index definitions
 */
function parseMigrations(): { indexes: IndexDef[]; createTables: Map<string, string[]> } {
  const indexes: IndexDef[] = []
  const createTables = new Map<string, string[]>() // table -> columns

  const migrationDirs = fs.readdirSync(MIGRATIONS_DIR)
    .filter(d => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory())
    .sort()

  for (const dir of migrationDirs) {
    const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql')
    if (!fs.existsSync(sqlPath)) continue

    const sql = fs.readFileSync(sqlPath, 'utf-8')

    // Extract CREATE INDEX statements
    const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s+ON\s+["']?(\w+)["']?\s*(?:USING\s+\w+\s*)?\(([^)]+)\)(?:\s+WHERE\s+(.+?))?(?:;|$)/gim
    let match
    while ((match = indexRegex.exec(sql)) !== null) {
      const [raw, name, table, columnsPart, whereClause] = match
      const columns = columnsPart
        .split(',')
        .map(c => c.trim().replace(/["']/g, '').split(/\s+/)[0]) // Get column name, strip DESC/ASC
        .filter(c => c && !c.startsWith('(')) // Filter out expressions

      indexes.push({
        name: name.toLowerCase(),
        table: table.toLowerCase(),
        columns: columns.map(c => c.toLowerCase()),
        isPartial: !!whereClause,
        source: dir,
        raw: raw.trim()
      })
    }

    // Extract CREATE TABLE statements and their columns
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(([\s\S]+?)\);/gim
    while ((match = createTableRegex.exec(sql)) !== null) {
      const [, tableName, body] = match
      const columns: string[] = []

      // Parse column definitions (simplified)
      const lines = body.split(',').map(l => l.trim())
      for (const line of lines) {
        // Skip constraints
        if (/^\s*(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(line)) continue
        // Extract column name
        const colMatch = line.match(/^["']?(\w+)["']?\s+/i)
        if (colMatch) {
          columns.push(colMatch[1].toLowerCase())
        }
      }

      const tableKey = tableName.toLowerCase()
      if (createTables.has(tableKey)) {
        // Merge columns (for ALTER TABLE ADD COLUMN)
        const existing = createTables.get(tableKey)!
        columns.forEach(c => {
          if (!existing.includes(c)) existing.push(c)
        })
      } else {
        createTables.set(tableKey, columns)
      }
    }

    // Extract ALTER TABLE ADD COLUMN statements
    const alterAddRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?["']?(\w+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?(\w+)["']?/gim
    while ((match = alterAddRegex.exec(sql)) !== null) {
      const [, tableName, columnName] = match
      const tableKey = tableName.toLowerCase()
      const colKey = columnName.toLowerCase()

      if (createTables.has(tableKey)) {
        const cols = createTables.get(tableKey)!
        if (!cols.includes(colKey)) cols.push(colKey)
      } else {
        createTables.set(tableKey, [colKey])
      }
    }

    // Extract DROP INDEX (to track removed indexes)
    const dropIndexRegex = /DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gim
    while ((match = dropIndexRegex.exec(sql)) !== null) {
      const [, indexName] = match
      // Mark index as dropped
      const existing = indexes.find(i => i.name === indexName.toLowerCase())
      if (existing) {
        existing.source = `${existing.source} (DROPPED in ${dir})`
      }
    }
  }

  return { indexes, createTables }
}

/**
 * Parse schema.prisma to extract models and their indexes
 */
function parseSchema(): SchemaModel[] {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  const models: SchemaModel[] = []

  // Match model blocks
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  let match
  while ((match = modelRegex.exec(schema)) !== null) {
    const [, modelName, body] = match

    // Extract table name (@@map or model name)
    const mapMatch = body.match(/@@map\s*\(\s*["'](\w+)["']\s*\)/)
    const tableName = mapMatch ? mapMatch[1] : modelName

    // Extract columns and their @map names
    const columns: string[] = []
    const columnMaps = new Map<string, string>() // dbName -> prismaName (reverse for easier lookup)
    // Split into lines for more reliable parsing
    const bodyLines = body.split('\n')
    for (const line of bodyLines) {
      const trimmed = line.trim()
      // Skip empty, comments, and directives
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue

      // Match column name (first word that's not a modifier)
      const colMatch = trimmed.match(/^(\w+)\s+\w+/)
      if (!colMatch) continue

      const col = colMatch[1]
      columns.push(col)

      // Check for @map directive on this line
      const mapMatch = trimmed.match(/@map\s*\(\s*["']([^"']+)["']\s*\)/)
      if (mapMatch) {
        // Store dbName -> prismaName for reverse lookup
        columnMaps.set(mapMatch[1].toLowerCase(), col.toLowerCase())
      }
    }

    // Extract @@index directives (skip commented-out ones marked with // REMOVED)
    const indexes: Array<{ columns: string[]; name?: string }> = []
    // Split body into lines and filter out comment lines
    const lines = body.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      // Skip lines that start with // or are marked as REMOVED
      if (trimmed.startsWith('//') || trimmed.includes('REMOVED:')) continue

      const indexRegex = /@@index\s*\(\s*\[([^\]]+)\](?:\s*,\s*(?:name\s*:\s*["'](\w+)["']|map\s*:\s*["'](\w+)["']))?\s*\)/g
      let colMatch
      while ((colMatch = indexRegex.exec(trimmed)) !== null) {
        const [, columnList, name, mapName] = colMatch
        const cols = columnList.split(',').map(c => c.trim().replace(/["']/g, ''))
        indexes.push({
          columns: cols,
          name: mapName || name
        })
      }
    }

    models.push({
      name: modelName,
      tableName: tableName.toLowerCase(),
      columns: columns.map(c => c.toLowerCase()),
      columnMaps,
      indexes
    })
  }

  return models
}

/**
 * Normalize column name for comparison (handle @map directives)
 */
function normalizeColumnName(col: string): string {
  // Handle common patterns like "createdAt" -> "created_at"
  return col.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

/**
 * Run the audit
 */
function runAudit(): AuditResult {
  const { indexes: migrationIndexes, createTables } = parseMigrations()
  const schemaModels = parseSchema()

  const result: AuditResult = {
    orphanedIndexes: [],
    missingMigrationIndexes: [],
    duplicateIndexes: [],
    columnMismatches: [],
    warnings: []
  }

  // Build schema lookup maps
  const schemaTables = new Map<string, SchemaModel>()
  for (const model of schemaModels) {
    schemaTables.set(model.tableName, model)
  }

  // 1. Check for orphaned indexes (reference non-existent tables/columns)
  for (const idx of migrationIndexes) {
    // Skip dropped indexes
    if (idx.source.includes('DROPPED')) continue

    const schemaModel = schemaTables.get(idx.table)
    if (!schemaModel) {
      // Table might exist in migrations but not schema (removed model)
      if (!createTables.has(idx.table)) {
        result.orphanedIndexes.push({
          index: idx,
          issue: `Table "${idx.table}" not found in schema or migrations`
        })
      }
      continue
    }

    // Check each column in the index
    for (const col of idx.columns) {
      const normalizedCol = normalizeColumnName(col)
      // Check if column exists in schema (by name or @map)
      const schemaHasCol = schemaModel.columns.some(c => {
        const cLower = c.toLowerCase()
        const cNorm = normalizeColumnName(c)
        // Direct match
        if (cLower === col || cLower === normalizedCol || cNorm === normalizedCol) return true
        return false
      })
      // Also check if the column name is a @map'd database name
      const mappedPrismaName = schemaModel.columnMaps.get(col)
      if (schemaHasCol || mappedPrismaName) {
        // Column exists either directly or via @map
        continue
      }
      result.columnMismatches.push({
        table: idx.table,
        column: col,
        inMigration: idx.source,
        notInSchema: true
      })
    }
  }

  // 2. Check for duplicate indexes
  const indexByName = new Map<string, string[]>()
  for (const idx of migrationIndexes) {
    if (idx.source.includes('DROPPED')) continue
    const existing = indexByName.get(idx.name) || []
    existing.push(idx.source)
    indexByName.set(idx.name, existing)
  }
  for (const [name, sources] of indexByName) {
    if (sources.length > 1) {
      result.duplicateIndexes.push({ name, sources })
    }
  }

  // 3. Check for schema indexes without migrations
  for (const model of schemaModels) {
    for (const schemaIdx of model.indexes) {
      const expectedName = schemaIdx.name?.toLowerCase()

      // Try to find a matching migration index
      const found = migrationIndexes.some(mIdx => {
        if (mIdx.source.includes('DROPPED')) return false
        if (mIdx.table !== model.tableName) return false

        // Match by name if provided
        if (expectedName && mIdx.name === expectedName) return true

        // Match by columns
        const mCols = mIdx.columns.sort().join(',')
        const sCols = schemaIdx.columns.map(c => c.toLowerCase()).sort().join(',')
        return mCols === sCols
      })

      if (!found) {
        result.missingMigrationIndexes.push({
          model: model.name,
          index: schemaIdx
        })
      }
    }
  }

  // 4. Check for indexes using productId vs sourceProductId (common mismatch)
  for (const idx of migrationIndexes) {
    if (idx.table === 'prices') {
      if (idx.columns.includes('productid') && !idx.columns.includes('sourceproductid')) {
        result.warnings.push(
          `Index "${idx.name}" on prices uses "productId" - should this be "sourceProductId"? (${idx.source})`
        )
      }
    }
  }

  return result
}

/**
 * Print audit results
 */
function printResults(result: AuditResult) {
  console.log(`\n${BOLD}${'='.repeat(80)}${RESET}`)
  console.log(`${BOLD}${CYAN}MIGRATION DRIFT AUDIT REPORT${RESET}`)
  console.log(`Generated: ${new Date().toISOString()}`)
  console.log(`${'='.repeat(80)}\n`)

  // Summary
  const totalIssues =
    result.orphanedIndexes.length +
    result.missingMigrationIndexes.length +
    result.duplicateIndexes.length +
    result.columnMismatches.length

  if (totalIssues === 0 && result.warnings.length === 0) {
    console.log(`${GREEN}✓ No drift detected - schema and migrations are in sync${RESET}\n`)
    return
  }

  console.log(`${YELLOW}Found ${totalIssues} issues and ${result.warnings.length} warnings${RESET}\n`)

  // 1. Orphaned Indexes
  console.log(`\n${BOLD}1. ORPHANED INDEXES (table/column not in schema)${RESET}`)
  console.log('-'.repeat(80))
  if (result.orphanedIndexes.length === 0) {
    console.log(`${GREEN}✓ None found${RESET}`)
  } else {
    for (const { index, issue } of result.orphanedIndexes) {
      console.log(`${RED}✗${RESET} ${index.name} on ${index.table}(${index.columns.join(', ')})`)
      console.log(`  Issue: ${issue}`)
      console.log(`  Source: ${index.source}`)
    }
  }

  // 2. Column Mismatches
  console.log(`\n${BOLD}2. COLUMN MISMATCHES (index references column not in schema)${RESET}`)
  console.log('-'.repeat(80))
  if (result.columnMismatches.length === 0) {
    console.log(`${GREEN}✓ None found${RESET}`)
  } else {
    for (const cm of result.columnMismatches) {
      console.log(`${RED}✗${RESET} ${cm.table}.${cm.column}`)
      console.log(`  Migration: ${cm.inMigration}`)
    }
  }

  // 3. Duplicate Indexes
  console.log(`\n${BOLD}3. DUPLICATE INDEX DEFINITIONS${RESET}`)
  console.log('-'.repeat(80))
  if (result.duplicateIndexes.length === 0) {
    console.log(`${GREEN}✓ None found${RESET}`)
  } else {
    for (const { name, sources } of result.duplicateIndexes) {
      console.log(`${YELLOW}!${RESET} Index "${name}" defined in multiple migrations:`)
      for (const src of sources) {
        console.log(`    - ${src}`)
      }
    }
  }

  // 4. Missing Migration Indexes
  console.log(`\n${BOLD}4. SCHEMA INDEXES WITHOUT MIGRATIONS${RESET}`)
  console.log('-'.repeat(80))
  if (result.missingMigrationIndexes.length === 0) {
    console.log(`${GREEN}✓ None found${RESET}`)
  } else {
    for (const { model, index } of result.missingMigrationIndexes) {
      const name = index.name ? ` (${index.name})` : ''
      console.log(`${YELLOW}!${RESET} ${model}${name}: @@index([${index.columns.join(', ')}])`)
      console.log(`  This index is in schema.prisma but no matching migration found`)
    }
  }

  // 5. Warnings
  if (result.warnings.length > 0) {
    console.log(`\n${BOLD}5. WARNINGS${RESET}`)
    console.log('-'.repeat(80))
    for (const warning of result.warnings) {
      console.log(`${YELLOW}!${RESET} ${warning}`)
    }
  }

  // Recommendations
  console.log(`\n${BOLD}RECOMMENDATIONS${RESET}`)
  console.log('-'.repeat(80))

  if (result.orphanedIndexes.length > 0) {
    console.log(`• Review orphaned indexes - they may reference dropped columns/tables`)
  }
  if (result.columnMismatches.length > 0) {
    console.log(`• Column mismatches may indicate @map() directives or renamed columns`)
    console.log(`• Run EXPLAIN on affected queries to verify index usage`)
  }
  if (result.duplicateIndexes.length > 0) {
    console.log(`• Duplicate indexes waste space - consider consolidating migrations`)
    console.log(`• Use "CREATE INDEX IF NOT EXISTS" to prevent runtime errors`)
  }
  if (result.missingMigrationIndexes.length > 0) {
    console.log(`• Schema indexes without migrations won't be applied automatically`)
    console.log(`• Run "pnpm db:migrate:dev" to generate missing migrations`)
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`AUDIT COMPLETE`)
  console.log(`${'='.repeat(80)}\n`)
}

/**
 * Export detailed index inventory
 */
function printIndexInventory() {
  const { indexes } = parseMigrations()

  console.log(`\n${BOLD}INDEX INVENTORY (${indexes.length} total)${RESET}`)
  console.log('-'.repeat(100))
  console.log(
    'Index Name'.padEnd(50) +
    'Table'.padEnd(25) +
    'Migration'
  )
  console.log('-'.repeat(100))

  // Group by table
  const byTable = new Map<string, IndexDef[]>()
  for (const idx of indexes) {
    const list = byTable.get(idx.table) || []
    list.push(idx)
    byTable.set(idx.table, list)
  }

  for (const [table, idxs] of [...byTable.entries()].sort()) {
    for (const idx of idxs.sort((a, b) => a.name.localeCompare(b.name))) {
      const dropped = idx.source.includes('DROPPED') ? ' (DROPPED)' : ''
      console.log(
        idx.name.padEnd(50) +
        table.padEnd(25) +
        idx.source.substring(0, 40) + dropped
      )
    }
  }
}

// Main
const args = process.argv.slice(2)
const verbose = args.includes('--verbose') || args.includes('-v')
const inventoryOnly = args.includes('--inventory')

if (inventoryOnly) {
  printIndexInventory()
} else {
  const result = runAudit()
  printResults(result)

  if (verbose) {
    printIndexInventory()
  }

  // Exit with error code if issues found
  const totalIssues =
    result.orphanedIndexes.length +
    result.columnMismatches.length
  process.exit(totalIssues > 0 ? 1 : 0)
}
