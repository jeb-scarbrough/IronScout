import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { OverallStatus } from './actions';

interface StatusBannerProps {
  status: OverallStatus;
  fetchedAt: Date;
}

const STATUS_CONFIG = {
  ok: {
    bg: 'bg-green-50 border-green-300',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    title: 'All Systems Healthy',
    description: 'Pipelines, prices, and guardrails are operating normally.',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-300',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    title: 'Warnings Detected',
    description: 'Some metrics need attention. Review sections below.',
  },
  error: {
    bg: 'bg-red-50 border-red-300',
    icon: XCircle,
    iconColor: 'text-red-600',
    title: 'Issues Detected',
    description: 'Critical issues found. Immediate attention required.',
  },
} as const;

export function StatusBanner({ status, fetchedAt }: StatusBannerProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${config.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${config.iconColor} flex-shrink-0`} />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
          <p className="text-sm text-gray-600">{config.description}</p>
        </div>
        <p className="text-xs text-gray-500 whitespace-nowrap">
          {fetchedAt.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
