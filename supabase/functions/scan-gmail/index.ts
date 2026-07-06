import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: connections, error: connectionsError } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("is_connected", true);

  if (connectionsError) {
    return json({ error: connectionsError.message }, 500);
  }

  const allResults = [];

  for (const connection of connections || []) {
    try {
      const result = await syncSingleGmailAccount(supabase, connection);
      allResults.push(result);
    } catch (error) {
      console.error("Sync failed:", error);

      allResults.push({
        user_id: connection.user_id,
        email: connection.email,
        success: false,
        error: error.message,
      });
    }
  }

  return json({
    success: true,
    synced_accounts: allResults.length,
    results: allResults,
  });
});

async function syncSingleGmailAccount(supabase: any, connection: any) {
  if (!connection.refresh_token) {
    throw new Error("Missing refresh token");
  }

  const providerToken = await refreshGoogleAccessToken(connection.refresh_token);

  const { data: applications, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", connection.user_id);

  if (appsError) {
    throw new Error(appsError.message);
  }

  const query =
    'newer_than:60d (interview OR offer OR unfortunately OR rejected OR rejection OR "next steps" OR "congratulations")';

  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      query
    )}&maxResults=15`,
    {
      headers: {
        Authorization: `Bearer ${providerToken}`,
      },
    }
  );

  const searchData = await searchRes.json();

  if (!searchRes.ok) {
    throw new Error(searchData.error?.message || "Gmail search failed");
  }

  if (!searchData.messages) {
    await updateConnectionStats(supabase, connection, 0, 0);
    return {
      user_id: connection.user_id,
      email: connection.email,
      success: true,
      emails_processed: 0,
      applications_updated: 0,
      results: [],
    };
  }

  const results = [];
  let emailsProcessed = 0;
  let applicationsUpdated = 0;

  for (const message of searchData.messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      }
    );

    const msg = await msgRes.json();

    if (!msgRes.ok) {
      console.error("Message fetch failed:", msg);
      continue;
    }

    emailsProcessed++;

    const headers = msg.payload?.headers || [];

    const subject = getHeader(headers, "Subject");
    const from = getHeader(headers, "From");
    const date = getHeader(headers, "Date");
    const snippet = msg.snippet || "";

    const ai = await classifyEmailWithAI({
      subject,
      from,
      date,
      snippet,
      applications,
    });

    console.log("EMAIL CHECK:", {
      subject,
      from,
      snippet,
      ai,
    });

    if (!ai || ai.eventType === "Unrelated") {
      continue;
    }

    const matchingApp = findMatchingApplication(applications, ai);

    console.log("MATCH CHECK:", {
      aiCompany: ai?.company,
      aiRole: ai?.role,
      eventType: ai?.eventType,
      matchingApp,
    });

    if (!matchingApp) {
      results.push({
        subject,
        eventType: ai.eventType,
        company: ai.company,
        updated: false,
        reason: "No matching application found",
      });

      continue;
    }

    const statusRank: Record<string, number> = {
      Applied: 1,
      Interview: 2,
      Rejected: 3,
      Offer: 4,
    };

    const currentRank = statusRank[matchingApp.status] || 0;
    const newRank = statusRank[ai.eventType] || 0;

    if (newRank < currentRank) {
      results.push({
        subject,
        company: matchingApp.company,
        role: matchingApp.role,
        eventType: ai.eventType,
        updated: false,
        reason: "Skipped status downgrade",
      });

      continue;
    }

    const { error: updateError } = await supabase
      .from("applications")
      .update({
        status: ai.eventType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchingApp.id)
      .eq("user_id", connection.user_id);

    if (updateError) {
      console.error("Application update failed:", updateError);
      continue;
    }

    applicationsUpdated++;

    await supabase.from("gmail_sync_logs").insert({
      user_id: connection.user_id,
      application_id: matchingApp.id,
      company: matchingApp.company,
      role: matchingApp.role,
      event_type: ai.eventType,
      subject,
    });

    if (ai.eventType === "Interview" && ai.interviewDate) {
      await createInterviewEventIfNeeded({
        supabase,
        userId: connection.user_id,
        applicationId: matchingApp.id,
        company: matchingApp.company,
        subject,
        interviewDate: ai.interviewDate,
      });
    }

    results.push({
      subject,
      company: matchingApp.company,
      role: matchingApp.role,
      eventType: ai.eventType,
      updated: true,
    });
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
    emails_processed: emailsProcessed,
    applications_updated: applicationsUpdated,
    results,
  };
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Google refresh error:", data);
    throw new Error(data.error_description || "Could not refresh Google token");
  }

  return data.access_token;
}

async function classifyEmailWithAI({
  subject,
  from,
  date,
  snippet,
  applications,
}: any) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  const appList = applications
    .map((app: any) => `- ${app.company} | ${app.role}`)
    .join("\n");

  const prompt = `
You are Offerly's recruiting email assistant.

Decide if this email updates one of the user's job applications.

Only classify these:
- Interview
- Offer
- Rejected
- Unrelated

Return ONLY valid JSON:
{
  "eventType": "Interview",
  "company": "",
  "role": "",
  "interviewDate": "",
  "reason": "",
  "confidence": 0
}

Rules:
- Use "Unrelated" if this is not clearly about a job application.
- Use "Unrelated" if you are not confident which company it matches.
- interviewDate should be ISO format if a date/time is clear, otherwise "".
- company should match one of the current applications when possible.
- eventType must be exactly one of: Interview, Offer, Rejected, Unrelated.

Current applications:
${appList}

Email subject:
${subject}

Email from:
${from}

Email date:
${date}

Email snippet:
${snippet}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("OpenAI error:", result);
    return null;
  }

  let output = result.output?.[0]?.content?.[0]?.text || "{}";

  output = output.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(output);
  } catch {
    console.error("AI JSON parse failed:", output);
    return null;
  }
}

function findMatchingApplication(applications: any[], ai: any) {
  if (!ai.company) return null;

  return applications.find((app) => {
    const appCompany = app.company.toLowerCase().trim();
    const aiCompany = ai.company.toLowerCase().trim();

    return appCompany.includes(aiCompany) || aiCompany.includes(appCompany);
  });
}

async function createInterviewEventIfNeeded({
  supabase,
  userId,
  applicationId,
  company,
  subject,
  interviewDate,
}: any) {
  const { data: existingEvent } = await supabase
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .eq("start_time", interviewDate)
    .maybeSingle();

  if (existingEvent) return;

  await supabase.from("events").insert({
    user_id: userId,
    application_id: applicationId,
    title: `${company} Interview`,
    event_type: "Interview",
    description: subject,
    start_time: interviewDate,
  });
}

async function updateConnectionStats(
  supabase: any,
  connection: any,
  emailsProcessed: number,
  applicationsUpdated: number
) {
  await supabase
    .from("gmail_connections")
    .update({
      access_token: null,
      last_synced_at: new Date().toISOString(),
      emails_processed: emailsProcessed,
      applications_updated: applicationsUpdated,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", connection.user_id);
}

function getHeader(headers: any[], name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
    ?.value || "";
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}