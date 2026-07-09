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

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <h1>Loading...</h1>;
  }

  return (
    <Routes>

      {/* Public Pages */}
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Protected Pages */}
      {session ? (
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/applications" element={<Applications />} />
                <Route path="/gmail-import" element={<ImportGmail />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/networking" element={<Networking />} />
                <Route
                  path="/settings"
                  element={<Settings user={session.user} />}
                />
              </Routes>
            </Layout>
          }
        />
      ) : (
        <Route path="/*" element={<Navigate to="/" replace />} />
      )}

    </Routes>
  );
}