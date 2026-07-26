import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleAccessToken } from "../scan-gmail/google-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
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
    const supabaseAnonKey = Deno.env.get(
      "SUPABASE_ANON_KEY"
    );
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

    /*
      This client identifies the currently signed-in user.
    */
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

    /*
      This client securely reads the stored Google
      refresh token.
    */
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: connection,
      error: connectionError,
    } = await adminClient
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

    /*
      Read the request body once.

      Do not call req.json() again later.
    */
    const body = await req.json().catch(() => ({}));

    const action = body.action ?? "create";

    /*
      GOOGLE CALENDAR → OFFERLY
    */
    if (action === "list") {
      const now = new Date();

      const defaultStart = new Date(
        now.getFullYear(),
        now.getMonth() - 3,
        1
      );

      const defaultEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 7,
        1
      );

      const timeMin =
        body.timeMin ?? defaultStart.toISOString();

      const timeMax =
        body.timeMax ?? defaultEnd.toISOString();

      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
      });

      const googleResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const googleResponseText =
        await googleResponse.text();

      if (!googleResponse.ok) {
        console.error(
          "GOOGLE_CALENDAR_LIST_ERROR",
          {
            status: googleResponse.status,
            response: googleResponseText,
          }
        );

        throw new Error(
          `Google Calendar event retrieval failed (${googleResponse.status}): ${googleResponseText}`
        );
      }

      const googleData = JSON.parse(
        googleResponseText
      );

      const events = (googleData.items ?? [])
        .filter(
          (event: any) =>
            event.status !== "cancelled" &&
            (event.start?.dateTime ||
              event.start?.date)
        )
        .map((event: any) => ({
          id: `google-${event.id}`,

          google_event_id: event.id,

          title:
            event.summary || "Untitled event",

          description:
            event.description || "",

          location:
            event.location || "",

          start_time:
            event.start?.dateTime ??
            event.start?.date,

          end_time:
            event.end?.dateTime ??
            event.end?.date ??
            event.start?.dateTime ??
            event.start?.date,

          all_day: Boolean(
            event.start?.date
          ),

          google_event_link:
            event.htmlLink || null,

          source: "google",
        }));

      return jsonResponse({
        success: true,
        events,
      });
    }

    /*
      OFFERLY → GOOGLE CALENDAR
    */
    if (action === "create") {
      const {
        title,
        start_time,
        end_time,
        description,
        event_type,
      } = body;

      if (!title || !start_time) {
        throw new Error(
          "title and start_time are required"
        );
      }

      const startDate = new Date(start_time);

      if (Number.isNaN(startDate.getTime())) {
        throw new Error("Invalid start time");
      }

      const endDate = end_time
        ? new Date(end_time)
        : new Date(
            startDate.getTime() +
              60 * 60 * 1000
          );

      if (Number.isNaN(endDate.getTime())) {
        throw new Error("Invalid end time");
      }

      const googleResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
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
              dateTime:
                startDate.toISOString(),
            },

            end: {
              dateTime:
                endDate.toISOString(),
            },
          }),
        }
      );

      const googleResponseText =
        await googleResponse.text();

      if (!googleResponse.ok) {
        console.error(
          "GOOGLE_CALENDAR_CREATE_ERROR",
          {
            status: googleResponse.status,
            response: googleResponseText,
          }
        );

        throw new Error(
          `Google Calendar event creation failed (${googleResponse.status}): ${googleResponseText}`
        );
      }

      const googleEvent = JSON.parse(
        googleResponseText
      );

      return jsonResponse({
        success: true,
        google_event_id: googleEvent.id,
        google_event_link:
          googleEvent.htmlLink,
      });
    }

    throw new Error(
      `Unsupported Google Calendar action: ${action}`
    );
  } catch (error) {
    console.error(
      "GOOGLE_CALENDAR_FUNCTION_ERROR",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      400
    );
  }
});