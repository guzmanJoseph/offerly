import { useState } from "react";

import ApplicationTable from "../applications/ApplicationTable";
import ApplicationModal from "../applications/ApplicationModal";

import { sampleApplications } from "../data/sampleApplications";

export default function Applications() {
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState(sampleApplications);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState(null);

  function handleSaveApplication(application) {

    if (editingApplication) {

        setApplications(prev =>
            prev.map(app =>
                app.id === application.id
                    ? application
                    : app
            )
        );

    } else {

        setApplications(prev => [
            {
                id: Date.now(),
                ...application,
            },
            ...prev,
        ]);

    }

    setEditingApplication(null);
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
          onChange={(e) => setSearch(e.target.value)}
        />

        <button onClick={() => setIsModalOpen(true)}>
          Add Application
        </button>
      </div>

      <ApplicationTable 
        applications={filtered}
        onEdit={(app) => {
            setEditingApplication(app);
            setIsModalOpen(true);
            }
        }
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