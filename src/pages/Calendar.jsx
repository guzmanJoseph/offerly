import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import CalendarView from "../calendar/CalendarView";
import EventModal from "../calendar/EventModal";
import EditEventModal from "./EditEventModal";

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    fetchAllEvents();
  }, []);

  function handleSelectEvent(event) {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  }
  async function fetchGoogleEvents() {
    const now = new Date();

    const rangeStart = new Date(
      now.getFullYear(),
      now.getMonth() - 3,
      1
    );

    const rangeEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 7,
      1
    );

    const { data, error } =
      await supabase.functions.invoke(
        "google-calendar",
        {
          body: {
            action: "list",
            timeMin:
              rangeStart.toISOString(),
            timeMax:
              rangeEnd.toISOString(),
          },
        }
      );

    if (error) {
      console.error(
        "Could not load Google events:",
        error
      );

      setGoogleEvents([]);
      return;
    }

    if (!data?.success) {
      console.error(
        "Google Calendar error:",
        data?.error
      );

      setGoogleEvents([]);
      return;
    }

    setGoogleEvents(data.events ?? []);
  }
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

  async function fetchAllEvents() {
    await Promise.all([
      fetchEvents(),
      fetchGoogleEvents(),
    ]);
  }

  async function handleDeleteEvent(event) {
    const isGoogleOnlyEvent =
      event.source === "google" &&
      String(event.id).startsWith("google-");

    try {
      /*
        Google-only event:
        It has no row in Offerly, so delete only from Google.
      */
      if (isGoogleOnlyEvent) {
        const { data, error } =
          await supabase.functions.invoke(
            "google-calendar",
            {
              body: {
                action: "delete",
                google_event_id: event.google_event_id,
              },
            }
          );

        if (error || !data?.success) {
          console.error(
            "Google event deletion failed:",
            error,
            data
          );

          throw new Error(
            data?.error ||
              "Could not delete the Google Calendar event."
          );
        }
      } else {
        /*
          Offerly event:
          Delete the database row first.
        */
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "You must be logged in to delete this event."
          );
        }

        const { data: deletedEvents, error: deleteError } =
          await supabase
            .from("events")
            .delete()
            .eq("id", event.id)
            .eq("user_id", user.id)
            .select("id");

        if (deleteError) {
          console.error(
            "Offerly event deletion failed:",
            deleteError
          );

          throw deleteError;
        }

        if (!deletedEvents?.length) {
          throw new Error(
            "No matching Offerly event was deleted."
          );
        }

        /*
          Then try removing the synced Google copy.
          Do not restore or block the Offerly deletion if Google fails.
        */
        if (event.google_event_id) {
          const { data, error } =
            await supabase.functions.invoke(
              "google-calendar",
              {
                body: {
                  action: "delete",
                  google_event_id:
                    event.google_event_id,
                },
              }
            );

          if (error || !data?.success) {
            console.error(
              "Offerly was deleted, but Google deletion failed:",
              error,
              data
            );

            alert(
              "The event was deleted from Offerly, but its Google Calendar copy could not be deleted."
            );
          }
        }
      }

      setEvents((currentEvents) =>
        currentEvents.filter(
          (currentEvent) =>
            currentEvent.id !== event.id
        )
      );

      setIsEditModalOpen(false);
      setSelectedEvent(null);

      await fetchAllEvents();
    } catch (error) {
      console.error(
        "Event deletion failed:",
        error
      );

      alert(
        error.message ||
          "The event could not be deleted."
      );
    }
  }
  
  async function handleUpdateEvent(
    originalEvent,
    formData
  ) {
    const updatedEvent = {
      title: formData.title.trim(),
      event_type: formData.event_type,
      start_time: new Date(
        formData.start_time
      ).toISOString(),
      end_time: formData.end_time
        ? new Date(formData.end_time).toISOString()
        : null,
      description: formData.description.trim(),
      location: formData.location.trim(),
    };

    const isGoogleOnlyEvent =
      originalEvent.source === "google" &&
      String(originalEvent.id).startsWith("google-");

    /*
      Update Google when:
      - It is a Google-only event, or
      - It is an Offerly event previously synced to Google.
    */
    if (originalEvent.google_event_id) {
      const { data, error } =
        await supabase.functions.invoke(
          "google-calendar",
          {
            body: {
              action: "update",
              google_event_id:
                originalEvent.google_event_id,
              ...updatedEvent,
            },
          }
        );

      if (error || !data?.success) {
        console.error(
          "Google event update failed:",
          error || data?.error
        );

        throw new Error(
          data?.error ||
            "Could not update Google Calendar event"
        );
      }
    }

    /*
      Google-only events are not in the Supabase events table,
      so there is nothing to update there.
    */
    if (!isGoogleOnlyEvent) {
      const { error } = await supabase
        .from("events")
        .update(updatedEvent)
        .eq("id", originalEvent.id);

      if (error) {
        console.error(
          "Offerly event update failed:",
          error
        );

        throw error;
      }
    }

    setIsEditModalOpen(false);
    setSelectedEvent(null);

    await fetchAllEvents();
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

  const syncedGoogleIds = new Set(
  events
    .map(
      (event) =>
        event.google_event_id
    )
    .filter(Boolean)
);

  const uniqueGoogleEvents =
    googleEvents.filter(
      (event) =>
        !syncedGoogleIds.has(
          event.google_event_id
        )
    );

  const combinedEvents = [
    ...events,
    ...uniqueGoogleEvents,
  ];

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

      <CalendarView
        events={combinedEvents}
        onSelectEvent={handleSelectEvent} 
      />

      {isModalOpen && (
        <EventModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEvent}
        />
      )}

      {isEditModalOpen && selectedEvent && (
        <EditEventModal
          event={selectedEvent}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedEvent(null);
          }}
          onSave={handleUpdateEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </>
  );
}