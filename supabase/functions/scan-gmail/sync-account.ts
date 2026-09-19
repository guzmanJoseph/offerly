import type { ApplicationRecord, GmailConnection } from "./types.ts";
import { refreshGoogleAccessToken } from "./google-auth.ts";
import { fetchGmailMessage, searchGmailMessages } from "./gmail.ts";
import { canAutoUpdate, classifyEmailWithAI, validateClassification } from "./classifier.ts";
import { findMatchingApplication, statusDecision, updateApplicationStatus } from "./applications.ts";
import { activityAlreadyExists, recordApplicationActivity } from "./activity.ts";
import { buildGmailQuery, isRecruitingCandidate } from "./filter.ts";

export async function syncSingleGmailAccount(supabase: any, connection: GmailConnection) {
  const startedAt = Date.now();
  const { data: applications, error: appError } = await supabase.from("applications")
    .select("id,user_id,company,role,status,updated_at,gmail_event_at,gmail_status_updated_at").eq("user_id", connection.user_id);
  if (appError) throw new Error(appError.message);
  const apps = (applications || []) as ApplicationRecord[];
  const accessToken = await refreshGoogleAccessToken(connection.refresh_token);
  const ids = await searchGmailMessages(accessToken, buildGmailQuery(connection.last_synced_at, startedAt));
  let processed = 0, updated = 0, failures = 0, complete = true;
  const results: Array<Record<string, unknown>> = [];

  // Load records in bounded chunks, avoiding Supabase's default row limit.
  const records = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from("gmail_message_results").select("message_id,outcome,classification")
      .eq("user_id", connection.user_id).eq("account_email", connection.email).in("message_id", ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const row of data || []) records.set(row.message_id, row);
  }

  for (const messageId of ids) {
    const prior = records.get(messageId);
    if (prior && prior.outcome !== "pending") continue;
    // Completed outcomes persist across bounded runs; the checkpoint stays put until all are handled.
    if (processed >= 75 || Date.now() - startedAt > 45_000) { complete = false; break; }
    try {
      const email = await fetchGmailMessage(accessToken, messageId);
      processed++;
      const save = async (outcome: string, reason: string, classification: unknown = null) => {
        const { error } = await supabase.from("gmail_message_results").upsert({
          user_id: connection.user_id, account_email: connection.email, message_id: messageId,
          outcome, reason, classification, subject: email.subject, received_at: email.receivedAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,account_email,message_id" });
        if (error) throw new Error(error.message);
      };
      if (await activityAlreadyExists(supabase, connection.user_id, messageId)) {
        await save("matched", "Activity already recorded"); continue;
      }
      if (!isRecruitingCandidate(email, apps)) {
        await save("ignored", "No recruiting signals"); continue;
      }
      const classification = prior?.classification
        ? validateClassification(prior.classification) : await classifyEmailWithAI(email);
      if (classification.eventType === "Unrelated") {
        await save("ignored", classification.reason, classification); continue;
      }
      // Cache before mutation: database retries don't pay for another model call.
      await save("pending", "Processing", classification);
      const app = findMatchingApplication(apps, classification, email);
      let reason = !canAutoUpdate(classification, email) ? "Uncertain event or missing supporting evidence"
        : !app ? "Company and role do not identify exactly one application" : null;
      // A retry can resume between updating the application and recording its activity.
      const resuming = !!prior?.classification && app?.gmail_event_at === email.receivedAt && app?.status === classification.eventType;
      if (!reason && app && !resuming) reason = statusDecision(app, classification.eventType, email.receivedAt);
      if (reason || !app) {
        await save("needs_review", reason || "No unique match", classification);
        results.push({ messageId, outcome: "needs_review", reason }); continue;
      }
      const changed = resuming ? false : await updateApplicationStatus(supabase, app, classification.eventType, email.receivedAt);
      await recordApplicationActivity({ supabase, userId: connection.user_id, application: app, classification, email });
      await save("matched", changed ? "Application updated" : "Event recorded", classification);
      if (changed) updated++;
      results.push({ messageId, outcome: "matched", applicationId: app.id, updated: changed });
    } catch (error) {
      failures++;
      results.push({ messageId, outcome: "failed", reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const { error } = await supabase.from("gmail_connections").update({
    ...(complete && failures === 0 ? { last_synced_at: new Date(startedAt).toISOString() } : {}),
    emails_processed: processed, applications_updated: updated, updated_at: new Date().toISOString(),
  }).eq("user_id", connection.user_id).eq("email", connection.email);
  if (error) throw new Error(error.message);
  return { user_id: connection.user_id, email: connection.email, success: failures === 0,
    incomplete: !complete, emails_found: ids.length, emails_processed: processed, applications_updated: updated, results };
}
