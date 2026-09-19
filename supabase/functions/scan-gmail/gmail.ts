import type { GmailEmail } from "./types.ts";
import { extractEmailBody, getHeader } from "./email-parser.ts";

export async function searchGmailMessages(accessToken: string, query: string, maxResults = 500): Promise<string[]> {
  const ids = new Set<string>();
  let pageToken = "";
  do {
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Gmail search failed (${response.status})`);
    const data = await response.json();
    for (const message of data.messages || []) ids.add(message.id);
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return [...ids];
}

export async function fetchGmailMessage(accessToken: string, messageId: string): Promise<GmailEmail> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Gmail message fetch failed (${response.status})`);
  const data = await response.json();
  const headers = data.payload?.headers || [];
  return {
    messageId, receivedAt: new Date(Number(data.internalDate)).toISOString(),
    subject: getHeader(headers, "Subject"), from: getHeader(headers, "From"),
    date: getHeader(headers, "Date"), snippet: data.snippet || "",
    body: extractEmailBody(data.payload),
  };
}
