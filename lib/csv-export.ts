import { getPublicUrl } from './shortId'

interface QueryResult {
  fields: Array<{ name: string }>
  rows: Array<Record<string, unknown>>
}

/**
 * Escape a CSV field value
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)

  // If the field contains commas, quotes, or newlines, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Convert query results to CSV string
 */
export function queryResultsToCSV(
  queryResults: QueryResult,
  options?: {
    publicLinkShortId?: string
    includePublicLink?: boolean
  }
): string {
  const lines: string[] = []

  // Add public link as comment if provided
  if (options?.includePublicLink && options.publicLinkShortId) {
    const publicUrl = getPublicUrl(options.publicLinkShortId)
    lines.push(`# Public Link: ${publicUrl}`)
    lines.push('')
  }

  // Header row
  const headers = queryResults.fields.map((f) => escapeCSVField(f.name))
  lines.push(headers.join(','))

  // Data rows
  for (const row of queryResults.rows) {
    const values = queryResults.fields.map((f) => escapeCSVField(row[f.name]))
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(csv: string, filename: string = 'export.csv'): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Export query results as CSV and trigger download
 */
export function exportQueryResultsToCSV(
  queryResults: QueryResult,
  filename?: string,
  options?: {
    publicLinkShortId?: string
    includePublicLink?: boolean
  }
): void {
  const csv = queryResultsToCSV(queryResults, options)
  const defaultFilename = `query-results-${new Date().toISOString().slice(0, 10)}.csv`
  downloadCSV(csv, filename || defaultFilename)
}
