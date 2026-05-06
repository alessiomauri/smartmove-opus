/**
 * Monday CRM integration.
 *
 * Per SMARTMOVE_BRIEF §4.5: the wrapper is fully designed but env-gated and
 * inert at launch. Every function checks `MONDAY_API_TOKEN` first; if unset,
 * it returns a "skipped" result without making a network call.
 *
 * Lead capture surfaces (contact form, viewing request, brochure request,
 * email selection click, newsletter, two-step landing page form) write to the
 * local `leads` table FIRST (always), then call this wrapper which currently
 * no-ops. When the user is ready, drop the env vars in and the wrapper
 * starts pushing real items — no code change required.
 *
 * DO NOT add `Resales.RegisterLead` here or anywhere. Smartmove's lead
 * pipeline lives entirely inside our ecosystem.
 */

export type SkipReason = 'monday-disabled' | 'monday-error';

export interface MondayResult<T = unknown> {
  ok: boolean;
  skipped?: boolean;
  reason?: SkipReason;
  data?: T;
  error?: string;
}

interface LeadPayload {
  name: string;
  email: string;
  phone?: string;
  bedrooms?: string;
  budgetTier?: string;
  purchaseTimeline?: string;
  contactMethod?: string;
  message?: string;
  source: string; // e.g. 'villas-up-to-2m', 'property-detail-villa-amara'
  propertyReference?: string;
  assignedAgent?: string;
  utm?: { source?: string; medium?: string; campaign?: string; id?: string };
  language: 'en' | 'es' | 'de' | 'fr' | 'it' | 'ru' | 'nl' | 'da' | 'sv' | 'pl' | 'no' | 'tr' | 'fi' | 'hu';
  submittedAt: string; // ISO timestamp
}

function disabled<T = unknown>(): MondayResult<T> {
  return { ok: true, skipped: true, reason: 'monday-disabled' };
}

function isEnabled(): { enabled: boolean; token?: string; boardId?: string } {
  const token = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;
  if (!token || !boardId) return { enabled: false };
  return { enabled: true, token, boardId };
}

/**
 * Create a new lead item in Monday. Returns the Monday item id on success
 * (so we can store it on our local `leads` row for later updates).
 */
export async function createLead(_payload: LeadPayload): Promise<MondayResult<{ itemId: string }>> {
  const cfg = isEnabled();
  if (!cfg.enabled) return disabled<{ itemId: string }>();

  // Implementation pending until the user flips the connection switch.
  // When activated: GraphQL mutation `create_item` against MONDAY_BOARD_ID
  // with a column-values map that follows MONDAY_COLUMN_MAPPING (env JSON).
  return { ok: false, error: 'Monday createLead not yet implemented' };
}

/**
 * Update an existing lead in Monday with Step-2 enrichment fields.
 */
export async function updateLead(
  _itemId: string,
  _patch: Partial<LeadPayload>
): Promise<MondayResult> {
  const cfg = isEnabled();
  if (!cfg.enabled) return disabled();
  return { ok: false, error: 'Monday updateLead not yet implemented' };
}

/**
 * Update lead status (new → contacted → qualified → converted/lost).
 */
export async function updateLeadStatus(
  _itemId: string,
  _status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
): Promise<MondayResult> {
  const cfg = isEnabled();
  if (!cfg.enabled) return disabled();
  return { ok: false, error: 'Monday updateLeadStatus not yet implemented' };
}
