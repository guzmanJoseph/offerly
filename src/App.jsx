
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate
} from "react-router-dom";

import { supabase } from "./lib/supabaseClient";

import Layout from "./layout/Layout";

import Dashboard from "./pages/Dashboard";
import Applications from "./pages/Applications";
import Auth from "./pages/Auth";
import CalendarPage from "./pages/Calendar";
import Networking from "./pages/Networking";
import Settings from "./pages/Settings";
import AutofillProfile from "./pages/AutofillProfile";
import ImportGmail from "./pages/ImportGmail";
import Privacy from "./pages/Privacy";
import Home from "./pages/Home";
import ResetPassword from "./pages/ResetPassword";

// -------------------------------------
// PROTECTED PAGE
// -------------------------------------

function ProtectedRoute({
  session,
  profileReady,
  children
}) {
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (!profileReady) {
    return (
      <Navigate
        to="/autofill-profile"
        replace
      />
    );
  }

  return children;
}

// -------------------------------------
// APPLICATION
// -------------------------------------

export default function App() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profileReady, setProfileReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  // -------------------------------------
  // AUTHENTICATION
  // -------------------------------------

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const {
          data: { session },
          error
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            "Error getting session:",
            error
          );
        }

        if (mounted) {
          setSession(session);
        }
      } catch (error) {
        console.error(
          "Authentication initialization:",
          error
        );
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          setSession(newSession);
          setAuthLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // -------------------------------------
  // PROFILE ONBOARDING CHECK
  // -------------------------------------

  useEffect(() => {
    let active = true;

    async function checkProfile() {
      if (!session?.user?.id) {
        setProfileReady(false);
        setProfileLoading(false);
        setProfileError("");
        return;
      }

      setProfileLoading(true);
      setProfileError("");

      try {
        // Uses the authenticated user's session
        // and existing Supabase RLS policies.
        const { data, error } = await supabase
          .from("autofill_profiles")
          .select("profile_data")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (!active) return;

        // Existing profiles are grandfathered in.
        // New users with no profile must complete setup.
        const hasSavedProfile =
          data?.profile_data !== null &&
          data?.profile_data !== undefined &&
          typeof data.profile_data === "object" &&
          !Array.isArray(data.profile_data);

        setProfileReady(hasSavedProfile);
      } catch (error) {
        console.error(
          "Could not check profile setup:",
          error
        );

        if (active) {
          // Do not mistake a database error
          // for a brand-new account.
          setProfileError(error.message);
          setProfileReady(false);
        }
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    checkProfile();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // -------------------------------------
  // FINISH ONBOARDING
  // -------------------------------------

  function handleProfileSaved() {
    setProfileReady(true);
    setProfileError("");
    navigate("/dashboard", { replace: true });
  }

  // -------------------------------------
  // PROTECTED LAYOUT HELPER
  // -------------------------------------

  const protectedPage = (child) => (
    <ProtectedRoute
      session={session}
      profileReady={profileReady}
    >
      <Layout>
        {child}
      </Layout>
    </ProtectedRoute>
  );

  // -------------------------------------
  // LOADING
  // -------------------------------------

  if (authLoading || (session && profileLoading)) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center"
        }}
      >
        <p>Loading Offerly...</p>
      </div>
    );
  }

  // -------------------------------------
  // PROFILE CHECK ERROR
  // -------------------------------------

  if (session && profileError) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "80px auto",
          padding: 24,
          textAlign: "center"
        }}
      >
        <h2>Couldn't load your Offerly profile</h2>

        <p>{profileError}</p>

        <p>
          Your profile has not been changed.
          Please reload the page and try again.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  // -------------------------------------
  // ROUTES
  // -------------------------------------

  return (
    <Routes>
      <Route
        path="/"
        element={
          session
            ? (
              <Navigate
                to={
                  profileReady
                    ? "/dashboard"
                    : "/autofill-profile"
                }
                replace
              />
            )
            : <Home />
        }
      />

      <Route
        path="/auth"
        element={
          session
            ? (
              <Navigate
                to={
                  profileReady
                    ? "/dashboard"
                    : "/autofill-profile"
                }
                replace
              />
            )
            : <Auth />
        }
      />

      <Route
        path="/privacy"
        element={<Privacy />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      {/* PROFILE SETUP AND EDITING */}

      <Route
        path="/autofill-profile"
        element={
          !session
            ? (
              <Navigate
                to="/auth"
                replace
              />
            )
            : (
              <Layout>
                <AutofillProfile
                  onboarding={!profileReady}
                  onProfileSaved={handleProfileSaved}
                />
              </Layout>
            )
        }
      />

      {/* DASHBOARD */}

      <Route
        path="/dashboard"
        element={protectedPage(<Dashboard />)}
      />

      {/* APPLICATIONS */}

      <Route
        path="/applications"
        element={protectedPage(<Applications />)}
      />

      {/* GMAIL SYNC */}

      <Route
        path="/gmail-import"
        element={protectedPage(<ImportGmail />)}
      />

      {/* CALENDAR */}

      <Route
        path="/calendar"
        element={protectedPage(<CalendarPage />)}
      />

      {/* NETWORKING */}

      <Route
        path="/networking"
        element={protectedPage(<Networking />)}
      />

      {/* SETTINGS */}

      <Route
        path="/settings"
        element={protectedPage(
          <Settings user={session?.user} />
        )}
      />

      {/* ALL OTHER URLS */}

      <Route
        path="*"
        element={
          <Navigate
            to={
              session
                ? profileReady
                  ? "/dashboard"
                  : "/autofill-profile"
                : "/"
            }
            replace
          />
        }
      />
    </Routes>
  );
}
