import { useEffect, useState } from "react";
import "../styles/EditEventModal.css";
function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(
    date.getTime() - offset * 60 * 1000
  );

  return localDate.toISOString().slice(0, 16);
}

export default function EditEventModal({
  event,
  onClose,
  onSave,
  onDelete,
}) {
  const [formData, setFormData] = useState({
    title: "",
    event_type: "other",
    start_time: "",
    end_time: "",
    description: "",
    location: "",
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFormData({
      title: event.title ?? "",
      event_type: event.event_type ?? "other",
      start_time: toDateTimeLocal(event.start_time),
      end_time: toDateTimeLocal(event.end_time),
      description: event.description ?? "",
      location: event.location ?? "",
    });
  }, [event]);

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
      await onSave(event, formData);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick() {
    const confirmed = window.confirm(
      `Delete "${event.title}"?`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      await onDelete(event);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="event-modal edit-event-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="event-modal-header">
          <div>
            <span className="event-modal-label">
              {event.source === "google"
                ? "Google Calendar event"
                : "Offerly event"}
            </span>

            <h2>Edit event</h2>
          </div>

          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Event title
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Event type
            <select
              name="event_type"
              value={formData.event_type}
              onChange={handleChange}
            >
              <option value="interview">Interview</option>
              <option value="deadline">Deadline</option>
              <option value="follow-up">Follow-up</option>
              <option value="networking">Networking</option>
              <option value="other">Other</option>
            </select>
          </label>

          <div className="event-modal-row">
            <label>
              Start
              <input
                type="datetime-local"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              End
              <input
                type="datetime-local"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
              />
            </label>
          </div>

          <label>
            Location
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </label>

          <div className="event-modal-actions">
            <button
              type="button"
              className="delete-event-button"
              onClick={handleDeleteClick}
              disabled={saving || deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>

            <div className="event-modal-actions-right">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={saving || deleting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving || deleting}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}