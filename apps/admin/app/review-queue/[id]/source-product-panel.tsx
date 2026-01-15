'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileJson,
  Tag,
  Target,
  Scale,
  Package,
  Link as LinkIcon,
} from 'lucide-react';
import { CopyButton, CopyableValue } from './copy-button';

interface SourceProductIdentifier {
  id: string;
  idType: string;
  idValue: string;
  namespace: string;
  isCanonical: boolean;
  normalizedValue?: string | null;
}

interface SourceProduct {
  id: string;
  title: string;
  url: string;
  brand?: string | null;
  caliber?: string | null;
  grainWeight?: number | null;
  roundCount?: number | null;
  identityKey?: string | null;
  sources?: {
    id: string;
    name: string;
    url?: string | null;
  } | null;
  source_product_identifiers?: SourceProductIdentifier[];
}

interface InputNormalized {
  title?: string;
  titleNorm?: string;
  brand?: string;
  brandNorm?: string;
  caliber?: string;
  caliberNorm?: string;
  upc?: string;
  upcNorm?: string;
  packCount?: number;
  grain?: number;
  url?: string;
}

interface SourceProductPanelProps {
  sourceProduct: SourceProduct;
  inputNormalized?: InputNormalized | null;
  evidence?: Record<string, unknown> | null;
}

type FieldView = 'raw' | 'normalized';

/**
 * Extract raw UPC from identifiers
 */
function findRawUpc(identifiers?: SourceProductIdentifier[]): string | null {
  if (!identifiers) return null;
  const upcIdentifier = identifiers.find(
    (id) => id.idType === 'UPC' || id.idType === 'EAN' || id.idType === 'GTIN'
  );
  return upcIdentifier?.idValue ?? null;
}

/**
 * Check if raw and normalized values differ
 */
function valuesDiffer(raw: string | null | undefined, norm: string | null | undefined): boolean {
  if (!raw && !norm) return false;
  if (!raw || !norm) return true;
  return raw.toLowerCase().trim() !== norm.toLowerCase().trim();
}

/**
 * Field comparison row for raw vs normalized
 */
function FieldRow({
  label,
  icon: Icon,
  rawValue,
  normalizedValue,
  view,
}: {
  label: string;
  icon: React.ElementType;
  rawValue: string | number | null | undefined;
  normalizedValue: string | number | null | undefined;
  view: FieldView;
}) {
  const raw = rawValue?.toString() ?? null;
  const norm = normalizedValue?.toString() ?? null;
  const displayValue = view === 'raw' ? raw : norm;
  const hasMismatch = valuesDiffer(raw, norm);

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        {hasMismatch && view === 'normalized' && raw && norm && (
          <span className="text-xs text-amber-600" title={`Raw: ${raw}`}>
            (was: {raw})
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {displayValue ? (
          <span className="font-medium text-gray-900 font-mono text-sm">{displayValue}</span>
        ) : (
          <span className="text-gray-400 text-sm italic">unknown</span>
        )}
        {hasMismatch && (
          <span title="Raw differs from normalized">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </span>
        )}
      </div>
    </div>
  );
}

export function SourceProductPanel({
  sourceProduct,
  inputNormalized,
  evidence,
}: SourceProductPanelProps) {
  const [fieldView, setFieldView] = useState<FieldView>('normalized');
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const rawUpc = findRawUpc(sourceProduct.source_product_identifiers);
  const normalizedUpc = inputNormalized?.upcNorm ?? null;
  const upcMismatch = valuesDiffer(rawUpc, normalizedUpc);
  const displayUpc = fieldView === 'raw' ? rawUpc : normalizedUpc;

  // Group identifiers by type for display
  const identifiers = sourceProduct.source_product_identifiers ?? [];
  const nonUpcIdentifiers = identifiers.filter(
    (id) => id.idType !== 'UPC' && id.idType !== 'EAN' && id.idType !== 'GTIN'
  );

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Source Product
          </h2>
          <div className="flex items-center gap-1 bg-white rounded-md border border-gray-200 p-0.5">
            <button
              onClick={() => setFieldView('normalized')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                fieldView === 'normalized'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Normalized
            </button>
            <button
              onClick={() => setFieldView('raw')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                fieldView === 'raw'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Raw
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* UPC Section - Prominent
            Provenance:
            - Raw UPC: from source_product_identifiers (idType=UPC/EAN/GTIN)
            - Normalized UPC: from evidence.inputNormalized.upcNorm (resolver output)
            Precedence: Normalized is authoritative for matching; raw shown for debugging
        */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Barcode className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                UPC {fieldView === 'raw' ? '(raw)' : '(normalized)'}
              </span>
              {upcMismatch && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Raw ≠ Norm
                </span>
              )}
            </div>
            {displayUpc && <CopyButton value={displayUpc} label="UPC" />}
          </div>
          <div className="flex items-center gap-2">
            {displayUpc ? (
              <span className="text-xl font-bold font-mono text-gray-900 tracking-wide">
                {displayUpc}
              </span>
            ) : (
              <span className="text-lg text-gray-400 italic">unknown</span>
            )}
          </div>
          {/* Always show both values when they differ */}
          {upcMismatch && (
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium w-16">Raw:</span>
                <span className="font-mono">{rawUpc ?? 'none'}</span>
                <span className="text-gray-400">(from identifier)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium w-16">Norm:</span>
                <span className="font-mono">{normalizedUpc ?? 'none'}</span>
                <span className="text-gray-400">(from resolver)</span>
              </div>
            </div>
          )}
        </div>

        {/* Identity Keys */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Identity Keys
          </h3>
          <div className="space-y-1.5">
            {/* Source Product ID */}
            <div className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-sm">
              <span className="text-gray-600">sourceProductId</span>
              <CopyableValue value={sourceProduct.id} label="sourceProductId" truncate />
            </div>

            {/* Identity Key */}
            {sourceProduct.identityKey && (
              <div className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-sm">
                <span className="text-gray-600">identityKey</span>
                <CopyableValue
                  value={sourceProduct.identityKey}
                  label="identityKey"
                  truncate
                />
              </div>
            )}

            {/* Non-UPC Identifiers */}
            {nonUpcIdentifiers.map((identifier) => (
              <div
                key={identifier.id}
                className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-sm"
              >
                <span className="text-gray-600">
                  {identifier.idType}
                  {identifier.namespace && (
                    <span className="text-gray-400 text-xs ml-1">({identifier.namespace})</span>
                  )}
                  {identifier.isCanonical && (
                    <span className="ml-1 text-xs text-green-600" title="Canonical identifier">
                      ★
                    </span>
                  )}
                </span>
                <CopyableValue value={identifier.idValue} label={identifier.idType} truncate />
              </div>
            ))}
          </div>
        </div>

        {/* Product Fields */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Product Fields
          </h3>
          <div className="bg-gray-50 rounded-lg px-3 py-1">
            <FieldRow
              label="Brand"
              icon={Tag}
              rawValue={sourceProduct.brand}
              normalizedValue={inputNormalized?.brandNorm}
              view={fieldView}
            />
            <FieldRow
              label="Caliber"
              icon={Target}
              rawValue={sourceProduct.caliber}
              normalizedValue={inputNormalized?.caliberNorm}
              view={fieldView}
            />
            <FieldRow
              label="Grain"
              icon={Scale}
              rawValue={sourceProduct.grainWeight}
              normalizedValue={inputNormalized?.grain}
              view={fieldView}
            />
            <FieldRow
              label="Pack Count"
              icon={Package}
              rawValue={sourceProduct.roundCount}
              normalizedValue={inputNormalized?.packCount}
              view={fieldView}
            />
          </div>
        </div>

        {/* Source & URL */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Source
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <LinkIcon className="h-4 w-4 text-gray-400" />
              <span className="text-gray-700">{sourceProduct.sources?.name ?? 'Unknown'}</span>
            </div>
            {sourceProduct.url && (
              <div className="flex items-center gap-2">
                <a
                  href={sourceProduct.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on retailer site
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Raw JSON */}
        {evidence && (
          <div className="border-t border-gray-200 pt-3 mt-3">
            <button
              onClick={() => setJsonExpanded(!jsonExpanded)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full"
            >
              {jsonExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <FileJson className="h-4 w-4" />
              <span className="font-medium">Raw Evidence JSON</span>
            </button>
            {jsonExpanded && (
              <div className="mt-2 relative">
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto max-h-80 overflow-y-auto font-mono">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton
                    value={JSON.stringify(evidence, null, 2)}
                    label="JSON"
                    className="text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
