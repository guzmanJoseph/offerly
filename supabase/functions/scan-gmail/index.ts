import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import type { GmailConnection } from "./types.ts";
import { syncSingleGmailAccount } from "./sync-account.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          success: false,
          error: "Missing Supabase environment variables",
        },
        500
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data: connections, error } = await supabase
      .from("gmail_connections")
      .select(
        "user_id, email, refresh_token, last_synced_at"
      )
      .eq("is_connected", true);

    if (error) {
      return json(
        {
          success: false,
          error: error.message,
        },
        500
      );
    }

    const results = [];

    for (const connection of
      (connections || []) as GmailConnection[]) {
      try {
        const result = await syncSingleGmailAccount(
          supabase,
          connection
        );

        results.push(result);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        console.error("GMAIL_ACCOUNT_SYNC_FAILED", {
          userId: connection.user_id,
          email: connection.email,
          error: message,
        });

        results.push({
          user_id: connection.user_id,
          email: connection.email,
          success: false,
          error: message,
        });
      }
    }

    const failedAccounts = results.filter(
      (result) => !result.success
    );

    return json({
      success: failedAccounts.length === 0,
      synced_accounts: results.length,
      failed_accounts: failedAccounts.length,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("SCAN_GMAIL_FUNCTION_FAILED", {
      error: message,
    });

    return json(
      {
        success: false,
        error: message,
      },
      500
    );
  }
});

function json(
  data: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}