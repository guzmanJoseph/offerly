import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { supabase } from "./lib/supabaseClient";

// Pages
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import Applications from "./pages/Applications";
import Auth from "./pages/Auth";
import CalendarPage from "./pages/Calendar";
import Networking from "./pages/Networking";
import Settings from "./pages/Settings";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error getting session:", error);
      }

      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("Auth event:", event);

      if (mounted) {
        setSession(newSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <h1>Loading...</h1>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          session ? <Navigate to="/dashboard" replace /> : <Home />
        }
      />

      <Route
        path="/auth"
        element={
          session ? <Navigate to="/dashboard" replace /> : <Auth />
        }
      />

      <Route path="/privacy" element={<Privacy />} />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute session={session}>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/applications"
        element={
          <ProtectedRoute session={session}>
            <Layout>
              <Applications />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/gmail-import"
        element={
          <ProtectedRoute session={session}>
            <Layout>
              <ImportGmail />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedRoute session={session}>
            <Layout>
              <CalendarPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/networking"
        element={
          <ProtectedRoute session={session}>
            <Layout>
              <Networking />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute session={session}>
            <Layout>
              <Settings user={session?.user} />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
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