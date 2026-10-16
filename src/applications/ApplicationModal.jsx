
import { useState } from "react";
import "../styles/applications.css";

export default function ApplicationModal({
  application,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    company: application?.company || "",
    role: application?.role || "",
    status: application?.status || "Applied",
    dateApplied:
      application?.date_applied ??
      application?.dateApplied ??
      (application?.status === "Saved"
        ? ""
        : new Date().toISOString().split("T")[0]),
    location: application?.location || "",
    priority: application?.priority || "Medium",
    notes: application?.notes || "",
    job_url: application?.job_url || "",
  });

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === "status") {
        return {
          ...prev,
          status: value,
          dateApplied:
            value === "Saved"
              ? ""
              : prev.dateApplied ||
                new Date().toISOString().split("T")[0],
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    onSave({
      ...formData,
      dateApplied:
        formData.status === "Saved"
          ? null
          : formData.dateApplied || null,
    });
  }

  return (
    <div className="modal-backdrop">
      <form
        className="application-modal"
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h2>
            {application
              ? "Edit Application"
              : "Add Application"}
          </h2>

          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <input
          name="company"
          placeholder="Company"
          value={formData.company}
          onChange={handleChange}
          required
        />

        <input
          name="role"
          placeholder="Role"
          value={formData.role}
          onChange={handleChange}
          required
        />

        <input
          name="location"
          placeholder="Location"
          value={formData.location}
          onChange={handleChange}
        />

        <label htmlFor="application-status">
          Application Status
        </label>

        <select
          id="application-status"
          name="status"
          value={formData.status}
          onChange={handleChange}
        >
          <option value="Saved">Saved</option>
          <option value="Applied">Applied</option>
          <option value="Assessment">Assessment</option>
          <option value="Interview">Interview</option>
          <option value="Offer">Offer</option>
          <option value="Rejected">Rejected</option>
        </select>

        <label htmlFor="application-date">
          Date Applied
        </label>

        <input
          id="application-date"
          name="dateApplied"
          type="date"
          value={formData.dateApplied || ""}
          onChange={handleChange}
          disabled={formData.status === "Saved"}
        />

        {formData.status === "Saved" && (
          <p className="af-muted">
            This job is saved for later. An application
            date will be added when you mark it as Applied.
          </p>
        )}

        <label htmlFor="application-priority">
          Priority
        </label>

        <select
          id="application-priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>

        <input
          name="job_url"
          type="url"
          placeholder="Job posting URL (optional)"
          value={formData.job_url}
          onChange={handleChange}
        />

        <button
          type="submit"
          className="save-button"
        >
          {application
            ? "Update Application"
            : "Save Application"}
        </button>
      </form>
    </div>
  );
}
