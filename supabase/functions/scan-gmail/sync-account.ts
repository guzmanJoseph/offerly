import type {
  ApplicationRecord,
  GmailConnection,
} from "./types.ts";

import { refreshGoogleAccessToken } from "./google-auth.ts";
import {
  fetchGmailMessages,
  searchGmailMessages,
} from "./gmail.ts";
import { classifyEmailWithAI } from "./classifier.ts";
import {
  findMatchingApplication,
  updateApplicationStatus,
} from "./applications.ts";
import {
  activityAlreadyExists,
  recordApplicationActivity,
} from "./activity.ts";

type SyncAccountResult = {
  user_id: string;
  email: string;
  success: boolean;
  emails_found: number;
  emails_processed: number;
  applications_updated: number;
  results: Array<Record<string, unknown>>;
};

export async function syncSingleGmailAccount(
  supabase: any,
  connection: GmailConnection
): Promise<SyncAccountResult> {
  const accessToken = await refreshGoogleAccessToken(
    connection.refresh_token
  );

  const applications = await getApplications(
    supabase,
    connection.user_id
  );

  const query = buildGmailQuery(connection.last_synced_at);

  const messageIds = await searchGmailMessages(
    accessToken,
    query,
    50
  );

  const emails = await fetchGmailMessages(
    accessToken,
    messageIds
  );

  let emailsProcessed = 0;
  let applicationsUpdated = 0;

  const results: Array<Record<string, unknown>> = [];

  for (const email of emails) {
    try {
      const alreadyProcessed = await activityAlreadyExists(
        supabase,
        connection.user_id,
        email.messageId
      );

      if (alreadyProcessed) {
        results.push({
          messageId: email.messageId,
          subject: email.subject,
          updated: false,
          reason: "Already processed",
        });

        continue;
      }

      emailsProcessed++;

      const classification = await classifyEmailWithAI(
        email,
        applications
      );

      if (
        !classification ||
        classification.eventType === "Unrelated"
      ) {
        results.push({
          messageId: email.messageId,
          subject: email.subject,
          updated: false,
          reason:
            classification?.reason ||
            "Email was unrelated",
        });

        continue;
      }

      const matchingApplication =
        findMatchingApplication(
          applications,
          classification,
          email
        );

      if (!matchingApplication) {
        results.push({
          messageId: email.messageId,
          subject: email.subject,
          eventType: classification.eventType,
          company: classification.company,
          role: classification.role,
          updated: false,
          reason: "No matching application found",
        });

        continue;
      }

      await updateApplicationStatus(
        supabase,
        matchingApplication,
        classification.eventType
      );

      await recordApplicationActivity({
        supabase,
        userId: connection.user_id,
        application: matchingApplication,
        classification,
        email,
      });

      matchingApplication.status =
        classification.eventType;

      applicationsUpdated++;

      results.push({
        messageId: email.messageId,
        subject: email.subject,
        applicationId: matchingApplication.id,
        company: matchingApplication.company,
        role: matchingApplication.role,
        eventType: classification.eventType,
        confidence: classification.confidence,
        updated: true,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error("EMAIL_PROCESSING_FAILED", {
        messageId: email.messageId,
        subject: email.subject,
        error: message,
      });

      results.push({
        messageId: email.messageId,
        subject: email.subject,
        updated: false,
        reason: message,
      });
    }
  }

  await updateConnectionStats(
    supabase,
    connection,
    emailsProcessed,
    applicationsUpdated
  );

  return {
    user_id: connection.user_id,
    email: connection.email,
    success: true,
    emails_found: messageIds.length,
    emails_processed: emailsProcessed,
    applications_updated: applicationsUpdated,
    results,
  };
}

async function getApplications(
  supabase: any,
  userId: string
): Promise<ApplicationRecord[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, user_id, company, role, status")
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Could not load applications: ${error.message}`
    );
  }

  return data || [];
}

function buildGmailQuery(
  lastSyncedAt?: string | null
): string {
  const recruitingTerms = [
    "interview",
    "assessment",
    "coding challenge",
    "hackerrank",
    "codesignal",
    "hirevue",
    "offer",
    "offer letter",
    "moving forward",
    "not selected",
    "application update",
  ];

  const termQuery = recruitingTerms
    .map((term) => `"${term}"`)
    .join(" OR ");

  if (!lastSyncedAt) {
    return `newer_than:30d (${termQuery})`;
  }

  const parsedDate = new Date(lastSyncedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return `newer_than:30d (${termQuery})`;
  }

  const afterDate = [
    parsedDate.getUTCFullYear(),
    String(parsedDate.getUTCMonth() + 1).padStart(2, "0"),
    String(parsedDate.getUTCDate()).padStart(2, "0"),
  ].join("/");

  return `after:${afterDate} (${termQuery})`;
}

async function updateConnectionStats(
  supabase: any,
  connection: GmailConnection,
  emailsProcessed: number,
  applicationsUpdated: number
): Promise<void> {
  const { error } = await supabase
    .from("gmail_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      emails_processed: emailsProcessed,
      applications_updated: applicationsUpdated,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", connection.user_id)
    .eq("email", connection.email);

  if (error) {
    console.error("CONNECTION_STATS_UPDATE_FAILED", {
      userId: connection.user_id,
      email: connection.email,
      error: error.message,
    });
  }
}