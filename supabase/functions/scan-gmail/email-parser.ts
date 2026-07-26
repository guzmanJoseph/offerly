export function extractEmailBody(payload: any): string {
  if (!payload) return "";

  const plainTextPart = findMimePart(payload, "text/plain");

  if (plainTextPart?.body?.data) {
    return decodeBase64Url(plainTextPart.body.data);
  }

  const htmlPart = findMimePart(payload, "text/html");

  if (htmlPart?.body?.data) {
    return stripHtml(
      decodeBase64Url(htmlPart.body.data)
    );
  }

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);

    return payload.mimeType === "text/html"
      ? stripHtml(decoded)
      : decoded;
  }

  return "";
}

export function getHeader(
  headers: any[],
  name: string
): string {
  return (
    headers.find(
      (header) =>
        header.name?.toLowerCase() === name.toLowerCase()
    )?.value || ""
  );
}

function findMimePart(
  payload: any,
  mimeType: string
): any {
  if (payload?.mimeType === mimeType) {
    return payload;
  }

  for (const part of payload?.parts || []) {
    const result = findMimePart(part, mimeType);

    if (result) {
      return result;
    }
  }

  return null;
}

function decodeBase64Url(data: string): string {
  if (!data) return "";

  const normalized = data
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = normalized.padEnd(
    normalized.length +
      ((4 - (normalized.length % 4)) % 4),
    "="
  );

  try {
    const binary = atob(padded);

    const bytes = Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0)
    );

    return new TextDecoder("utf-8").decode(bytes);
  } catch (error) {
    console.error("Email decoding failed", error);
    return "";
  }
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}