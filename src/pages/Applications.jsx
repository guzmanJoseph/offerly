import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";

import ApplicationTable from "../applications/ApplicationTable";
import ApplicationModal from "../applications/ApplicationModal";

export default function Applications() {
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    const shouldImport = searchParams.get("importJob");

    if (shouldImport !== "true") return;

    setEditingApplication({
      isImport: true,
      company: searchParams.get("company") || "",
      role: searchParams.get("role") || "",
      location: searchParams.get("location") || "",
      job_url: searchParams.get("jobUrl") || "",
      status: "Applied",
      dateApplied:
        searchParams.get("dateApplied") ||
        new Date().toISOString().split("T")[0],
      priority: "Medium",
      notes: "",
    });

  setIsModalOpen(true);
}, [searchParams]);

async function handleDeleteApplication(id) {
  const confirmDelete = window.confirm("Delete this application?");

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error.message);
    return;
  }

  fetchApplications();
}

  async function fetchApplications() {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setApplications(data || []);
  }

  async function extractJobWithAI({ pageTitle, h1, pageText, jobUrl }) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.5-mini",
        input: `
Extract job posting information.

Return ONLY valid JSON:
{
  "company": "",
  "role": "",
  "location": "",
  "salary": "",
  "employmentType": "",
  "workType": "",
  "confidence": 0
}

URL: ${jobUrl}
PAGE TITLE: ${pageTitle}
H1: ${h1}
PAGE TEXT:
${pageText}
        `,
      }),
    });

    const result = await response.json();
    return JSON.parse(result.output_text || "{}");
  }

  async function handleSaveApplication(application) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    if (editingApplication && !editingApplication.isImport) {
      const { error } = await supabase
        .from("applications")
        .update({
          company: application.company,
          role: application.role,
          status: application.status,
          date_applied: application.dateApplied,
          location: application.location,
          priority: application.priority,
          notes: application.notes,
          job_url: application.job_url,
          updated_at: new Date(),
        })
        .eq("id", editingApplication.id);

      if (error) {
        console.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("applications").insert({
        user_id: user.id,
        company: application.company,
        role: application.role,
        status: application.status,
        date_applied: application.dateApplied,
        location: application.location,
        priority: application.priority,
        notes: application.notes,
        job_url: application.job_url,
      });

      if (error) {
        console.error(error.message);
        return;
      }
    }

    setEditingApplication(null);
    setIsModalOpen(false);
    fetchApplications();
  }

  const filtered = applications.filter(app =>
    `${app.company} ${app.role} ${app.status}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1>Applications</h1>
        <p>Track every application in one place.</p>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button
          onClick={() => {
            setEditingApplication(null);
            setIsModalOpen(true);
          }}
        >
          Add Application
        </button>
      </div>

      <ApplicationTable
        applications={filtered}
        onEdit={app => {
          setEditingApplication(app);
          setIsModalOpen(true);
        }}
        onDelete={handleDeleteApplication}
      />

      {isModalOpen && (
        <ApplicationModal
          application={editingApplication}
          onClose={() => {
            setEditingApplication(null);
            setIsModalOpen(false);
          }}
          onSave={handleSaveApplication}
        />
      )}
    </>
  );
}