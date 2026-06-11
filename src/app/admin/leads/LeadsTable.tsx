'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateLeadStatus, buildEmailSelection } from '@/lib/actions/leads';
import { LEAD_STATUSES, LEAD_STATUS_LABELS, sourceBadgeColor, type LeadStatus } from '@/lib/lead-status';
import { copySelectionToClipboard } from '@/components/admin/copy-email-selection';

export interface LeadRow {
  id: string;
  source: string;
  source_detail: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  property_id: string | null;
  property_reference: string | null;
  development_id: string | null;
  status: string;
  submitted_at: string;
  language: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  bedrooms: string | null;
  budget_tier: string | null;
  purchase_timeline: string | null;
  contact_method: string | null;
}

/**
 * Call-first leads table. One row per lead, newest first:
 *  - NEW rows are loud (gold edge + tinted background) — the same-hour
 *    callback rule depends on them being impossible to miss;
 *  - phone renders as tel: AND wa.me (pre-filled greeting), email as
 *    mailto: — click-to-act, no copy-paste;
 *  - the whole row expands to show everything the lead submitted (the
 *    advisor reads this BEFORE dialing);
 *  - status flips in one click: new → called → selection sent → closed;
 *  - "Copy card" builds the email-safe property card (links tagged
 *    lead=<id>) for pasting into the advisor's own mail client.
 */
export default function LeadsTable({
  leads,
  refSlugs,
  filters,
}: {
  leads: LeadRow[];
  /** Resales reference → public slug (resolved server-side). */
  refSlugs: Record<string, string>;
  filters: { status: string; source: string; from: string; to: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [busyCopy, setBusyCopy] = useState<string | null>(null);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams();
    const next = { ...filters, [key]: value };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.push(`/admin/leads${params.size ? `?${params}` : ''}`);
  }

  function flip(lead: LeadRow, status: LeadStatus) {
    startTransition(async () => {
      try {
        await updateLeadStatus(lead.id, status);
        toast.success(`${lead.name} → ${LEAD_STATUS_LABELS[status]}`);
        router.refresh();
      } catch (e) {
        toast.error('Status update failed', { description: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  async function copyCard(lead: LeadRow) {
    if (!lead.property_reference) return;
    setBusyCopy(lead.id);
    try {
      const ref = lead.property_reference;
      await copySelectionToClipboard(() =>
        buildEmailSelection({ references: [ref], leadId: lead.id })
      );
      toast.success('Card copied for email', {
        description: 'Paste into your email client, then flip the lead to “Selection sent”.',
        duration: 7000,
      });
    } catch (e) {
      toast.error('Copy failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyCopy(null);
    }
  }

  const sources = ['viewing-request', 'brochure-request', 'contact-form', 'newsletter', 'two-step-landing', 'other'];

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={filters.source} onChange={(e) => setFilter('source', e.target.value)} style={selectStyle}>
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} style={selectStyle} aria-label="From date" />
        <span style={{ color: '#999', fontSize: 12 }}>→</span>
        <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} style={selectStyle} aria-label="To date" />
        {(filters.status || filters.source || filters.from || filters.to) && (
          <button type="button" onClick={() => router.push('/admin/leads')} style={{ ...selectStyle, cursor: 'pointer', background: '#fff' }}>
            Clear
          </button>
        )}
      </div>

      {leads.length === 0 ? (
        <p style={{ color: '#666', fontSize: 14, padding: '32px 0' }}>No leads match these filters.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leads.map((lead) => {
            const isNew = lead.status === 'new';
            const expanded = open === lead.id;
            const badge = sourceBadgeColor(lead.source);
            const wa = lead.phone
              ? `https://wa.me/${lead.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                  `Hello ${lead.name.split(' ')[0]}, this is Smartmove Marbella — thank you for your enquiry${lead.property_reference ? ` about ${lead.property_reference}` : ''}. When would be a good moment to talk?`
                )}`
              : null;

            return (
              <div
                key={lead.id}
                style={{
                  border: isNew ? '2px solid #cbaa65' : '1px solid #e5e5e5',
                  background: isNew ? '#fdf6e7' : '#fff',
                  borderRadius: 10,
                  boxShadow: isNew ? '0 2px 12px -4px rgba(203,170,101,0.45)' : 'none',
                }}
              >
                {/* Row header — click to expand */}
                <div
                  onClick={() => setOpen(expanded ? null : lead.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap' }}
                >
                  {isNew && (
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: '#cbaa65', boxShadow: '0 0 0 4px rgba(203,170,101,0.25)', flexShrink: 0 }} />
                  )}
                  <strong style={{ fontSize: 14.5, minWidth: 140 }}>{lead.name}</strong>
                  <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: badge.bg, color: badge.fg }}>
                    {lead.source}
                  </span>
                  {lead.property_reference &&
                    (refSlugs[lead.property_reference] ? (
                      <a
                        href={`/property/${refSlugs[lead.property_reference]}`}
                        onClick={(e) => e.stopPropagation()}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#3e6499', textDecoration: 'underline' }}
                        title="Open the public listing"
                      >
                        {lead.property_reference}
                      </a>
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#888' }}>
                        {lead.property_reference}
                      </span>
                    ))}
                  <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {new Date(lead.submitted_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Status pipeline — one click each, no modal */}
                  <span style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {LEAD_STATUSES.map((s) => {
                      const active = lead.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => !active && flip(lead, s)}
                          title={LEAD_STATUS_LABELS[s]}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            cursor: active ? 'default' : 'pointer',
                            border: active ? '1px solid transparent' : '1px solid #ddd',
                            background: active ? statusColor(s).bg : '#fff',
                            color: active ? statusColor(s).fg : '#999',
                          }}
                        >
                          {LEAD_STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </span>
                </div>

                {/* Expanded: everything submitted + click-to-act */}
                {expanded && (
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '14px 16px 16px', display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) 1fr', gap: 18 }}>
                    <div>
                      <DetailLine label="Message" value={lead.message} pre />
                      <DetailLine label="Context" value={lead.source_detail} />
                      <DetailLine label="Bedrooms" value={lead.bedrooms} />
                      <DetailLine label="Budget" value={lead.budget_tier} />
                      <DetailLine label="Timeline" value={lead.purchase_timeline} />
                      <DetailLine label="Preferred contact" value={lead.contact_method} />
                      <DetailLine label="Language" value={lead.language} />
                      <DetailLine label="UTM" value={[lead.utm_source, lead.utm_campaign].filter(Boolean).join(' / ') || null} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                      {lead.phone && (
                        <>
                          <a href={`tel:${lead.phone}`} style={actLink}>📞 Call {lead.phone}</a>
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" style={{ ...actLink, color: '#1faa55' }}>
                              💬 WhatsApp (pre-filled greeting)
                            </a>
                          )}
                        </>
                      )}
                      <a href={`mailto:${lead.email}`} style={actLink}>✉️ {lead.email}</a>
                      {lead.property_reference && (
                        <button
                          type="button"
                          disabled={busyCopy === lead.id}
                          onClick={() => copyCard(lead)}
                          style={{
                            marginTop: 6,
                            padding: '9px 16px',
                            borderRadius: 999,
                            border: 0,
                            background: '#cbaa65',
                            color: '#fff',
                            fontSize: 11.5,
                            fontWeight: 700,
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                          }}
                        >
                          {busyCopy === lead.id ? 'Copying…' : 'Copy card for email'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusColor(s: LeadStatus): { bg: string; fg: string } {
  switch (s) {
    case 'new': return { bg: '#fdf0d3', fg: '#8a6210' };
    case 'called': return { bg: '#e7eef5', fg: '#3e6499' };
    case 'selection_sent': return { bg: '#efe7f4', fg: '#6d4d8a' };
    case 'closed': return { bg: '#dff0e1', fg: '#2f6f4f' };
  }
}

function DetailLine({ label, value, pre }: { label: string; value: string | null; pre?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>{label}</div>
      <div style={{ fontSize: 13.5, color: '#333', whiteSpace: pre ? 'pre-wrap' : 'normal' }}>{value}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: 8,
  fontSize: 13,
  background: '#fff',
};

const actLink: React.CSSProperties = {
  fontSize: 13.5,
  color: '#1c1a17',
  textDecoration: 'none',
  padding: '6px 0',
  fontWeight: 600,
};
