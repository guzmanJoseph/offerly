import { Routes, Route } from "react-router-dom";

import Layout from "./layout/Layout";

import Dashboard from "./pages/Dashboard";
import Applications from "./pages/Applications";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/applications" element={<Applications />} />
      </Routes>
    </Layout>
  );
}