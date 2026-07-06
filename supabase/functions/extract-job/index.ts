import "@supabase/functions-js/edge-runtime.d.ts";
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

  try {
    const data = await req.json();

    const extracted = await extractJobWithAI(data);

    if (data.action === "save") {
      return await saveApplication(data, extracted);
    }

    return json(extracted);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

async function extractJobWithAI(data: any) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `
Extract job posting information.

Return ONLY valid JSON:
{
  "company": "",
  "role": "",
  "location": "",
  "salary": "",
  "employmentType": "",
  "workType": "",
  "confidence": 0
}

URL: ${data.url}
PAGE TITLE: ${data.title}
H1: ${data.h1}
PAGE TEXT:
${data.pageText}
      `,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("OpenAI error:", result);
    throw new Error("OpenAI request failed");
  }

  let outputText = result.output?.[0]?.content?.[0]?.text || "{}";

  outputText = outputText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(outputText);
  } catch {
    console.error("AI parse failed:", outputText);
    return {};
  }
}

async function saveApplication(data: any, extracted: any) {
  if (!data.userId) {
    return json({ error: "Missing userId" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date().toISOString().split("T")[0];

  const application = {
    user_id: data.userId,
    company: data.company || extracted.company || "",
    role: data.role || extracted.role || "",
    location: data.location || extracted.location || "",
    job_url: data.url,
    date_applied: today,
    status: "Applied",
    priority: "Medium",
    notes: "",
  };

  const { data: insertedApp, error } = await supabase
    .from("applications")
    .insert(application)
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({
    success: true,
    saved: true,
    application: insertedApp,
  });
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