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

    const startDate = new Date(event.start_time);

    const endDate = new Date(
      startDate.getTime() + 60 * 60 * 1000
    );

    const { data: savedEvent, error: insertError } =
      await supabase
        .from("events")
        .insert({
          user_id: user.id,
          title: event.title,
          event_type: event.event_type,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          description: event.description,
          source: "offerly",
        })
        .select()
        .single();

    if (insertError) {
      console.error("Could not save Offerly event:", insertError);
      alert("The event could not be saved.");
      return;
    }

    if (event.add_to_google_calendar) {
      const { data: calendarData, error: calendarError } =
        await supabase.functions.invoke("google-calendar", {
          body: {
            title: event.title,
            event_type: event.event_type,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            description: event.description,
          },
        });

      if (calendarError || !calendarData?.success) {
        console.error(
          "Could not add event to Google Calendar:",
          calendarError || calendarData?.error
        );

        alert(
          "The event was saved in Offerly, but it could not be added to Google Calendar."
        );
      } else {
        const { error: updateError } = await supabase
          .from("events")
          .update({
            google_event_id: calendarData.google_event_id,
            google_event_link: calendarData.google_event_link,
          })
          .eq("id", savedEvent.id);

        if (updateError) {
          console.error(
            "Could not save Google event information:",
            updateError
          );
        }
      }
    }

    setIsModalOpen(false);
    await fetchEvents();
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