import type { ApplicationRecord, GmailEmail } from "./types.ts";

export function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function containsPhrase(text: string, phrase: string): boolean {
  const term = normalize(phrase);
  return !!term && (` ${normalize(text)} `).includes(` ${term} `);
}

// Conservative: retain the current message; never classify quoted history as a new event.
export function currentMessage(body: string): string {
  return body.split(/\r?\n(?:On [^\n]+wrote:|[- ]*Original Message[- ]*|[- ]*Forwarded message[- ]*|From:\s[^\n]+\r?\nSent:|>)/i)[0]
    .split(/\r?\n-- ?\r?\n/)[0].trim();
}

export function isRecruitingCandidate(email: GmailEmail, apps: ApplicationRecord[]): boolean {
  const text = `${email.subject} ${email.from} ${currentMessage(email.body)}`;
  return /\b(applicat(?:ion|ions)|applied|candidate|recruit(?:er|ing|ment)?|hiring|interview|assessment|hirevue|hackerrank|codesignal|greenhouse|lever|workday|smartrecruiters|jobvite|employment|internship|position|offer|opportunity|opportunities|careers?)\b/i.test(text)
    || apps.some(app => containsPhrase(text, app.company));
}

export function buildGmailQuery(lastSyncedAt: string | null | undefined, until: number): string {
  const parsed = Date.parse(lastSyncedAt || "");
  const since = Number.isFinite(parsed) ? parsed - 300_000 : until - 30 * 86400_000;
  // Epoch seconds avoid Gmail's date-string timezone interpretation. Overlap is deduplicated.
  return `after:${Math.floor(since / 1000)} before:${Math.ceil(until / 1000)} -in:trash -in:spam -in:sent -in:drafts`;
}
