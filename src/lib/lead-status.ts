/** Call-first workflow the /admin/leads dashboard flips through. */
export const LEAD_STATUSES = ['new', 'called', 'selection_sent', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  called: 'Called',
  selection_sent: 'Selection sent',
  closed: 'Closed',
};

/** Sources a row can carry (incl. future quiz-*). */
export function sourceBadgeColor(source: string): { bg: string; fg: string } {
  if (source === 'viewing-request') return { bg: '#dff0e1', fg: '#2f6f4f' };
  if (source === 'brochure-request') return { bg: '#e7eef5', fg: '#3e6499' };
  if (source === 'contact-form') return { bg: '#f3e8cc', fg: '#8a6210' };
  if (source === 'newsletter') return { bg: '#efe7f4', fg: '#6d4d8a' };
  if (source.startsWith('quiz')) return { bg: '#fbe9dd', fg: '#a3622a' };
  return { bg: '#eeeeee', fg: '#555555' };
}
