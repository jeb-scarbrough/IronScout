import type { GuardrailAuditRow } from './actions';

interface GuardrailAuditProps {
  guardrailAudit: GuardrailAuditRow[] | null;
}

function BoolBadge({ value, label }: { value: boolean | null; label?: string }) {
  if (value === null) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        {label ?? 'N/A'}
      </span>
    );
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {label ?? (value ? 'Yes' : 'No')}
    </span>
  );
}

function timeAgo(date: Date | null): string {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

type RowHighlight = 'red' | 'amber' | 'none';

function getRowHighlight(row: GuardrailAuditRow): RowHighlight {
  const allVisibilityGuardsPass =
    row.robotsCompliant &&
    row.tosReviewed &&
    row.tosApproved &&
    row.adapterEnabled === true;

  // Red: all visibility guardrails pass but CVP=0 and recent offers > 0 (genuine anomaly)
  if (allVisibilityGuardsPass && row.cvpRows === 0 && row.recentOffers > 0) {
    return 'red';
  }

  // Amber: any visibility guardrail is false (prices hidden from search)
  const anyGuardrailFailing =
    !row.robotsCompliant ||
    !row.tosReviewed ||
    !row.tosApproved ||
    row.adapterEnabled !== true;

  if (anyGuardrailFailing) {
    return 'amber';
  }

  return 'none';
}

function rowBgClass(highlight: RowHighlight): string {
  switch (highlight) {
    case 'red':
      return 'bg-red-50';
    case 'amber':
      return 'bg-amber-50';
    case 'none':
      return '';
  }
}

export function GuardrailAudit({ guardrailAudit }: GuardrailAuditProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Guardrail Audit</h3>
      <p className="text-xs text-gray-500 mb-3">
        Sources with adapters. Visibility guardrails control search results; ingestion status controls new scrapes.
      </p>

      {guardrailAudit === null ? (
        <p className="text-sm text-red-600">Failed to load guardrail data</p>
      ) : guardrailAudit.length === 0 ? (
        <p className="text-sm text-gray-500">No sources with adapters configured</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Source</th>
                <th colSpan={5} className="text-center px-3 py-2 font-medium text-gray-600 border-l border-gray-200">
                  Visibility Guardrails
                </th>
                <th colSpan={3} className="text-center px-3 py-2 font-medium text-gray-600 border-l border-gray-200">
                  Ingestion Status
                </th>
              </tr>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs">
                <th className="text-left px-3 py-1.5 font-medium text-gray-500" />
                <th className="text-center px-2 py-1.5 font-medium text-gray-500 border-l border-gray-200">Robots</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500">ToS Reviewed</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500">ToS Approved</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500">Adapter</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500">CVP Rows</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500 border-l border-gray-200">Scrape Enabled</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500">Last Run</th>
                <th className="text-center px-2 py-1.5 font-medium text-gray-500">Recent Offers</th>
              </tr>
            </thead>
            <tbody>
              {guardrailAudit.map((row) => {
                const highlight = getRowHighlight(row);
                return (
                  <tr
                    key={row.sourceId}
                    className={`border-b border-gray-50 ${rowBgClass(highlight)}`}
                  >
                    <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                      {row.sourceName}
                    </td>
                    <td className="px-2 py-2 text-center border-l border-gray-100">
                      <BoolBadge value={row.robotsCompliant} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <BoolBadge value={row.tosReviewed} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <BoolBadge value={row.tosApproved} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <BoolBadge value={row.adapterEnabled} />
                    </td>
                    <td className="px-2 py-2 text-center text-gray-700">
                      {row.cvpRows.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-center border-l border-gray-100">
                      <BoolBadge value={row.scrapeEnabled} />
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500 text-xs whitespace-nowrap">
                      {timeAgo(row.lastRunAt)}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-700">
                      {row.recentOffers.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
