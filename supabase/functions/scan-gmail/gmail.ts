import type { GmailEmail } from "./types.ts";
import { extractEmailBody, getHeader } from "./email-parser.ts";

type GmailSearchResponse = {
  messages?: Array<{
    id: string;
    threadId: string;
  }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export async function searchGmailMessages(
  accessToken: string,
  query: string,
  maxResults = 50
): Promise<string[]> {
  const url =
    "https://gmail.googleapis.com/gmail/v1/users/me/messages" +
    `?q=${encodeURIComponent(query)}` +
    `&maxResults=${maxResults}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json()) as GmailSearchResponse & {
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    console.error("GMAIL_SEARCH_FAILED", {
      status: response.status,
      query,
      response: data,
    });

    throw new Error(
      `Gmail search failed (${response.status}): ${
        data.error?.message || "Unknown Gmail error"
      }`
    );
  }

  return (data.messages || []).map((message) => message.id);
}

export async function fetchGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailEmail> {
  const url =
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
    `${messageId}?format=full`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("GMAIL_MESSAGE_FETCH_FAILED", {
      status: response.status,
      messageId,
      response: data,
    });

    throw new Error(
      `Could not fetch Gmail message ${messageId}: ${
        data?.error?.message || "Unknown Gmail error"
      }`
    );
  }

  const headers = data.payload?.headers || [];

  return {
    messageId,
    subject: getHeader(headers, "Subject"),
    from: getHeader(headers, "From"),
    date: getHeader(headers, "Date"),
    snippet: data.snippet || "",
    body: extractEmailBody(data.payload),
  };
}

export async function fetchGmailMessages(
  accessToken: string,
  messageIds: string[]
): Promise<GmailEmail[]> {
  const emails: GmailEmail[] = [];

  for (const messageId of messageIds) {
    try {
      const email = await fetchGmailMessage(
        accessToken,
        messageId
      );

      emails.push(email);
    } catch (error) {
      console.error("Skipping Gmail message", {
        messageId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  return emails;
}