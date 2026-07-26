import type {
  ApplicationRecord,
  ClassificationResult,
  GmailEmail,
} from "./types.ts";

export function classifyWithRules(
  email: GmailEmail
): ClassificationResult | null {
  const text = normalizeText(
    `${email.subject} ${email.from} ${email.snippet} ${email.body}`
  );

  const rejectionTerms = [
    "moving forward with other candidates",
    "move forward with other candidates",
    "will not be proceeding",
    "unable to move forward",
    "not selected",
    "position has been filled",
    "we regret to inform",
    "after careful consideration",
    "not moving forward",
  ];

  const offerTerms = [
    "pleased to offer",
    "offer letter",
    "extend an offer",
    "employment offer",
    "internship offer",
    "welcome to the team",
  ];

  const interviewTerms = [
    "schedule an interview",
    "interview availability",
    "interview confirmed",
    "select an interview time",
    "choose an interview time",
    "meet with the hiring team",
    "invite you to interview",
    "interview invitation",
  ];

  const assessmentTerms = [
    "coding assessment",
    "technical assessment",
    "online assessment",
    "coding challenge",
    "hackerrank",
    "codesignal",
    "hirevue",
    "take home assignment",
  ];

  if (containsAny(text, offerTerms)) {
    return createResult(
      "Offer",
      "Detected clear offer language",
      0.95
    );
  }

  if (containsAny(text, rejectionTerms)) {
    return createResult(
      "Rejected",
      "Detected rejection language",
      0.93
    );
  }

  if (containsAny(text, interviewTerms)) {
    return createResult(
      "Interview",
      "Detected interview language",
      0.9
    );
  }

  if (containsAny(text, assessmentTerms)) {
    return createResult(
      "Assessment",
      "Detected assessment language",
      0.9
    );
  }

  return null;
}

export async function classifyEmailWithAI(
  email: GmailEmail,
  applications: ApplicationRecord[]
): Promise<ClassificationResult | null> {
  const ruleResult = classifyWithRules(email);

  if (ruleResult) {
    return ruleResult;
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const applicationList = applications
    .map((app) => `- ${app.company} | ${app.role}`)
    .join("\n");

  const prompt = `
Classify this recruiting email.

Return only valid JSON:

{
  "eventType": "Assessment",
  "company": "",
  "role": "",
  "interviewDate": "",
  "reason": "",
  "confidence": 0
}

Allowed eventType values:
- Assessment
- Interview
- Offer
- Rejected
- Unrelated

Rules:
- Assessment means a coding test, HireVue, take-home assignment, or technical assessment.
- Interview means an interview request, scheduling email, or confirmed interview.
- Offer means a clear job or internship offer.
- Rejected means the candidate will not continue in the hiring process.
- Unrelated means the email does not clearly update an existing application.
- Match company and role to the user's application list when possible.
- interviewDate must be ISO 8601 when a confirmed date and time exist.
- Return an empty interviewDate when the email only asks for availability.

Applications:
${applicationList || "No applications found"}

Subject:
${email.subject}

From:
${email.from}

Date:
${email.date}

Snippet:
${email.snippet}

Body:
${email.body.slice(0, 10000)}
`;

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("OpenAI classification failed", result);
    return null;
  }

  let output =
    result.output?.[0]?.content?.[0]?.text || "{}";

  output = output
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(output);

    const validTypes = [
      "Assessment",
      "Interview",
      "Offer",
      "Rejected",
      "Unrelated",
    ];

    if (!validTypes.includes(parsed.eventType)) {
      return null;
    }

    return {
      eventType: parsed.eventType,
      company: parsed.company || "",
      role: parsed.role || "",
      interviewDate: parsed.interviewDate || "",
      reason: parsed.reason || "",
      confidence: Number(parsed.confidence) || 0,
    };
  } catch (error) {
    console.error("Could not parse AI response", {
      output,
      error,
    });

    return null;
  }
}

function createResult(
  eventType: ClassificationResult["eventType"],
  reason: string,
  confidence: number
): ClassificationResult {
  return {
    eventType,
    company: "",
    role: "",
    interviewDate: "",
    reason,
    confidence,
  };
}

function containsAny(
  text: string,
  phrases: string[]
): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}