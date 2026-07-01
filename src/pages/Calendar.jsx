import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import CalendarView from "../calendar/CalendarView";
import EventModal from "../calendar/EventModal";

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      console.error(error.message);
      return;
    }

    setEvents(data);
  }

  async function handleSaveEvent(event) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from("events").insert({
      user_id: user.id,
      title: event.title,
      event_type: event.event_type,
      start_time: event.start_time,
      description: event.description,
    });

    if (error) {
      console.error(error.message);
      return;
    }

    setIsModalOpen(false);
    fetchEvents();
  }

  return (
    <>
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Track interviews, deadlines, follow-ups, and recruiting events.</p>
      </div>

      <div className="toolbar">
        <button onClick={() => setIsModalOpen(true)}>
          Add Event
        </button>
      </div>

      <CalendarView events={events} />

      {isModalOpen && (
        <EventModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEvent}
        />
      )}
    </>
  );
}