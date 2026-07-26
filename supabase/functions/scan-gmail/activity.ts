import type {
  ApplicationRecord,
  ClassificationResult,
  GmailEmail,
} from "./types.ts";

type RecordActivityOptions = {
  supabase: any;
  userId: string;
  application: ApplicationRecord;
  classification: ClassificationResult;
  email: GmailEmail;
};

export async function recordApplicationActivity({
  supabase,
  userId,
  application,
  classification,
  email,
}: RecordActivityOptions): Promise<void> {
  const eventDate =
    classification.interviewDate || email.date || null;

  const { error } = await supabase
    .from("application_activities")
    .insert({
      user_id: userId,
      application_id: application.id,
      event_type: classification.eventType,
      source: "gmail",
      gmail_message_id: email.messageId,
      subject: email.subject,
      sender: email.from,
      event_date: eventDate,
      confidence: classification.confidence,
      metadata: {
        company: classification.company,
        role: classification.role,
        reason: classification.reason,
        snippet: email.snippet,
      },
    });

  if (!error) {
    return;
  }

  // Ignore duplicate Gmail messages.
  if (error.code === "23505") {
    console.log("Activity already recorded", {
      gmailMessageId: email.messageId,
    });

    return;
  }

  throw new Error(
    `Could not record application activity: ${error.message}`
  );
}

export async function activityAlreadyExists(
  supabase: any,
  userId: string,
  gmailMessageId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("application_activities")
    .select("id")
    .eq("user_id", userId)
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not check application activity: ${error.message}`
    );
  }

  return Boolean(data);
}