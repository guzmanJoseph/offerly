import type { ApplicationRecord, ClassificationResult, GmailEmail } from "./types.ts";
import { containsPhrase, currentMessage, normalize } from "./filter.ts";

function companyName(value: string): string {
  return normalize(value).replace(/\b(inc|llc|corp|corporation|company|co)\b/g, "").replace(/\s+/g, " ").trim();
}
export function findMatchingApplication(apps: ApplicationRecord[], result: ClassificationResult, email: GmailEmail): ApplicationRecord | null {
  const company = companyName(result.company);
  const role = normalize(result.role);
  const text = `${email.subject} ${email.from} ${currentMessage(email.body)}`;
  // No substring scoring: "Meta" must not match "Metaverse", nor "Engineer" match every engineering role.
  if (!company || !role || !containsPhrase(text, result.company) || !containsPhrase(text, result.role)) return null;
  const matches = apps.filter(app => companyName(app.company) === company && normalize(app.role) === role);
  return matches.length === 1 ? matches[0] : null;
}

export function statusDecision(app: ApplicationRecord, event: ClassificationResult["eventType"], receivedAt: string): string | null {
  const time = Date.parse(receivedAt);
  if (!Number.isFinite(time)) return "Missing reliable email timestamp";
  if (app.gmail_event_at && time <= Date.parse(app.gmail_event_at)) return "Older or already applied email";
  // Preserve manual edits made after the last automatic update.
  if (app.updated_at && app.updated_at !== app.gmail_status_updated_at && time < Date.parse(app.updated_at)) return "Application was updated after this email";
  if (["Rejected", "Offer", "Withdrawn"].includes(app.status) && app.status !== event) return "Terminal status requires review";
  const ranks: Record<string, number> = { Applied: 1, Assessment: 2, Interview: 3, Offer: 4, Rejected: 4 };
  if (!ranks[event] || (ranks[event] < (ranks[app.status] || 0))) return "Status change requires review";
  return null;
}

export async function updateApplicationStatus(supabase: any, app: ApplicationRecord, event: ClassificationResult["eventType"], receivedAt: string): Promise<boolean> {
  const now = new Date().toISOString();
  let query = supabase.from("applications").update({ status: event, updated_at: now, gmail_event_at: receivedAt, gmail_status_updated_at: now })
    .eq("id", app.id).eq("user_id", app.user_id).eq("status", app.status);
  query = app.updated_at ? query.eq("updated_at", app.updated_at) : query.is("updated_at", null);
  const { data, error } = await query.select("id");
  if (error) throw new Error(`Could not update application: ${error.message}`);
  if (!data?.length) throw new Error("Application changed during sync; retry required");
  const changed = app.status !== event;
  app.status = event; app.updated_at = now; app.gmail_event_at = receivedAt; app.gmail_status_updated_at = now;
  return changed;
}
