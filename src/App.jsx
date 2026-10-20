import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
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

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authEventReceived = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        authEventReceived = true;

        if (!mounted) return;

        setSession(newSession);
        setAuthLoading(false);
      }
    );

    async function initializeAuth() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (error) throw error;

        if (mounted && !authEventReceived) {
          setSession(data.session);
        }
      } catch (error) {
        console.error(
          "Authentication initialization failed:",
          error
        );
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const protectedPage = (child) => (
    <ProtectedRoute session={session}>
      <Layout>{child}</Layout>
    </ProtectedRoute>
  );

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
        }}
        role="status"
      >
        <p>Loading Offerly...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          session
            ? <Navigate to="/dashboard" replace />
            : <Home />
        }
      />

      <Route
        path="/auth"
        element={
          session
            ? <Navigate to="/dashboard" replace />
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

      <Route
        path="/dashboard"
        element={protectedPage(<Dashboard />)}
      />

      <Route
        path="/applications"
        element={protectedPage(<Applications />)}
      />

      <Route
        path="/autofill-profile"
        element={protectedPage(
          <AutofillProfile onboarding={false} />
        )}
      />

      <Route
        path="/gmail-import"
        element={protectedPage(<ImportGmail />)}
      />

      <Route
        path="/calendar"
        element={protectedPage(<CalendarPage />)}
      />

      <Route
        path="/networking"
        element={protectedPage(<Networking />)}
      />

      <Route
        path="/settings"
        element={protectedPage(
          <Settings user={session?.user} />
        )}
      />

      <Route
        path="*"
        element={
          <Navigate
            to={session ? "/dashboard" : "/"}
            replace
          />
        }
      />
    </Routes>
  );
}