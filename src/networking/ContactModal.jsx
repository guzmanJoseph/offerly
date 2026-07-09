import { useState } from "react";
import "../styles/networking.css";

export default function ContactModal({ contact, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: contact?.name || "",
    company: contact?.company || "",
    role: contact?.role || "",
    email: contact?.email || "",
    linkedin_url: contact?.linkedin_url || "",
    relationship_type: contact?.relationship_type || "Alumni",
    status: contact?.status || "Want to Reach Out",
    last_contacted: contact?.last_contacted || "",
    next_follow_up: contact?.next_follow_up || "",
    notes: contact?.notes || "",
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
      id: contact?.id,
      ...formData,
    });
  }

  return (
    <div className="modal-backdrop">
      <form className="contact-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{contact ? "Edit Contact" : "Add Contact"}</h2>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <input
          name="name"
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <input
          name="company"
          placeholder="Company"
          value={formData.company}
          onChange={handleChange}
        />

        <input
          name="role"
          placeholder="Role / Title"
          value={formData.role}
          onChange={handleChange}
        />

        <input
          name="email"
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
        />

        <input
          name="linkedin_url"
          placeholder="LinkedIn URL"
          value={formData.linkedin_url}
          onChange={handleChange}
        />

        <select
          name="relationship_type"
          value={formData.relationship_type}
          onChange={handleChange}
        >
          <option>Alumni</option>
          <option>Recruiter</option>
          <option>Friend</option>
          <option>Referral</option>
          <option>Hiring Manager</option>
          <option>Other</option>
        </select>

        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
        >
          <option>Want to Reach Out</option>
          <option>Reached Out</option>
          <option>Connected</option>
          <option>Follow Up</option>
          <option>Referred</option>
        </select>

        <input
          name="last_contacted"
          type="date"
          value={formData.last_contacted}
          onChange={handleChange}
        />

        <input
          name="next_follow_up"
          type="date"
          value={formData.next_follow_up}
          onChange={handleChange}
        />

        <textarea
          name="notes"
          placeholder="Notes"
          value={formData.notes}
          onChange={handleChange}
        />

        <button className="save-button" type="submit">
          {contact ? "Update Contact" : "Save Contact"}
        </button>
      </form>
    </div>
  );
}