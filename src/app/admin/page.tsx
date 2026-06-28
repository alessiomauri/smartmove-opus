import Link from 'next/link';
import AdminHeader from '@/components/admin/AdminHeader';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Boxes, ClipboardList, Star, Users, Building2, HelpCircle } from 'lucide-react';
import DefaultSortControl from './DefaultSortControl';
import NotificationEmailControl from './NotificationEmailControl';

// Admin command center (admin-only — the proxy bounces agents to /agent).
export const dynamic = 'force-dynamic';

export default async function AdminCommandCenter() {
  const sb = await createServerSupabaseClient();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const prop = () => sb.from('properties').select('id', { count: 'exact', head: true });
  const [newToday, awaitingCall, pendingReview, featured, inventory, settings] = await Promise.all([
    sb.from('leads').select('id', { count: 'exact', head: true }).gte('submitted_at', startOfToday.toISOString()),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    prop().eq('source', 'resales_online').eq('pending_review', true).eq('rejected', false),
    prop().eq('is_featured', true),
    prop().eq('source', 'resales_online'),
    sb.from('site_settings').select('default_sort, notification_email').eq('id', 1).maybeSingle(),
  ]);

  const kpis = [
    { label: 'New leads today', value: newToday.count ?? 0, loud: (newToday.count ?? 0) > 0, href: '/admin/leads' },
    { label: 'Awaiting call', value: awaitingCall.count ?? 0, loud: (awaitingCall.count ?? 0) > 0, href: '/admin/leads?status=new' },
    { label: 'Pending review', value: pendingReview.count ?? 0, href: '/admin/inventory?review=pending' },
    { label: 'Featured', value: featured.count ?? 0, href: '/admin/curation' },
    { label: 'Resales inventory', value: inventory.count ?? 0, href: '/admin/inventory' },
  ];

  const links = [
    { href: '/admin/inventory', label: 'Resales Inventory', icon: Boxes },
    { href: '/admin/listings', label: 'Own Listings', icon: ClipboardList },
    { href: '/admin/curation', label: 'Featured / Top-20', icon: Star },
    { href: '/admin/leads', label: 'Leads', icon: Users },
    { href: '/admin/team', label: 'Team', icon: Users },
    { href: '/admin/developments', label: 'Developments', icon: Building2 },
    { href: '/admin/quizzes', label: 'Quizzes', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Command center</h1>
        <p className="text-gray-500 mb-6">Everything that needs attention, at a glance.</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href as never}
              className={`bg-white rounded-xl border p-4 transition-colors hover:border-[#0f6c74]/40 ${k.loud ? 'border-[#cbaa65] bg-[#fdf6e7]' : 'border-gray-200'}`}>
              <p className="text-sm text-gray-500">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900">{k.value.toLocaleString()}</p>
            </Link>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <section className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Manage</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {links.map((l) => (
                <Link key={l.href} href={l.href as never} className="flex items-center gap-2 px-3 py-3 rounded-lg border border-gray-200 hover:border-[#0f6c74]/40 hover:bg-gray-50 text-sm font-medium text-gray-700">
                  <l.icon className="w-4 h-4 text-[#0f6c74]" />{l.label}
                </Link>
              ))}
            </div>
          </section>

          <section id="settings" className="bg-white rounded-xl border border-gray-200 p-5 space-y-5 scroll-mt-24">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Public default sort</h2>
              <p className="text-xs text-gray-400 mb-3">Order new visitors see listings in (featured always first).</p>
              <DefaultSortControl current={settings.data?.default_sort ?? 'newest'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">New-lead notification address</h2>
              <p className="text-xs text-gray-400 mb-3">Where new-lead emails go (when Resend is configured).</p>
              <NotificationEmailControl current={settings.data?.notification_email ?? null} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
