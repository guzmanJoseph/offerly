import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

export default function CalendarView({
  events = [],
  onSelectEvent,
}) {
  const calendarEvents = events
    .filter((event) => event.start_time)
    .map((event) => {
      const start = new Date(event.start_time);

      const end = event.end_time
        ? new Date(event.end_time)
        : new Date(start.getTime() + 60 * 60 * 1000);

      return {
        id: event.id,
        title: event.title || "Untitled event",
        start,
        end,
        allDay: event.all_day ?? false,

        // Keep the full original database/Google event.
        resource: event,
      };
    });

  return (
    <Calendar
      localizer={localizer}
      events={calendarEvents}
      startAccessor="start"
      endAccessor="end"
      onSelectEvent={(calendarEvent) => {
        onSelectEvent?.(calendarEvent.resource);
      }}
      selectable
      style={{ height: 680 }}
    />
  );
}