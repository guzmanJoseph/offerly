// src/pages/Settings.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/settings.css";
import { supabase } from "../lib/supabaseClient";

const DEFAULT_PREFERENCES = {
  darkMode: true,
  defaultView: "dashboard",
  applicationReminders: true,
  interviewAlerts: true,
  weeklySummary: false,
};

export default function Settings({ user: providedUser }) {
  const navigate = useNavigate();

  const [user, setUser] = useState(providedUser ?? null);
  const [displayName, setDisplayName] = useState("");

  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const userInitial = useMemo(() => {
    const value = displayName || user?.email || "?";
    return value.charAt(0).toUpperCase();
  }, [displayName, user?.email]);

  useEffect(() => {
    loadSettings();
  }, [providedUser]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.clearTimeout(showMessage.timeout);

    showMessage.timeout = window.setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 4000);
  }

  async function loadSettings() {
    setLoading(true);

    try {
      let currentUser = providedUser;

      if (!currentUser) {
        const {
          data: { user: authenticatedUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        currentUser = authenticatedUser;
      }

      if (!currentUser) {
        navigate("/login");
        return;
      }

      setUser(currentUser);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        console.error("Could not load profile:", profileError.message);
      }

      setDisplayName(
        profile?.display_name ??
          currentUser.user_metadata?.display_name ??
          currentUser.user_metadata?.full_name ??
          ""
      );

      const storedPreferences = localStorage.getItem(
        `offerly-settings-${currentUser.id}`
      );

      if (storedPreferences) {
        try {
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...JSON.parse(storedPreferences),
          });
        } catch (error) {
          console.error("Could not parse saved settings:", error);
        }
      }
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        error.message || "We couldn't load your settings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    if (!user) return;

    const trimmedName = displayName.trim();

    if (!trimmedName) {
      showMessage("error", "Please enter a display name.");
      return;
    }

    setSavingProfile(true);

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            display_name: trimmedName,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );

      if (profileError) {
        throw profileError;
      }

      const { error: userError } = await supabase.auth.updateUser({
        data: {
          display_name: trimmedName,
        },
      });

      if (userError) {
        throw userError;
      }

      setDisplayName(trimmedName);
      showMessage("success", "Your profile has been updated.");
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        error.message || "We couldn't save your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function updatePreference(name, value) {
    setPreferences((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSavePreferences() {
    if (!user) return;

    setSavingPreferences(true);

    try {
      localStorage.setItem(
        `offerly-settings-${user.id}`,
        JSON.stringify(preferences)
      );

      document.documentElement.dataset.theme = preferences.darkMode
        ? "dark"
        : "light";

      showMessage("success", "Your preferences have been saved.");
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        "We couldn't save your preferences in this browser."
      );
    } finally {
      setSavingPreferences(false);
    }
  }

  async function handleExportData() {
    if (!user) return;

    setExportingData(true);

    try {
      const [
        applicationsResult,
        contactsResult,
        eventsResult,
        profileResult,
      ] = await Promise.all([
        supabase
          .from("applications")
          .select("*")
          .eq("user_id", user.id),

        supabase
          .from("contacts")
          .select("*")
          .eq("user_id", user.id),

        supabase
          .from("events")
          .select("*")
          .eq("user_id", user.id),

        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const errors = [
        applicationsResult.error,
        contactsResult.error,
        eventsResult.error,
        profileResult.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        throw errors[0];
      }

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        account: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
        },
        profile: profileResult.data ?? null,
        preferences,
        applications: applicationsResult.data ?? [],
        contacts: contactsResult.data ?? [],
        events: eventsResult.data ?? [],
      };

      const file = new Blob(
        [JSON.stringify(exportPayload, null, 2)],
        {
          type: "application/json",
        }
      );

      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `offerly-data-${
        new Date().toISOString().split("T")[0]
      }.json`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      showMessage("success", "Your Offerly data has been exported.");
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        error.message || "We couldn't export your data."
      );
    } finally {
      setExportingData(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      navigate("/login");
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        error.message || "We couldn't sign you out."
      );

      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Delete your Offerly account? This will permanently remove your applications, contacts, events, and profile."
    );

    if (!confirmed || !user) return;

    const finalConfirmation = window.prompt(
      'Type "DELETE" to permanently delete your account.'
    );

    if (finalConfirmation !== "DELETE") {
      showMessage("error", "Account deletion was canceled.");
      return;
    }

    setDeletingAccount(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "delete-account"
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      localStorage.removeItem(`offerly-settings-${user.id}`);

      await supabase.auth.signOut();

      navigate("/login");
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        error.message ||
          "Account deletion is not configured yet."
      );

      setDeletingAccount(false);
    }
  }

  if (loading) {
    return (
      <div className="page settings-page">
        <div className="settings-loading">
          <div className="settings-spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account, preferences, and Offerly data.</p>
      </div>

      {message.text && (
        <div
          className={`settings-message ${message.type}`}
          role="status"
        >
          {message.text}
        </div>
      )}

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-user-summary">
            <div className="settings-avatar">
              {userInitial}
            </div>

            <div>
              <h2>{displayName || "Offerly User"}</h2>
              <p>{user?.email}</p>
            </div>
          </div>

          <nav className="settings-navigation">
            <a href="#profile">Profile</a>
            <a href="#data">Data & account</a>
          </nav>
        </aside>

        <main className="settings-content">
          <section
            id="profile"
            className="settings-card"
          >
            <div className="settings-card-header">
              <div>
                <h2>Profile</h2>
                <p>
                  Update the information shown throughout Offerly.
                </p>
              </div>
            </div>

            <form
              className="settings-form"
              onSubmit={handleSaveProfile}
            >
              <label className="settings-field">
                <span>Display name</span>

                <input
                  type="text"
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  placeholder="Your name"
                  maxLength={80}
                />
              </label>

              <label className="settings-field">
                <span>Email address</span>

                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                />

                <small>
                  Your email is managed by your sign-in provider.
                </small>
              </label>

              <div className="settings-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={savingProfile}
                >
                  {savingProfile
                    ? "Saving..."
                    : "Save profile"}
                </button>
              </div>
            </form>
          </section>

          <section
            id="data"
            className="settings-card"
          >
            <div className="settings-card-header">
              <div>
                <h2>Data and account</h2>
                <p>
                  Export your information or manage your account.
                </p>
              </div>
            </div>

            <div className="account-action-row">
              <div>
                <h3>Export Offerly data</h3>
                <p>
                  Download your profile, applications, contacts,
                  events, and preferences as JSON.
                </p>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={handleExportData}
                disabled={exportingData}
              >
                {exportingData
                  ? "Exporting..."
                  : "Export data"}
              </button>
            </div>

            <div className="account-action-row">
              <div>
                <h3>Sign out</h3>
                <p>
                  Sign out of Offerly on this device.
                </p>
              </div>

              <button
                type="button"
                className="secondary-btn"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </section>

          <section className="settings-card danger-zone">
            <div className="settings-card-header">
              <div>
                <h2>Danger zone</h2>
                <p>
                  Actions in this section cannot be undone.
                </p>
              </div>
            </div>

            <div className="account-action-row">
              <div>
                <h3>Delete account</h3>
                <p>
                  Permanently delete your account and all associated
                  Offerly data.
                </p>
              </div>

              <button
                type="button"
                className="danger-btn"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount
                  ? "Deleting..."
                  : "Delete account"}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}