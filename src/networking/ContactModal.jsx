import { useEffect, useState } from "react";
import "../styles/networking.css";

const EMPTY_FORM = {
  name: "",
  company: "",
  role: "",
  email: "",
  phone: "",
  linkedin_url: "",
  relationship_type: "Alumni",
  status: "Want to Reach Out",
  source: "LinkedIn",
  last_contacted: "",
  next_follow_up: "",
  notes: "",
};

export default function ContactModal({
  contact,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      name: contact?.name || "",
      company: contact?.company || "",
      role: contact?.role || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      linkedin_url: contact?.linkedin_url || "",
      relationship_type:
        contact?.relationship_type || "Alumni",
      status:
        contact?.status || "Want to Reach Out",
      source: contact?.source || "LinkedIn",
      last_contacted:
        contact?.last_contacted || "",
      next_follow_up:
        contact?.next_follow_up || "",
      notes: contact?.notes || "",
    });
  }, [contact]);

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);

      await onSave({
        id: contact?.id,
        ...formData,
        name: formData.name.trim(),
        company: formData.company.trim(),
        role: formData.role.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        linkedin_url:
          formData.linkedin_url.trim(),
        notes: formData.notes.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="contact-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className="contact-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
      >
        <div className="contact-modal-header">
          <div>
            <span className="contact-modal-eyebrow">
              Networking contact
            </span>

            <h2 id="contact-modal-title">
              {contact
                ? "Edit contact"
                : "Add a contact"}
            </h2>

            <p>
              Keep track of recruiters, alumni,
              referrals, and professional connections.
            </p>
          </div>

          <button
            type="button"
            className="contact-modal-close"
            onClick={onClose}
            aria-label="Close contact modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <section className="contact-form-section">
            <div className="contact-form-section-heading">
              <h3>Contact details</h3>
              <p>Basic professional information.</p>
            </div>

            <div className="contact-form-grid">
              <label className="contact-field contact-field-full">
                <span>
                  Name
                  <strong>*</strong>
                </span>

                <input
                  name="name"
                  placeholder="Jordan Smith"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </label>

              <label className="contact-field">
                <span>Company</span>

                <input
                  name="company"
                  placeholder="Google"
                  value={formData.company}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-field">
                <span>Role or title</span>

                <input
                  name="role"
                  placeholder="Software Engineer"
                  value={formData.role}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-field">
                <span>Email</span>

                <input
                  name="email"
                  type="email"
                  placeholder="jordan@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-field">
                <span>Phone</span>

                <input
                  name="phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-field contact-field-full">
                <span>LinkedIn profile</span>

                <input
                  name="linkedin_url"
                  type="url"
                  placeholder="https://www.linkedin.com/in/..."
                  value={formData.linkedin_url}
                  onChange={handleChange}
                />
              </label>
            </div>
          </section>

          <section className="contact-form-section">
            <div className="contact-form-section-heading">
              <h3>Relationship</h3>
              <p>
                Track where this connection stands.
              </p>
            </div>

            <div className="contact-form-grid contact-form-grid-three">
              <label className="contact-field">
                <span>Relationship</span>

                <select
                  name="relationship_type"
                  value={formData.relationship_type}
                  onChange={handleChange}
                >
                  <option>Alumni</option>
                  <option>Recruiter</option>
                  <option>Hiring Manager</option>
                  <option>Employee</option>
                  <option>Referral</option>
                  <option>Friend</option>
                  <option>Professor</option>
                  <option>Other</option>
                </select>
              </label>

              <label className="contact-field">
                <span>Status</span>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option>Want to Reach Out</option>
                  <option>Reached Out</option>
                  <option>Awaiting Response</option>
                  <option>Connected</option>
                  <option>Follow Up</option>
                  <option>Referred</option>
                  <option>Archived</option>
                </select>
              </label>

              <label className="contact-field">
                <span>Source</span>

                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                >
                  <option>LinkedIn</option>
                  <option>University</option>
                  <option>Career Fair</option>
                  <option>Referral</option>
                  <option>Email</option>
                  <option>Event</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
          </section>

          <section className="contact-form-section">
            <div className="contact-form-section-heading">
              <h3>Follow-up</h3>
              <p>
                Schedule the next networking touchpoint.
              </p>
            </div>

            <div className="contact-form-grid">
              <label className="contact-field">
                <span>Last contacted</span>

                <input
                  name="last_contacted"
                  type="date"
                  value={formData.last_contacted}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-field">
                <span>Next follow-up</span>

                <input
                  name="next_follow_up"
                  type="date"
                  value={formData.next_follow_up}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-field contact-field-full">
                <span>Notes</span>

                <textarea
                  name="notes"
                  placeholder="How you met, conversation details, shared interests, referral context..."
                  value={formData.notes}
                  onChange={handleChange}
                  rows={5}
                />
              </label>
            </div>
          </section>

          <div className="contact-modal-actions">
            <button
              type="button"
              className="contact-cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              className="contact-save-button"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : contact
                  ? "Save changes"
                  : "Add contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}