'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createAgentAccount, updateAgentProfile } from '@/lib/actions/team';
import type { TeamMember } from './types';

const TEAL = '#0f6c74';
const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20';

export default function TeamClient({ team }: { team: TeamMember[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  function add() {
    if (!name || !email || password.length < 8) { toast.error('Name, email, and an 8+ char password required'); return; }
    startTransition(async () => {
      try {
        await createAgentAccount({ name, email, password });
        toast.success(`Agent "${name}" created`, { description: 'They log in at /admin/login and land on their own dashboard.' });
        setName(''); setEmail(''); setPassword(''); router.refresh();
      } catch (e) { toast.error('Could not create agent', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-gray-500">Agent accounts + profiles. Each agent sees only the leads assigned to them.</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4" />Add an agent</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={input} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} placeholder="Temp password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button onClick={add} disabled={isPending} className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-60" style={{ backgroundColor: TEAL }}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Create agent account
        </button>
        <p className="text-xs text-gray-400 mt-2">On the live site this becomes an email invite (once Resend is wired in Phase D).</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Agents ({team.length})</h2>
        {team.length === 0 ? (
          <p className="text-sm text-gray-400">No agents yet.</p>
        ) : team.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-200">
            <button onClick={() => setOpenId(openId === m.id ? null : m.id)} className="w-full flex items-center justify-between px-5 py-3 text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.photo ? <img src={m.photo} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{m.name}{m.title ? <span className="text-gray-400 font-normal"> · {m.title}</span> : ''}</p>
                  <p className="text-xs text-gray-500 truncate">{m.email}{m.userId ? '' : ' · no login'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {m.userId && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />login</span>}
                {openId === m.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>
            {openId === m.id && <AgentProfileForm member={m} onSaved={() => router.refresh()} />}
          </div>
        ))}
      </section>
    </div>
  );
}

function AgentProfileForm({ member, onSaved }: { member: TeamMember; onSaved: () => void }) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    title: member.title ?? '', phone: member.phone ?? '', whatsapp: member.whatsapp ?? '', photo: member.photo ?? '',
    languages: (member.languages ?? []).join(', '),
    bioEn: member.bios?.en ?? '', bioEs: member.bios?.es ?? '', active: member.active,
  });
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    start(async () => {
      try {
        await updateAgentProfile(member.id, {
          title: f.title, phone: f.phone, whatsapp: f.whatsapp, photo: f.photo,
          languages: f.languages.split(',').map((s) => s.trim()).filter(Boolean),
          bios: { ...(member.bios ?? {}), en: f.bioEn, es: f.bioEs },
          active: f.active,
        });
        toast.success('Profile saved'); onSaved();
      } catch (e) { toast.error('Save failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }

  return (
    <div className="border-t border-gray-100 p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Title"><input className={input} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Senior Advisor" /></Field>
        <Field label="Photo URL"><input className={input} value={f.photo} onChange={(e) => set('photo', e.target.value)} placeholder="https://…" /></Field>
        <Field label="Phone"><input className={input} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+34 …" /></Field>
        <Field label="WhatsApp"><input className={input} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+34 …" /></Field>
        <Field label="Languages (comma-separated)"><input className={input} value={f.languages} onChange={(e) => set('languages', e.target.value)} placeholder="English, Spanish" /></Field>
        <Field label="Active"><select className={input} value={f.active ? 'yes' : 'no'} onChange={(e) => set('active', e.target.value === 'yes')}><option value="yes">Active</option><option value="no">Inactive</option></select></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Bio (EN)"><textarea rows={3} className={input} value={f.bioEn} onChange={(e) => set('bioEn', e.target.value)} /></Field>
        <Field label="Bio (ES)"><textarea rows={3} className={input} value={f.bioEs} onChange={(e) => set('bioEs', e.target.value)} /></Field>
      </div>
      <button onClick={save} disabled={pending} className={cn('inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-60')} style={{ backgroundColor: TEAL }}>
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}Save profile
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
