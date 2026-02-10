'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, FileText, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { bulkCreateScrapeTargets, type BulkCreateResult } from '../actions'

interface Source {
  id: string
  name: string
  adapterId: string | null
  scrapeEnabled: boolean
}

interface ParsedRow {
  url: string
  adapterId: string
  priority?: number
}

export function ImportTargetsButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [sourceId, setSourceId] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [isLoadingSources, setIsLoadingSources] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<BulkCreateResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch sources on mount
  useEffect(() => {
    if (!isOpen) return
    async function fetchSources() {
      try {
        const response = await fetch('/api/sources?scrapeEnabled=true')
        if (response.ok) {
          const data = await response.json()
          setSources(data.sources || [])
        }
      } catch {
        console.error('Failed to fetch sources')
      } finally {
        setIsLoadingSources(false)
      }
    }
    fetchSources()
  }, [isOpen])

  function reset() {
    setFile(null)
    setParsedRows([])
    setParseError(null)
    setSourceId('')
    setIsImporting(false)
    setResult(null)
  }

  function handleClose() {
    setIsOpen(false)
    reset()
  }

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length === 0) throw new Error('CSV file is empty')

    // Parse header
    const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase())
    const urlIdx = header.indexOf('url')
    const adapterIdx = header.indexOf('adapterid')
    const priorityIdx = header.indexOf('priority')

    if (urlIdx === -1) throw new Error('CSV must have a "url" column')
    if (adapterIdx === -1) throw new Error('CSV must have an "adapterId" column')

    const rows: ParsedRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(',').map((c) => c.trim())
      const url = cols[urlIdx] ?? ''
      const adapterId = cols[adapterIdx] ?? ''

      if (!url || !adapterId) continue

      const row: ParsedRow = { url, adapterId }
      if (priorityIdx !== -1 && cols[priorityIdx]) {
        const priority = parseInt(cols[priorityIdx]!, 10)
        if (!isNaN(priority)) row.priority = priority
      }
      rows.push(row)
    }

    return rows
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setParseError(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const rows = parseCSV(text)
        if (rows.length === 0) {
          setParseError('No valid data rows found in CSV')
          setParsedRows([])
          return
        }
        setParsedRows(rows)
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Failed to parse CSV')
        setParsedRows([])
      }
    }
    reader.readAsText(selectedFile)
  }

  async function handleImport() {
    if (!sourceId || parsedRows.length === 0) return

    setIsImporting(true)
    try {
      const importResult = await bulkCreateScrapeTargets(parsedRows, sourceId)
      setResult(importResult)
    } catch {
      setResult({
        success: false,
        created: 0,
        skipped: 0,
        errors: [{ row: 0, url: '', error: 'An unexpected error occurred' }],
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Detect unique adapters in parsed data
  const adapters = [...new Set(parsedRows.map((r) => r.adapterId))]

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        <Upload className="h-4 w-4 mr-2" />
        Import CSV
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={handleClose} />

            {/* Panel */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Import Scrape Targets</h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Result display */}
              {result && (
                <div className={`mb-4 rounded-lg p-4 ${result.success && result.errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="flex items-start">
                    {result.success && result.errors.length === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                    )}
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        Import complete
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        Created: {result.created} | Skipped (duplicates): {result.skipped}
                        {result.errors.length > 0 && ` | Errors: ${result.errors.length}`}
                      </p>
                      {result.errors.length > 0 && (
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                          {result.errors.slice(0, 10).map((err, i) => (
                            <li key={i}>
                              Row {err.row}: {err.error}
                            </li>
                          ))}
                          {result.errors.length > 10 && (
                            <li>...and {result.errors.length - 10} more errors</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-sm text-blue-600 hover:text-blue-500"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* File input */}
              {!result && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CSV File
                    </label>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {file ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="h-5 w-5 text-gray-500" />
                          <span className="text-sm text-gray-700">{file.name}</span>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                          <p className="mt-2 text-sm text-gray-600">
                            Click to select a CSV file
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Required columns: url, adapterId
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {parseError && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800">{parseError}</p>
                    </div>
                  )}

                  {/* Preview */}
                  {parsedRows.length > 0 && (
                    <div className="mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-900">
                          {parsedRows.length} URLs found
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Adapter{adapters.length > 1 ? 's' : ''}: {adapters.join(', ')}
                        </p>
                        <div className="mt-2 max-h-24 overflow-y-auto">
                          {parsedRows.slice(0, 5).map((row, i) => (
                            <p key={i} className="text-xs text-gray-500 truncate">
                              {row.url}
                            </p>
                          ))}
                          {parsedRows.length > 5 && (
                            <p className="text-xs text-gray-400">
                              ...and {parsedRows.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Source selector */}
                  {parsedRows.length > 0 && (
                    <div className="mb-4">
                      <label htmlFor="import-source" className="block text-sm font-medium text-gray-700 mb-2">
                        Target Source <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="import-source"
                        value={sourceId}
                        onChange={(e) => setSourceId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                        disabled={isLoadingSources}
                      >
                        <option value="">
                          {isLoadingSources ? 'Loading sources...' : 'Select a source...'}
                        </option>
                        {sources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name}
                            {source.adapterId ? ` (${source.adapterId})` : ''}
                            {!source.scrapeEnabled && ' [scraping disabled]'}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        All targets will be created under this source.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={!sourceId || parsedRows.length === 0 || isImporting}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import {parsedRows.length} URLs
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
