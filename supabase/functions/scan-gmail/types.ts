export type ApplicationEventType =
  | "Applied"
  | "Assessment"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Withdrawn"
  | "Unrelated";

export type ClassificationResult = {
  eventType: ApplicationEventType;
  company: string;
  role: string;
  interviewDate: string;
  reason: string;
  confidence: number;
  evidence: string;
  ambiguous: boolean;
};

export type GmailEmail = {
  messageId: string;
  receivedAt: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
};

export type ApplicationRecord = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: string;
  updated_at: string | null;
  gmail_event_at: string | null;
  gmail_status_updated_at: string | null;
};

export type GmailConnection = {
  user_id: string;
  email: string;
  refresh_token: string;
  last_synced_at?: string | null;
};