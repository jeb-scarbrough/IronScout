import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { fetchDashboardData } from './actions';
import { DashboardContent } from './dashboard-content';

export const dynamic = 'force-dynamic';

export default async function DataHealthPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect('/login');
  }

  const result = await fetchDashboardData();

  if (!result.success || !result.data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Data Health</h1>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Failed to load dashboard data: {result.error ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <DashboardContent initialData={result.data} />
    </div>
  );
}
