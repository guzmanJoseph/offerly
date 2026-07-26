import type {
  ApplicationRecord,
  ClassificationResult,
  GmailEmail,
} from "./types.ts";

export function findMatchingApplication(
  applications: ApplicationRecord[],
  classification: ClassificationResult,
  email: GmailEmail
): ApplicationRecord | null {
  if (!applications.length) return null;

  const rankedApplications = applications
    .map((application) => ({
      application,
      score: calculateMatchScore(
        application,
        classification,
        email
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const bestMatch = rankedApplications[0];

  if (!bestMatch || bestMatch.score < 40) {
    return null;
  }

  return bestMatch.application;
}

export async function updateApplicationStatus(
  supabase: any,
  application: ApplicationRecord,
  eventType: ClassificationResult["eventType"]
): Promise<void> {
  if (
    eventType === "Unrelated" ||
    eventType === "Applied" ||
    eventType === "Withdrawn"
  ) {
    return;
  }

  const statusRank: Record<string, number> = {
    Applied: 1,
    Assessment: 2,
    Interview: 3,
    Rejected: 4,
    Offer: 5,
  };

  const currentRank =
    statusRank[application.status] || 0;

  const newRank = statusRank[eventType] || 0;

  if (newRank < currentRank) {
    console.log("Skipping status downgrade", {
      applicationId: application.id,
      currentStatus: application.status,
      proposedStatus: eventType,
    });

    return;
  }

  const { error } = await supabase
    .from("applications")
    .update({
      status: eventType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", application.id)
    .eq("user_id", application.user_id);

  if (error) {
    throw new Error(
      `Could not update application: ${error.message}`
    );
  }
}

function calculateMatchScore(
  application: ApplicationRecord,
  classification: ClassificationResult,
  email: GmailEmail
): number {
  const emailText = normalizeText(
    `${email.subject} ${email.from} ${email.snippet} ${email.body}`
  );

  const applicationCompany = normalizeText(
    application.company
  );

  const applicationRole = normalizeText(
    application.role
  );

  const classifiedCompany = normalizeText(
    classification.company
  );

  const classifiedRole = normalizeText(
    classification.role
  );

  let score = 0;

  if (
    classifiedCompany &&
    companiesMatch(
      applicationCompany,
      classifiedCompany
    )
  ) {
    score += 70;
  }

  if (
    applicationCompany &&
    emailText.includes(applicationCompany)
  ) {
    score += 55;
  }

  if (
    classifiedRole &&
    rolesMatch(applicationRole, classifiedRole)
  ) {
    score += 35;
  }

  score += countMatchingRoleWords(
    applicationRole,
    emailText
  ) * 5;

  return score;
}

function companiesMatch(
  firstCompany: string,
  secondCompany: string
): boolean {
  if (!firstCompany || !secondCompany) {
    return false;
  }

  return (
    firstCompany.includes(secondCompany) ||
    secondCompany.includes(firstCompany)
  );
}

function rolesMatch(
  firstRole: string,
  secondRole: string
): boolean {
  if (!firstRole || !secondRole) {
    return false;
  }

  return (
    firstRole.includes(secondRole) ||
    secondRole.includes(firstRole)
  );
}

function countMatchingRoleWords(
  role: string,
  emailText: string
): number {
  const importantWords = role
    .split(" ")
    .filter((word) => word.length >= 4);

  return importantWords.filter((word) =>
    emailText.includes(word)
  ).length;
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(inc|llc|corp|corporation|company|co)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}