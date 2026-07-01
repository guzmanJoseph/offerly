import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";

import ApplicationTable from "../applications/ApplicationTable";
import ApplicationModal from "../applications/ApplicationModal";

export default function Applications() {
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setApplications(data);
  }

  async function handleSaveApplication(application) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    if (editingApplication) {
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