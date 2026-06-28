import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { signOut } from '@/lib/actions/auth';
import { LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/lead-status';
import LeadsTable, { type LeadRow } from '@/app/admin/leads/LeadsTable';

// Agent workspace. The leads query is RLS-scoped to this agent's assigned
// leads automatically (policy "leads select by role") — no agent-side filter
// in code; the database enforces it. The same rich per-lead workspace the
// admin uses is reused here (no reassign, no admin filter bar).
export const dynamic = 'force-dynamic';

const LEAD_COLUMNS =
  'id, source, source_detail, name, email, phone, message, property_id, property_reference, development_id, status, submitted_at, language, utm_source, utm_campaign, bedrooms, budget_tier, purchase_timeline, contact_method, assigned_agent_id, geo_country, geo_country_code, geo_city';

export default async function AgentDashboard() {
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: leads } = await sb.from('leads').select(LEAD_COLUMNS).order('submitted_at', { ascending: false }).limit(200);
  const rows = (leads ?? []) as LeadRow[];

  // resolve property references → public slugs (same as the admin leads page)
  const refs = [...new Set(rows.map((l) => l.property_reference).filter(Boolean))] as string[];
  const refSlugs: Record<string, string> = {};
  if (refs.length) {
    const { data: slugRows } = await sb.from('properties').select('source_id, slug').in('source_id', refs);
    for (const r of slugRows ?? []) if (r.source_id && r.slug) refSlugs[r.source_id] = r.slug;
  }

  const statuses: LeadStatus[] = ['new', 'called', 'selection_sent', 'closed'];
  const counts = Object.fromEntries(statuses.map((s) => [s, rows.filter((r) => r.status === s).length])) as Record<LeadStatus, number>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#2E2E2E] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-lg font-semibold"><span className="text-[#76b3a8]">Smartmove</span> · Agent</span>
          <form action={async () => { 'use server'; await signOut(); redirect('/admin/login'); }}>
            <button className="text-sm text-white/70 hover:text-white">Logout</button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My leads</h1>
        <p className="text-gray-500 mb-6">Only the leads assigned to you. New leads expect a same-hour callback — expand a row for the full client context, then build &amp; copy a selection.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statuses.map((s) => (
            <div key={s} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">{LEAD_STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
            </div>
          ))}
        </div>

        <LeadsTable leads={rows} refSlugs={refSlugs} filters={{ status: '', source: '', from: '', to: '' }} agents={[]} canAssign={false} showFilters={false} />
      </main>
    </div>
  );
}
