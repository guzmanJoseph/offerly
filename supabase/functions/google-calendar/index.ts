import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleAccessToken } from "../scan-gmail/google-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Missing required Supabase environment variables"
      );
    }

    // Client used to identify the currently signed-in user.
    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Server client used to securely read the saved Google token.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      title,
      start_time,
      end_time,
      description,
      event_type,
    } = await req.json();

    if (!title || !start_time) {
      throw new Error(
        "title and start_time are required"
      );
    }

    const { data: connection, error: connectionError } =
      await adminClient
        .from("gmail_connections")
        .select("refresh_token")
        .eq("user_id", user.id)
        .eq("is_connected", true)
        .maybeSingle();

    if (connectionError) {
      throw connectionError;
    }

    if (!connection?.refresh_token) {
      throw new Error(
        "No Google refresh token found. Reconnect Google."
      );
    }

    const accessToken =
      await refreshGoogleAccessToken(
        connection.refresh_token
      );

    const startDate = new Date(start_time);

    if (Number.isNaN(startDate.getTime())) {
      throw new Error("Invalid start time");
    }

    const endDate = end_time
      ? new Date(end_time)
      : new Date(
          startDate.getTime() + 60 * 60 * 1000
        );

    if (Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid end time");
    }

    const googleResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: title,
          description: [
            event_type
              ? `Offerly event type: ${event_type}`
              : "",
            description || "",
            "Created by Offerly",
          ]
            .filter(Boolean)
            .join("\n\n"),

          start: {
            dateTime: startDate.toISOString(),
          },

          end: {
            dateTime: endDate.toISOString(),
          },
        }),
      }
    );

    const googleResponseText =
      await googleResponse.text();

    if (!googleResponse.ok) {
      console.error("GOOGLE_CALENDAR_ERROR", {
        status: googleResponse.status,
        response: googleResponseText,
      });

      throw new Error(
        `Google Calendar event creation failed (${googleResponse.status}): ${googleResponseText}`
      );
    }

    const googleEvent = JSON.parse(
      googleResponseText
    );

    return new Response(
      JSON.stringify({
        success: true,
        google_event_id: googleEvent.id,
        google_event_link: googleEvent.htmlLink,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("GOOGLE_CALENDAR_FUNCTION_ERROR", error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});