import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/importGmail.css";

export default function GmailImport() {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState([]);

  useEffect(() => {
    fetchConnection();
    fetchSyncLogs();
    saveGmailConnection();
  }, []);

  async function fetchConnection() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) console.error(error);

    setConnection(data);
    setLoading(false);
  }

  function formatDate(date) {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  }

  async function handleTestSync() {
    const { data, error } = await supabase.functions.invoke("scan-gmail");

    console.log("SYNC DATA:", data);
    console.log("SYNC ERROR:", error);

    await fetchConnection();
    await fetchSyncLogs();
  }

  async function handleConnectGmail() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
      ].join(" "),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
      redirectTo: `${window.location.origin}/gmail-import`,
    },
  });

  if (error) {
    console.error("Google connection failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
  }
}

  async function saveGmailConnection() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Could not get session:", sessionError);
    return;
  }

  if (!session?.user) return;

  const providerToken = session.provider_token;
  const providerRefreshToken =
    session.provider_refresh_token;

  console.log("Google token status:", {
    hasProviderToken: Boolean(providerToken),
    hasProviderRefreshToken: Boolean(
      providerRefreshToken
    ),
  });

  // Do not create or overwrite the database row
  // unless Google returned a refresh token.
  if (!providerRefreshToken) {
    console.log(
      "No Google refresh token found. Reconnect Gmail and approve access."
    );
    return;
  }

  let googleEmail = session.user.email;

  if (providerToken) {
    try {
      const googleUserResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        }
      );

      if (googleUserResponse.ok) {
        const googleUser =
          await googleUserResponse.json();

        googleEmail =
          googleUser.email || googleEmail;
      }
    } catch (error) {
      console.error(
        "Could not retrieve Google account email:",
        error
      );
    }
  }

  const { error: upsertError } = await supabase
    .from("gmail_connections")
    .upsert(
      {
        user_id: session.user.id,
        email: googleEmail,
        access_token: providerToken || null,
        refresh_token: providerRefreshToken,
        is_connected: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (upsertError) {
    console.error("Error saving Gmail connection:", {
      message: upsertError.message,
      details: upsertError.details,
      hint: upsertError.hint,
      code: upsertError.code,
    });

    return;
  }

  console.log(
    "Gmail refresh token saved successfully."
  );
}

  async function fetchSyncLogs() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("gmail_sync_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error(error);
      return;
    }

    setSyncLogs(data);
  }

  async function handleDisconnectGmail() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("gmail_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setConnection(null);
  }

  if (loading) return <p>Loading Gmail integration...</p>;

  return (
    <div className="gmail-page">
      <div className="page-header">
        <div>
          <h1>Gmail Integration</h1>
          <p>
            Automatically detect interview invites, offers, and rejections from
            your inbox.
          </p>
        </div>
      </div>

      <div className="gmail-card">
        <div className="gmail-card-header">
          <div>
            <h2>Email Sync</h2>
            <p>Gmail will sync automatically in the background.</p>
          </div>

          <span
            className={
              connection?.is_connected
                ? "connection-badge connected"
                : "connection-badge disconnected"
            }
          >
            {connection?.is_connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {connection?.is_connected ? (
          <>
            <div className="gmail-details">
              <p>
                <strong>Email:</strong> {connection.email || "Connected Gmail"}
              </p>

              <p>
                <strong>Last synced:</strong>{" "}
                {formatDate(connection.last_synced_at)}
              </p>
            </div>

            <div className="gmail-stats">
              <div className="gmail-stat">
                <h3>{connection.emails_processed || 0}</h3>
                <p>Emails Processed</p>
              </div>

              <div className="gmail-stat">
                <h3>{connection.applications_updated || 0}</h3>
                <p>Applications Updated</p>
              </div>

            <div className="gmail-history">
              <h3>Latest Activity</h3>

              {syncLogs.length === 0 ? (
                <p>No recent Gmail activity.</p>
              ) : (
                syncLogs.map((log) => (
                  <div key={log.id} className="gmail-history-item">
                    <div>
                      <strong>{log.company}</strong>
                      <p>{log.role}</p>
                    </div>

                    <div>
                      <span>{log.event_type}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>

            <div className="gmail-actions">
              <button className="primary-btn" onClick={handleConnectGmail}>
                Reconnect Gmail
              </button>

              <button className="danger-btn" onClick={handleDisconnectGmail}>
                Disconnect Gmail
              </button>

              <button
                className="primary-btn"
                onClick={handleTestSync}
              >
                Test Gmail Sync
              </button>
              
            </div>
          </>
        ) : (
          <div className="gmail-empty">
            <p>Connect Gmail to start automatic email detection.</p>

            <button className="primary-btn" onClick={handleConnectGmail}>
              Connect Gmail
            </button>
          </div>
        )}
      </div>
    </div>
  );
}