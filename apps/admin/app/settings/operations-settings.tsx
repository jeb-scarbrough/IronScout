'use client';

import { useState } from 'react';
import { Settings, Loader2, Save } from 'lucide-react';
import { updateOperationsSetting, updateLogLevelSetting, updateOperationsBooleanSetting } from './actions';
import { SETTING_KEYS, SETTING_DESCRIPTIONS, SETTING_TOOLTIPS, NUMBER_SETTING_RANGES, LOG_LEVELS, LOG_LEVEL_DESCRIPTIONS, type LogLevel } from './constants';
import { SettingHelp } from './setting-tooltip';
import type { SettingValue } from './actions';

interface OperationsSettingsProps {
  initialSettings: {
    affiliateBatchSize: SettingValue;
    priceHeartbeatHours: SettingValue;
    affiliateRunRetentionDays: SettingValue;
    harvesterLogLevel: SettingValue;
    harvesterDebugSampleRate: SettingValue;
    harvesterDebugFirstN: SettingValue;
    harvesterLogRawExcerpts: SettingValue;
  };
}

interface SettingConfig {
  key: typeof SETTING_KEYS[keyof typeof SETTING_KEYS];
  label: string;
  description: string;
  unit: string;
}

const SETTINGS: SettingConfig[] = [
  {
    key: SETTING_KEYS.AFFILIATE_BATCH_SIZE,
    label: 'Affiliate Batch Size',
    description: SETTING_DESCRIPTIONS[SETTING_KEYS.AFFILIATE_BATCH_SIZE],
    unit: 'items',
  },
  {
    key: SETTING_KEYS.PRICE_HEARTBEAT_HOURS,
    label: 'Price Heartbeat Interval',
    description: SETTING_DESCRIPTIONS[SETTING_KEYS.PRICE_HEARTBEAT_HOURS],
    unit: 'hours',
  },
  {
    key: SETTING_KEYS.AFFILIATE_RUN_RETENTION_DAYS,
    label: 'Run History Retention',
    description: SETTING_DESCRIPTIONS[SETTING_KEYS.AFFILIATE_RUN_RETENTION_DAYS],
    unit: 'days',
  },
  {
    key: SETTING_KEYS.HARVESTER_DEBUG_SAMPLE_RATE,
    label: 'Debug Sample Rate',
    description: SETTING_DESCRIPTIONS[SETTING_KEYS.HARVESTER_DEBUG_SAMPLE_RATE],
    unit: '',
  },
  {
    key: SETTING_KEYS.HARVESTER_DEBUG_FIRST_N,
    label: 'Debug First-N Items',
    description: SETTING_DESCRIPTIONS[SETTING_KEYS.HARVESTER_DEBUG_FIRST_N],
    unit: 'items',
  },
];

export function OperationsSettings({ initialSettings }: OperationsSettingsProps) {
  const [values, setValues] = useState<Record<string, number>>({
    [SETTING_KEYS.AFFILIATE_BATCH_SIZE]: initialSettings.affiliateBatchSize.value as number,
    [SETTING_KEYS.PRICE_HEARTBEAT_HOURS]: initialSettings.priceHeartbeatHours.value as number,
    [SETTING_KEYS.AFFILIATE_RUN_RETENTION_DAYS]: initialSettings.affiliateRunRetentionDays.value as number,
    [SETTING_KEYS.HARVESTER_DEBUG_SAMPLE_RATE]: initialSettings.harvesterDebugSampleRate.value as number,
    [SETTING_KEYS.HARVESTER_DEBUG_FIRST_N]: initialSettings.harvesterDebugFirstN.value as number,
  });

  // Log level state
  const [logLevel, setLogLevel] = useState<LogLevel>(initialSettings.harvesterLogLevel.value as LogLevel);
  const [originalLogLevel] = useState<LogLevel>(logLevel);

  const [originalValues] = useState<Record<string, number>>({ ...values });
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasChanges = (key: string) => values[key] !== originalValues[key];
  const hasLogLevelChanges = logLevel !== originalLogLevel;

  // Raw excerpts boolean toggle state
  const [rawExcerpts, setRawExcerpts] = useState<boolean>(initialSettings.harvesterLogRawExcerpts.value as boolean);
  const [originalRawExcerpts] = useState<boolean>(rawExcerpts);
  const hasRawExcerptsChanges = rawExcerpts !== originalRawExcerpts;

  const handleChange = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setValues((prev) => ({ ...prev, [key]: numValue }));
    }
  };

  const handleSave = async (key: typeof SETTING_KEYS[keyof typeof SETTING_KEYS]) => {
    setLoading(key);
    setError(null);
    setSuccess(null);

    const result = await updateOperationsSetting(key, values[key]);

    setLoading(null);

    if (result.success) {
      setSuccess(`${key} updated successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to update setting');
    }
  };

  const handleLogLevelSave = async () => {
    setLoading('logLevel');
    setError(null);
    setSuccess(null);

    const result = await updateLogLevelSetting(logLevel);

    setLoading(null);

    if (result.success) {
      setSuccess('Log level updated - takes effect within 30 seconds');
      setTimeout(() => setSuccess(null), 5000);
    } else {
      setError(result.error || 'Failed to update log level');
    }
  };

  const handleRawExcerptsSave = async () => {
    setLoading('rawExcerpts');
    setError(null);
    setSuccess(null);

    const result = await updateOperationsBooleanSetting(SETTING_KEYS.HARVESTER_LOG_RAW_EXCERPTS, rawExcerpts);

    setLoading(null);

    if (result.success) {
      setSuccess('Raw excerpts setting updated - takes effect within 30 seconds');
      setTimeout(() => setSuccess(null), 5000);
    } else {
      setError(result.error || 'Failed to update setting');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Log Level Setting */}
      <div
        className={`p-4 border rounded-lg transition-colors ${
          hasLogLevelChanges ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Settings className="h-5 w-5 mt-0.5 text-gray-400" />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 flex items-center">
                  Harvester Log Level
                  <SettingHelp tooltip={SETTING_TOOLTIPS[SETTING_KEYS.HARVESTER_LOG_LEVEL]} position="right" />
                </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {SETTING_DESCRIPTIONS[SETTING_KEYS.HARVESTER_LOG_LEVEL]}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {LOG_LEVEL_DESCRIPTIONS[logLevel]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value as LogLevel)}
              className="w-32 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.toUpperCase()}
                </option>
              ))}
            </select>

            {hasLogLevelChanges && (
              <button
                onClick={handleLogLevelSave}
                disabled={loading === 'logLevel'}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading === 'logLevel' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Numeric Settings */}
      {SETTINGS.map((setting) => {
        const range = NUMBER_SETTING_RANGES[setting.key];
        const isModified = hasChanges(setting.key);
        const step = setting.key === SETTING_KEYS.HARVESTER_DEBUG_SAMPLE_RATE ? 0.01 : 1;

        return (
          <div
            key={setting.key}
            className={`p-4 border rounded-lg transition-colors ${
              isModified ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Settings className="h-5 w-5 mt-0.5 text-gray-400" />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    {setting.label}
                    <SettingHelp tooltip={SETTING_TOOLTIPS[setting.key]} position="right" />
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">{setting.description}</p>
                  {range && (
                    <p className="text-xs text-gray-500 mt-1">
                      Range: {range.min} - {range.max} {setting.unit}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={values[setting.key]}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                    min={range?.min}
                    max={range?.max}
                    step={step}
                    className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {setting.unit && <span className="text-sm text-gray-500">{setting.unit}</span>}
                </div>

                {isModified && (
                  <button
                    onClick={() => handleSave(setting.key)}
                    disabled={loading === setting.key}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading === setting.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Raw Excerpts Toggle */}
      <div
        className={`p-4 border rounded-lg transition-colors ${
          hasRawExcerptsChanges ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Settings className="h-5 w-5 mt-0.5 text-gray-400" />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 flex items-center">
                Log Raw Excerpts
                <SettingHelp tooltip={SETTING_TOOLTIPS[SETTING_KEYS.HARVESTER_LOG_RAW_EXCERPTS]} position="right" />
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {SETTING_DESCRIPTIONS[SETTING_KEYS.HARVESTER_LOG_RAW_EXCERPTS]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRawExcerpts(!rawExcerpts)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                rawExcerpts ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  rawExcerpts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>

            {hasRawExcerptsChanges && (
              <button
                onClick={handleRawExcerptsSave}
                disabled={loading === 'rawExcerpts'}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading === 'rawExcerpts' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
