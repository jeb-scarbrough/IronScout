import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform configuration and settings
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-12 text-center">
        <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Platform settings including email configuration, tier settings, 
          feature flags, and more.
        </p>
      </div>
    </div>
  );
}
