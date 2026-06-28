import AdminHeader from '@/components/admin/AdminHeader';
import { listTeam } from '@/lib/actions/team';
import TeamClient from './TeamClient';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const team = await listTeam();
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TeamClient team={team} />
      </main>
    </div>
  );
}
