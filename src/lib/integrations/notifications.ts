import { getServiceRoleClient } from '@/lib/supabase-service';

/**
 * Notification module — channel-adapter shaped (mirrors monday.ts's
 * env-gated no-op pattern). Email ships now via Resend; a WhatsApp slot
 * is stubbed for later. EVERY path (send, skip, fail) writes an `events`
 * row, and NOTHING here ever throws — a notification must never block a
 * lead write.
 *
 * Domain auth (SPF/DKIM/DMARC on a sending subdomain) is a migration-day
 * task, intentionally NOT handled here. Until then, set RESEND_FROM to
 * Resend's onboarding sender (onboarding@resend.dev) for verified-recipient
 * testing.
 */

export type NotifLead = {
  id: string; name: string; email: string; phone?: string | null;
  source?: string | null; source_detail?: string | null; property_reference?: string | null;
  budget_tier?: string | null; purchase_timeline?: string | null; message?: string | null;
};

/** monday.ts-style gate: unset RESEND_API_KEY ⇒ disabled. */
export function isEnabled(): { enabled: boolean } {
  return { enabled: !!process.env.RESEND_API_KEY };
}

type SendResult = { ok: boolean; id?: string; error?: string };
type Channel = { name: string; send: (to: string, subject: string, html: string) => Promise<SendResult> };

const emailChannel: Channel = {
  name: 'email',
  async send(to, subject, html) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, error: 'no-key' };
    const from = process.env.RESEND_FROM || 'Smartmove Marbella <onboarding@resend.dev>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
      const j = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: j.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// Future WhatsApp Business adapter — same Channel shape, wired in later
// with zero changes at the call sites.
const whatsappChannel: Channel = {
  name: 'whatsapp',
  async send() { return { ok: false, error: 'whatsapp-adapter-not-implemented' }; },
};

// `whatsapp` is the stubbed slot for a later adapter; only `email` is wired today.
const CHANNELS = { email: emailChannel, whatsapp: whatsappChannel } as const;

async function logNotif(action: string, channel: string, to: string | null, entityId: string | null, meta: Record<string, unknown>) {
  try {
    const sb = getServiceRoleClient();
    await sb.from('events').insert({
      actor_user_id: null, entity_type: 'notification', entity_id: entityId,
      action, meta: { channel, to, ...meta },
    });
  } catch (e) { console.error('logNotif failed:', e); }
}

async function deliver(kind: string, to: string | null, subject: string, html: string, entityId: string | null) {
  if (!isEnabled().enabled || !to) {
    await logNotif('notification_skipped', 'email', to, entityId, { kind, reason: !isEnabled().enabled ? 'resend-disabled' : 'no-recipient' });
    return { skipped: true as const };
  }
  const r = await CHANNELS.email.send(to, subject, html);
  await logNotif(r.ok ? 'notification_sent' : 'notification_failed', 'email', to, entityId, { kind, id: r.id, error: r.error });
  return r;
}

export async function notifyNewLead(lead: NotifLead) {
  try {
    const sb = getServiceRoleClient();
    const { data: settings } = await sb.from('site_settings').select('notification_email').eq('id', 1).maybeSingle();
    const to = (settings?.notification_email as string | null) ?? null;
    const subject = `New lead: ${lead.name}${lead.property_reference ? ` · ${lead.property_reference}` : ''}`;
    return await deliver('new_lead', to, subject, newLeadHtml(lead), lead.id);
  } catch (e) { console.error('notifyNewLead failed:', e); return { skipped: true as const }; }
}

export async function notifyLeadAssigned(lead: NotifLead, agentEmail: string | null) {
  try {
    const subject = `Lead assigned to you: ${lead.name}`;
    return await deliver('lead_assigned', agentEmail, subject, assignedHtml(lead), lead.id);
  } catch (e) { console.error('notifyLeadAssigned failed:', e); return { skipped: true as const }; }
}

// ---- email bodies (plain, inline-styled) ----
function esc(s?: string | null) { return (s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!)); }
function r(label: string, v?: string | null) { return v ? `<tr><td style="padding:4px 12px 4px 0;color:#888">${label}</td><td style="padding:4px 0">${esc(v)}</td></tr>` : ''; }
const site = () => process.env.NEXT_PUBLIC_SITE_URL || '';
function newLeadHtml(l: NotifLead) {
  return `<div style="font-family:Georgia,serif;color:#1c1a17"><h2 style="margin:0 0 8px">New lead — ${esc(l.name)}</h2>
  <table>${r('Email', l.email)}${r('Phone', l.phone)}${r('Source', l.source_detail || l.source)}${r('Reference', l.property_reference)}${r('Budget', l.budget_tier)}${r('Timeline', l.purchase_timeline)}${r('Message', l.message)}</table>
  <p style="margin-top:14px"><a href="${site()}/admin/leads">Open in the admin →</a></p></div>`;
}
function assignedHtml(l: NotifLead) {
  return `<div style="font-family:Georgia,serif;color:#1c1a17"><h2 style="margin:0 0 8px">A lead was assigned to you</h2>
  <table>${r('Lead', l.name)}${r('Email', l.email)}${r('Phone', l.phone)}${r('Reference', l.property_reference)}</table>
  <p style="margin-top:14px"><a href="${site()}/agent">Open your dashboard →</a></p></div>`;
}
