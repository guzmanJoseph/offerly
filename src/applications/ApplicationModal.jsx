import { useState } from "react";
import "../styles/applications.css";

export default function ApplicationModal({ application,onClose, onSave }) {
    const [formData, setFormData] = useState({
        company: application?.company || "",
        role: application?.role || "",
        status: application?.status || "Applied",
        dateApplied:
          application?.dateApplied ||
          new Date().toISOString().split("T")[0],
        location: application?.location || "",
        priority: application?.priority || "Medium",
        notes: application?.notes || "",
    });

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    onSave({
      id: application ? application.id : Date.now(),
      ...formData,
    });

    onClose();
  }

  return (
    <div className="modal-backdrop">
      <form className="application-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>
            {application ? "Edit Application" : "Add Application"}
          </h2>
          <button type="button" onClick={onClose}>✕</button>
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

        <input
          name="dateApplied"
          type="date"
          value={formData.dateApplied}
          onChange={handleChange}
        />

        <select name="status" value={formData.status} onChange={handleChange}>
          <option>Applied</option>
          <option>Interview</option>
          <option>Offer</option>
          <option>Rejected</option>
          <option>Ghosted</option>
        </select>

        <select name="priority" value={formData.priority} onChange={handleChange}>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>

        <button type="submit" className="save-button">
          {application ? "Update Application" : "Save Application"}
        </button>
      </form>
    </div>
  );
}