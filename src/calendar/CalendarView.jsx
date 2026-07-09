import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/calendar.css";

const locales = {};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date()),
  getDay,
  locales,
});

export default function CalendarView({ events }) {
  const calendarEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: new Date(event.start_time),
    end: event.end_time
      ? new Date(event.end_time)
      : new Date(event.start_time),
  }));

  return (
    <div className="calendar-card">
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
      />
    </div>
  );
}