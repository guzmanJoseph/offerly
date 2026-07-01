import { useState } from "react";
import "./calendar.css";

export default function EventModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    event_type: "Reminder",
    start_time: "",
    description: "",
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
    onSave(formData);
  }

  return (
    <div className="modal-backdrop">
      <form className="event-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>Add Event</h2>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <input
          name="title"
          placeholder="Event title"
          value={formData.title}
          onChange={handleChange}
          required
        />

        <select
          name="event_type"
          value={formData.event_type}
          onChange={handleChange}
        >
          <option>Reminder</option>
          <option>Interview</option>
          <option>OA</option>
          <option>Recruiter Call</option>
          <option>Deadline</option>
          <option>Follow Up</option>
        </select>

        <input
          name="start_time"
          type="datetime-local"
          value={formData.start_time}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Notes"
          value={formData.description}
          onChange={handleChange}
        />

        <button className="save-button" type="submit">
          Save Event
        </button>
      </form>
    </div>
  );
}