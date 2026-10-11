import { useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiMail,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { supabase } from "../lib/supabaseClient";
import "../styles/importGmail.css";

function formatDate(date) {
  if (!date) return "Never";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatEvent(event) {
  if (!event) return "Hiring update";
  return event.charAt(0).toUpperCase() + event.slice(1).toLowerCase();
}

function getGmailUrl(email) {
  return "https://mail.google.com/mail/?authuser=" +
    encodeURIComponent(email.account_email) +
    "#all/" +
    encodeURIComponent(email.message_id);
}

export default function GmailImport() {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState([]);
  const [reviewEmails, setReviewEmails] = useState([]);
  const [reviewError, setReviewError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  useEffect(() => {
    fetchConnection();
    fetchSyncLogs();
    fetchReviewEmails();
    saveGmailConnection();
  }, []);

  async function fetchConnection() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setConnection(null);
        return;
      }

      const { data, error } = await supabase
        .from("gmail_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setConnection(data);
    } catch (error) {
      console.error("Could not load Gmail connection:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReviewEmails() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("gmail_message_results")
      .select("account_email,message_id,subject,reason,classification,received_at")
      .eq("user_id", user.id)
      .eq("outcome", "needs_review")
      .order("received_at", { ascending: false })
      .limit(20);

    if (error) {
      setReviewError("Could not load emails needing review.");
      return;
    }

    setReviewError("");
    setReviewEmails(data || []);
  }

  async function fetchSyncLogs() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("application_activities")
      .select("id,event_type,metadata,subject,created_at")
      .eq("user_id", user.id)
      .eq("source", "gmail")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Could not load Gmail activity:", error);
      return;
    }

    setSyncLogs(data || []);
  }

  async function handleTestSync() {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("scan-gmail");
      if (error) throw error;

      const results = data?.results || [];
      const emailsChecked = results.reduce(
        (total, result) => total + (result.emails_processed || 0),
        0
      );
      const statusesUpdated = results.reduce(
        (total, result) => total + (result.applications_updated || 0),
        0
      );
      const incomplete = results.some((result) => result.incomplete);
      const failed = !data?.success || results.some((result) => !result.success);

      let title = "Sync complete";
      let type = "success";
      let description =
        "Checked " + emailsChecked + " emails and updated " +
        statusesUpdated + " application " +
        (statusesUpdated === 1 ? "status." : "statuses.");

      if (incomplete) {
        title = "Sync paused with progress saved";
        type = "warning";
        description =
          "Checked " + emailsChecked + " emails and updated " +
          statusesUpdated + " application " +
          (statusesUpdated === 1 ? "status. " : "statuses. ") +
          "Run sync again to continue through the remaining emails.";
      } else if (failed) {
        title = "Sync finished with some errors";
        type = "warning";
        description =
          "Checked " + emailsChecked + " emails and updated " +
          statusesUpdated + " application " +
          (statusesUpdated === 1 ? "status. " : "statuses. ") +
          "Some emails could not be processed; run sync again to retry.";
      }

      setSyncMessage({ title, description, type });
      await Promise.all([fetchConnection(), fetchSyncLogs(), fetchReviewEmails()]);
    } catch (error) {
      console.error("Gmail sync failed:", error);
      setSyncMessage({
        title: "Sync could not finish",
        description: "Offerly couldn't confirm the result. Check Latest application updates and Needs your review, then try again.",
        type: "error",
      });
    } finally {
      setSyncing(false);
    }
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
        redirectTo: window.location.origin + "/gmail-import",
      },
    });

    if (error) {
      console.error("Google connection failed:", error);
      setSyncMessage({
        title: "Could not connect Gmail",
        description: "Please try connecting your Google account again.",
        type: "error",
      });
    }
  }

  async function saveGmailConnection() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) return;

    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;

    if (!providerRefreshToken) return;

    let googleEmail = session.user.email;

    if (providerToken) {
      try {
        const response = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: "Bearer " + providerToken } }
        );

        if (response.ok) {
          const googleUser = await response.json();
          googleEmail = googleUser.email || googleEmail;
        }
      } catch (error) {
        console.error("Could not retrieve Google account email:", error);
      }
    }

    const { error } = await supabase
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
        { onConflict: "user_id" }
      );

    if (error) console.error("Error saving Gmail connection:", error);
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
      console.error("Could not disconnect Gmail:", error);
      setSyncMessage({
        title: "Could not disconnect Gmail",
        description: "Please try again.",
        type: "error",
      });
      return;
    }

    setConnection(null);
    setReviewEmails([]);
    setSyncMessage({
      title: "Gmail disconnected",
      description: "Future Gmail syncs are stopped. Existing applications and activity history remain in Offerly.",
      type: "success",
    });
  }

  if (loading) {
    return (
      <section className="gmail-page">
        <div className="gmail-page-heading">
          <span className="gmail-eyebrow">Email updates</span>
          <h1>Gmail sync</h1>
          <p>Loading your Gmail connection…</p>
        </div>
        <div className="gmail-loading-card" role="status">
          <span className="gmail-loading-spinner" aria-hidden="true" />
          Checking connection and recent activity
        </div>
      </section>
    );
  }

  const connected = Boolean(connection?.is_connected);

  return (
    <section className="gmail-page">
      <header className="gmail-page-heading">
        <div>
          <span className="gmail-eyebrow">Email updates</span>
          <h1>Gmail sync</h1>
          <p>Review what Offerly reads and exactly which application details it can update.</p>
        </div>
      </header>

      {syncMessage && (
        <div className={"gmail-notice gmail-notice-" + syncMessage.type} role="status">
          <span className="gmail-notice-icon" aria-hidden="true">
            {syncMessage.type === "success" ? <FiCheckCircle /> : <FiAlertCircle />}
          </span>
          <div>
            <strong>{syncMessage.title}</strong>
            <p>{syncMessage.description}</p>
          </div>
          <button
            type="button"
            className="gmail-notice-dismiss"
            aria-label="Dismiss message"
            onClick={() => setSyncMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      <section className="gmail-connection-card" aria-labelledby="gmail-connection-title">
        <div className="gmail-connection-top">
          <div className="gmail-connection-identity">
            <span className="gmail-brand-icon"><FiMail aria-hidden="true" /></span>
            <div>
              <span className="gmail-eyebrow">Your account</span>
              <h2 id="gmail-connection-title">
                {connected ? connection.email || "Gmail connected" : "Connect your Gmail"}
              </h2>
              <p>
                {connected
                  ? "Background sync is enabled for this account."
                  : "Connect an account to find hiring updates in your inbox."}
              </p>
            </div>
          </div>
          <span className={"gmail-connection-badge " + (connected ? "is-connected" : "is-disconnected")}>
            <span aria-hidden="true" />
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {connected ? (
          <>
            <div className="gmail-metrics">
              <article className="gmail-metric-card">
                <span className="gmail-metric-icon"><FiMail aria-hidden="true" /></span>
                <div>
                  <p>Emails checked in last sync</p>
                  <strong>{connection.emails_processed ?? 0}</strong>
                </div>
              </article>
              <article className="gmail-metric-card">
                <span className="gmail-metric-icon gmail-metric-icon-green"><FiActivity aria-hidden="true" /></span>
                <div>
                  <p>Application statuses updated</p>
                  <strong>{connection.applications_updated ?? 0}</strong>
                </div>
              </article>
              <div className="gmail-last-sync">
                <FiClock aria-hidden="true" />
                <span>Last synced</span>
                <strong>{formatDate(connection.last_synced_at)}</strong>
              </div>
            </div>

            <div className="gmail-actions">
              <button
                className="gmail-button gmail-button-primary"
                onClick={handleTestSync}
                disabled={syncing}
                type="button"
              >
                <FiRefreshCw className={syncing ? "gmail-spinning" : ""} aria-hidden="true" />
                {syncing ? "Syncing inbox…" : "Sync now"}
              </button>
              <button className="gmail-button gmail-button-secondary" onClick={handleConnectGmail} type="button">
                Reconnect account
              </button>
              <button className="gmail-button gmail-button-danger" onClick={handleDisconnectGmail} type="button">
                Disconnect
              </button>
              {syncing && <span className="gmail-sync-inline" role="status">Offerly is checking recruiting emails and matching them to your saved applications.</span>}
            </div>
          </>
        ) : (
          <div className="gmail-connect-panel">
            <p>
              Gmail access is read-only. Offerly looks for recruiting messages and uses them
              to update matching application statuses.
            </p>
            <button className="gmail-button gmail-button-primary" onClick={handleConnectGmail} type="button">
              <FiMail aria-hidden="true" />
              Connect Gmail
            </button>
          </div>
        )}
      </section>

      <section className="gmail-change-card" aria-labelledby="gmail-change-title">
        <div className="gmail-section-heading">
          <span className="gmail-section-icon"><FiShield aria-hidden="true" /></span>
          <div>
            <h2 id="gmail-change-title">What changes when Gmail syncs?</h2>
            <p>Offerly only changes the fields below when a message is clear and matches one saved application.</p>
          </div>
        </div>
        <div className="gmail-change-grid">
          <article className="gmail-change-item gmail-change-allowed">
            <span className="gmail-change-mark" aria-hidden="true">✓</span>
            <div>
              <h3>Can update</h3>
              <p>An application’s <strong>status</strong> (for example, Assessment, Interview, Offer, or Rejected) and its Gmail activity history.</p>
            </div>
          </article>
          <article className="gmail-change-item gmail-change-limited">
            <span className="gmail-change-mark" aria-hidden="true"><FiShield /></span>
            <div>
              <h3>Will not change</h3>
              <p>Company, role, notes, or email content. Gmail is read-only: Offerly won’t send, move, or delete messages.</p>
            </div>
          </article>
        </div>
        <div className="gmail-review-rule">
          <FiAlertCircle aria-hidden="true" />
          <p>If an email is uncertain or does not match exactly one application, Offerly leaves the application unchanged and lists the email under <strong>Needs your review</strong>.</p>
        </div>
      </section>

      {connected && (
        <>
          <section className="gmail-content-card" aria-labelledby="gmail-review-title">
            <div className="gmail-section-heading gmail-section-heading-spaced">
              <span className="gmail-section-icon gmail-section-icon-amber"><FiAlertCircle aria-hidden="true" /></span>
              <div>
                <div className="gmail-heading-with-count">
                  <h2 id="gmail-review-title">Needs your review</h2>
                  <span className="gmail-count-pill">{reviewEmails.length}</span>
                </div>
                <p>These messages did not change an application. Review the suggestion, then update the right application yourself if needed. Showing up to 20 recent emails.</p>
              </div>
            </div>

            {reviewError ? (
              <p className="gmail-inline-error" role="alert">{reviewError}</p>
            ) : reviewEmails.length === 0 ? (
              <div className="gmail-empty-state">
                <span className="gmail-empty-icon"><FiCheckCircle aria-hidden="true" /></span>
                <div>
                  <strong>You’re all caught up</strong>
                  <p>No emails need review right now.</p>
                </div>
              </div>
            ) : (
              <div className="gmail-review-list">
                {reviewEmails.map((email) => (
                  <article
                    className="gmail-review-item"
                    key={email.account_email + ":" + email.message_id}
                  >
                    <div className="gmail-review-main">
                      <div className="gmail-review-title-row">
                        <div>
                          <span className="gmail-review-subject">{email.subject || "Untitled email"}</span>
                          <span className="gmail-review-date">{formatDate(email.received_at)}</span>
                        </div>
                        <a
                          className="gmail-open-link"
                          href={getGmailUrl(email)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open email <FiExternalLink aria-hidden="true" />
                        </a>
                      </div>

                      <div className="gmail-review-tags">
                        {email.classification?.eventType && (
                          <span className="gmail-event-tag">
                            Possible update: {formatEvent(email.classification.eventType)}
                          </span>
                        )}
                        {email.classification?.company && (
                          <span className="gmail-review-context">
                            {email.classification.company}
                            {email.classification.role ? " · " + email.classification.role : ""}
                          </span>
                        )}
                      </div>

                      <p className="gmail-review-reason">
                        <strong>Why it was held:</strong> {email.reason || "Offerly could not confidently match this email."}
                      </p>

                      {email.classification?.evidence && (
                        <blockquote className="gmail-evidence">
                          “{email.classification.evidence}”
                        </blockquote>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="gmail-content-card" aria-labelledby="gmail-activity-title">
            <div className="gmail-section-heading gmail-section-heading-spaced">
              <span className="gmail-section-icon gmail-section-icon-green"><FiActivity aria-hidden="true" /></span>
              <div>
                <h2 id="gmail-activity-title">Latest application updates</h2>
                <p>Recent hiring events recorded from Gmail. Open Applications to edit any status.</p>
              </div>
            </div>

            {syncLogs.length === 0 ? (
              <div className="gmail-empty-state">
                <span className="gmail-empty-icon"><FiClock aria-hidden="true" /></span>
                <div>
                  <strong>No Gmail updates yet</strong>
                  <p>When a clear email matches an application, its status update will appear here.</p>
                </div>
              </div>
            ) : (
              <div className="gmail-activity-list">
                {syncLogs.map((log) => (
                  <article className="gmail-activity-item" key={log.id}>
                    <span className="gmail-activity-marker" aria-hidden="true"><FiCheckCircle /></span>
                    <div className="gmail-activity-copy">
                      <strong>{log.metadata?.company || log.subject || "Application update"}</strong>
                      <p>{log.metadata?.role || "Role not identified"} · {formatEvent(log.event_type)}</p>
                    </div>
                    <time dateTime={log.created_at}>{formatDate(log.created_at)}</time>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
