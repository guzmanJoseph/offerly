import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import { supabase } from "./lib/supabaseClient";

// Imports the pages
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import Applications from "./pages/Applications";
import Auth from "./pages/Auth";
import CalendarPage from "./pages/Calendar";
import Networking from "./pages/Networking";
import Settings from './pages/Settings';

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/networking" element={<Networking />} />
        <Route path="/settings" element={<Settings user={session.user} />} />
      </Routes>
    </Layout>
  );
}