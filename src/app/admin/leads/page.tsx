import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import LeadsTable, { type LeadRow } from './LeadsTable';

/**
 * Interim CRM (§4.5; Monday stays disconnected). Built for a call-first
 * workflow: new leads are loud, every row is one click from tel:/
 * WhatsApp/mailto, and the status pipeline is new → called →
 * selection sent → closed.
 */

export const dynamic = 'force-dynamic';

interface Search {
  status?: string;
  source?: string;
  from?: string;
  to?: string;
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const sp = await searchParams;

  let query = supabase
    .from('leads')
    .select(
      'id, source, source_detail, name, email, phone, message, property_id, property_reference, development_id, status, submitted_at, language, utm_source, utm_campaign, bedrooms, budget_tier, purchase_timeline, contact_method'
    )
    .order('submitted_at', { ascending: false })
    .limit(300);

  if (sp.status) query = query.eq('status', sp.status);
  if (sp.source) query = query.eq('source', sp.source);
  if (sp.from) query = query.gte('submitted_at', `${sp.from}T00:00:00Z`);
  if (sp.to) query = query.lte('submitted_at', `${sp.to}T23:59:59Z`);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // Monday
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [leads, newToday, newWeek, awaitingCall, views7d, subs7d] = await Promise.all([
    query,
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('submitted_at', startOfToday.toISOString()),
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('submitted_at', startOfWeek.toISOString()),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('lead_form_events').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoIso),
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('submitted_at', weekAgoIso),
  ]);

  const conversion =
    (views7d.count ?? 0) > 0 ? (((subs7d.count ?? 0) / views7d.count!) * 100).toFixed(1) : null;

  // Lead rows carry the Resales reference; resolve slugs so the table
  // can link straight to the public listing.
  const refs = [...new Set((leads.data ?? []).map((l) => l.property_reference).filter(Boolean))] as string[];
  const refSlugs: Record<string, string> = {};
  if (refs.length > 0) {
    const { data: slugRows } = await supabase
      .from('properties')
      .select('source_id, slug')
      .in('source_id', refs);
    for (const r of slugRows ?? []) {
      if (r.source_id && r.slug) refSlugs[r.source_id] = r.slug;
    }
  }

  return (
    <main style={{ padding: '40px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Leads</h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Call-first queue. New leads expect a same-hour callback — they&apos;re
          loud on purpose. Monday CRM stays disconnected; this is the source
          of truth.
        </p>
      </header>

      {/* Header counts */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 26 }}>
        <Count label="New today" value={newToday.count ?? 0} loud={(newToday.count ?? 0) > 0} />
        <Count label="New this week" value={newWeek.count ?? 0} />
        <Count label="Awaiting call" value={awaitingCall.count ?? 0} loud={(awaitingCall.count ?? 0) > 0} />
        <Count
          label="Form conversion (7d)"
          value={conversion != null ? `${conversion}%` : '—'}
          sub={`${subs7d.count ?? 0} submits / ${views7d.count ?? 0} views`}
        />
      </section>

      <LeadsTable
        leads={(leads.data ?? []) as LeadRow[]}
        refSlugs={refSlugs}
        filters={{ status: sp.status ?? '', source: sp.source ?? '', from: sp.from ?? '', to: sp.to ?? '' }}
      />
    </main>
  );
}

function Count({
  label,
  value,
  sub,
  loud,
}: {
  label: string;
  value: number | string;
  sub?: string;
  loud?: boolean;
}) {
  return (
    <div
      style={{
        padding: 18,
        border: loud ? '2px solid #cbaa65' : '1px solid #e5e5e5',
        borderRadius: 8,
        background: loud ? '#fdf6e7' : '#fff',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#666' }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
