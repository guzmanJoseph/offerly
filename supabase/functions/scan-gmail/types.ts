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
};

export type GmailEmail = {
  messageId: string;
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
};

export type GmailConnection = {
  user_id: string;
  email: string;
  refresh_token: string;
  last_synced_at?: string | null;
};