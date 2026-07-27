import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import { supabase } from "../lib/supabaseClient";
import ApplicationFunnel from "../dashboard/ApplicationFunnel";
import StatCard from "../dashboard/StatCard";
import ApplicationsOverTime from "../dashboard/ApplicationsOverTime";
import { useNavigate } from "react-router-dom";
import { getApplicationStats } from "../utils/applicationStats";

export default function Dashboard() {
    const navigate = useNavigate();
    const [applications, setApplications] = useState([]);
    const [nextActions, setNextActions] = useState([]);
    const [generatingActions, setGeneratingActions] = useState(false);
    const [actionsError, setActionsError] = useState("");
    const [contacts, setContacts] = useState([]);
    const stats = getApplicationStats(applications);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const networkStats = {
        total: contacts.length,

        awaitingResponse: contacts.filter(
            c => c.status === "Awaiting Response"
        ).length,

        activeConversations: contacts.filter(contact =>
            [
                "Coffee Chat Scheduled",
                "Responded",
                "Interview Scheduled",
                "Referral Received",
                "Connected",
                "Reached Out"
            ].includes(contact.status)
        ).length,

        referrals: contacts.filter(
            c => c.status === "Referred"
        ).length
    };

    const upcomingFollowUps = contacts
        .filter(c => c.next_follow_up)
        .map(contact => {
            const followUpDate = new Date(contact.next_follow_up);

            followUpDate.setHours(0,0,0,0);

            const diff = Math.round(
                (followUpDate - today) /
                (1000*60*60*24)
            );

            let label;

            if (diff < 0)
                label = "Overdue";
            else if (diff === 0)
                label = "Today";
            else if (diff === 1)
                label = "Tomorrow";
            else
                label = followUpDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                });

            return {
                ...contact,
                followUpLabel: label,
                followUpDate,
                isOverdue: diff < 0
            };
        })
        .sort((a,b)=>a.followUpDate-b.followUpDate);

    useEffect(() => {
        fetchApplications();
        fetchContacts();
    }, []);

    function normalizeText(value = "") {
        return value.trim().toLowerCase();
    }

    function formatActionDate(dateValue) {
        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const now = new Date();

        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        const eventDay = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        const differenceInDays = Math.round(
            (eventDay - today) / (1000 * 60 * 60 * 24)
        );

        if (differenceInDays === 0) {
            return `Today at ${date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            })}`;
        }

        if (differenceInDays === 1) {
            return `Tomorrow at ${date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            })}`;
        }

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }

    function getApplicationDate(application) {
        return (
            application.applied_date ??
            application.date_applied ??
            application.created_at
        );
    }

    async function fetchContacts() {
        const { data, error } = await supabase
            .from("contacts")
            .select("*")
            .order("next_follow_up", { ascending: true });

        if (error) {
            console.error(error);
            return;
        }

        setContacts(data ?? []);
    }
    async function fetchUpcomingCalendarEvents() {
        const now = new Date();

        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

        const { data: offerlyEvents, error } = await supabase
            .from("events")
            .select("*")
            .gte("start_time", now.toISOString())
            .lte("start_time", twoWeeksFromNow.toISOString())
            .order("start_time", { ascending: true });

        if (error) {
            console.error("Could not load Offerly events:", error.message);
        }

        let googleEvents = [];

        try {
            const { data, error: googleError } =
            await supabase.functions.invoke("google-calendar", {
                body: {
                action: "list",
                },
            });

            if (googleError) {
            console.error(
                "Could not load Google Calendar events:",
                googleError.message
            );
            } else {
            /*
            * Adjust this line if your Edge Function returns
            * a differently named property.
            */
            googleEvents =
                data?.events ??
                data?.items ??
                [];
            }
        } catch (googleCalendarError) {
            console.error(
            "Google Calendar request failed:",
            googleCalendarError
            );
        }

        const normalizedOfferlyEvents = (offerlyEvents ?? []).map(
            (event) => ({
            id: `offerly-${event.id}`,
            title: event.title ?? "Untitled event",
            eventType: event.event_type ?? "",
            description: event.description ?? "",
            startTime: event.start_time,
            source: "offerly",
            })
        );

        const normalizedGoogleEvents = googleEvents.map((event) => ({
            id: `google-${event.id}`,
            title: event.summary ?? event.title ?? "Untitled event",

            eventType:
            event.event_type ??
            event.eventType ??
            "",

            description: event.description ?? "",

            startTime:
            event.start?.dateTime ??
            event.start?.date ??
            event.start_time,

            source: "google",
        }));

        return [
            ...normalizedOfferlyEvents,
            ...normalizedGoogleEvents,
        ]
            .filter((event) => {
            const eventDate = new Date(event.startTime);

            return (
                !Number.isNaN(eventDate.getTime()) &&
                eventDate >= now &&
                eventDate <= twoWeeksFromNow
            );
            })
            .sort(
            (firstEvent, secondEvent) =>
                new Date(firstEvent.startTime) -
                new Date(secondEvent.startTime)
            );
    }

    async function handleGenerateActions() {
        setGeneratingActions(true);
        setActionsError("");

        try {
            const calendarEvents =
            await fetchUpcomingCalendarEvents();

            const generatedActions = [];

            /*
            * Calendar events are given highest priority.
            */
            calendarEvents.forEach((event) => {
            const searchableText = normalizeText(
                [
                event.title,
                event.eventType,
                event.description,
                ].join(" ")
            );

            const isInterview =
                searchableText.includes("interview") ||
                searchableText.includes("phone screen") ||
                searchableText.includes("recruiter screen") ||
                searchableText.includes("technical screen");

            const isAssessment =
                searchableText.includes("assessment") ||
                searchableText.includes("oa") ||
                searchableText.includes("coding test") ||
                searchableText.includes("hackerrank");

            const isCareerEvent =
                isInterview ||
                isAssessment ||
                searchableText.includes("career") ||
                searchableText.includes("recruiter") ||
                searchableText.includes("networking") ||
                searchableText.includes("job fair");

            if (isInterview) {
                generatedActions.push({
                id: `interview-${event.id}`,
                type: "interview",
                icon: "🎯",
                title: event.title,
                subtitle:
                    "Review the job description, prepare questions, and practice your introduction.",
                date: formatActionDate(event.startTime),
                priority: 1,
                });

                return;
            }

            if (isAssessment) {
                generatedActions.push({
                id: `assessment-${event.id}`,
                type: "deadline",
                icon: "⌨️",
                title: event.title,
                subtitle:
                    "Block off uninterrupted time and review likely assessment topics.",
                date: formatActionDate(event.startTime),
                priority: 2,
                });

                return;
            }

            if (isCareerEvent) {
                generatedActions.push({
                id: `career-${event.id}`,
                type: "deadline",
                icon: "📅",
                title: event.title,
                subtitle:
                    "Prepare any materials or questions you will need before this event.",
                date: formatActionDate(event.startTime),
                priority: 3,
                });
            }
            });

            /*
            * Find applications old enough for a follow-up.
            */
            const followUpCandidates = applications
            .filter((application) => {
                const status = normalizeText(application.status);

                const closedStatuses = [
                "rejected",
                "rejection",
                "offer",
                "offered",
                "accepted",
                "declined",
                ];

                if (closedStatuses.includes(status)) {
                return false;
                }

                const dateValue = getApplicationDate(application);

                if (!dateValue) {
                return false;
                }

                const appliedDate = new Date(dateValue);

                if (Number.isNaN(appliedDate.getTime())) {
                return false;
                }

                const daysSinceApplication = Math.floor(
                (Date.now() - appliedDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                return (
                daysSinceApplication >= 7 &&
                daysSinceApplication <= 21
                );
            })
            .sort(
                (first, second) =>
                new Date(getApplicationDate(first)) -
                new Date(getApplicationDate(second))
            )
            .slice(0, 2);

            followUpCandidates.forEach((application) => {
            const appliedDate = new Date(
                getApplicationDate(application)
            );

            const daysAgo = Math.floor(
                (Date.now() - appliedDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );

            generatedActions.push({
                id: `followup-${application.id}`,
                type: "followup",
                icon: "✉️",
                title: `Follow up with ${application.company}`,
                subtitle: `${application.role} application submitted ${daysAgo} days ago.`,
                date: "Follow up",
                priority: 4,
            });
            });

            /*
            * Measure this week's application activity.
            */
            const startOfWeek = new Date();
            const currentDay = startOfWeek.getDay();
            const daysSinceMonday =
            currentDay === 0 ? 6 : currentDay - 1;

            startOfWeek.setDate(
            startOfWeek.getDate() - daysSinceMonday
            );

            startOfWeek.setHours(0, 0, 0, 0);

            const applicationsThisWeek = applications.filter(
            (application) => {
                const dateValue = getApplicationDate(application);

                if (!dateValue) {
                return false;
                }

                const applicationDate = new Date(dateValue);

                return (
                !Number.isNaN(applicationDate.getTime()) &&
                applicationDate >= startOfWeek
                );
            }
            ).length;

            if (applicationsThisWeek < 5) {
            generatedActions.push({
                id: "weekly-application-goal",
                type: "ai",
                icon: "💡",
                title: "Continue your weekly application goal",
                subtitle: `You have submitted ${applicationsThisWeek} application${
                applicationsThisWeek === 1 ? "" : "s"
                } this week. Try to reach at least 5.`,
                date: "This week",
                priority: 5,
            });
            }

            /*
            * Add a useful fallback when no urgent action exists.
            */
            if (generatedActions.length === 0) {
            generatedActions.push(
                {
                id: "networking-suggestion",
                type: "ai",
                icon: "🤝",
                title: "Make one networking connection",
                subtitle:
                    "Reach out to an alumnus, recruiter, or engineer at a company you are targeting.",
                date: "Today",
                priority: 6,
                },
                {
                id: "interview-prep-suggestion",
                type: "ai",
                icon: "🧠",
                title: "Complete one interview-prep session",
                subtitle:
                    "Practice one technical problem and one behavioral response.",
                date: "Today",
                priority: 7,
                }
            );
            }

            const uniqueActions = Array.from(
            new Map(
                generatedActions.map((action) => [
                action.id,
                action,
                ])
            ).values()
            );

            setNextActions(
            uniqueActions
                .sort(
                (first, second) =>
                    first.priority - second.priority
                )
                .slice(0, 4)
            );
        } catch (error) {
            console.error(error);

            setActionsError(
            "We couldn't generate suggestions right now."
            );
        } finally {
            setGeneratingActions(false);
        }
    }

    async function fetchApplications() {

        const { data, error } = await supabase
            .from("applications")
            .select("*");

        if (error) {
            console.error(error.message);
            return;
        }

        setApplications(data);
    }

    return (
        <div className="dashboard-page">
            <div className="page-header">
            <h1>Dashboard</h1>

            <p>Your job search at a glance.</p>
            </div>

            <div className="dashboard-analytics-grid">
                <ApplicationFunnel applications={applications} />

                <ApplicationsOverTime applications={applications} />
            </div>

            <div className="dashboard-top-grid">
            <StatCard title="Professional Network">
                <div className="network-pipeline">
                    <div className="network-stats-grid">
                    <div className="network-stat">
                        <span className="network-stat-value total">
                            {networkStats.total}
                        </span>
                        <span className="network-stat-label">
                            Total Contacts
                        </span>
                    </div>

                    <div className="network-stat">
                        <span className="network-stat-value awaiting">
                            {networkStats.awaitingResponse}
                        </span>
                        <span className="network-stat-label">
                            Awaiting Response
                        </span>
                    </div>

                    <div className="network-stat">
                        <span className="network-stat-value followups">
                            {networkStats.activeConversations}
                        </span>

                        <span className="network-stat-label">
                            Active Conversations
                        </span>
                    </div>

                    <div className="network-stat">
                        <span className="network-stat-value referrals">
                            {networkStats.referrals}
                        </span>
                        <span className="network-stat-label">
                            Referrals
                        </span>
                    </div>
                    </div>

                    <div className="network-followups-header">
                    <h3>Active Conversations</h3>

                    <button
                        type="button"
                        className="network-view-all"
                        onClick={() => navigate("/networking")}
                    >
                        View all
                    </button>
                    </div>

                    {upcomingFollowUps.length > 0 ? (
                    <div className="network-followups-list">
                        {contacts
                            .filter(contact =>
                                [
                                    "Awaiting Response",
                                    "Coffee Chat Scheduled",
                                    "Responded",
                                    "Interview Scheduled",
                                    "Referral Received",
                                ].includes(contact.status)
                            )
                            .slice(0, 3)
                            .map((contact) => (
                        <div
                            key={contact.id}
                            className="network-followup-item"
                        >
                            <div className="network-contact-avatar">
                            {contact.name?.charAt(0).toUpperCase() || "?"}
                            </div>

                            <div className="network-contact-info">
                            <h4>{contact.name}</h4>

                            <p>
                                {[contact.role, contact.company]
                                .filter(Boolean)
                                .join(" at ") || "No company added"}
                            </p>
                            </div>

                            <span className={`network-status ${contact.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                                {contact.status}
                            </span>
                        </div>
                        ))}
                    </div>
                    ) : (
                    <div className="network-empty-state">
                        <div className="network-empty-icon">🤝</div>

                        <h3>No active conversations</h3>

                        <p>
                            Start reaching out to your contacts and active conversations will appear here.
                        </p>

                        <button
                        type="button"
                        className="network-add-contact-button"
                        onClick={() => navigate("/networking")}
                        >
                        Add Contact
                        </button>
                    </div>
                    )}
                </div>
            </StatCard>

            <StatCard title="Recent Applications">
                <ul className="recent-applications-list">
                {(stats.recentApplications ?? []).map((app) => (
                    <li
                    key={app.id}
                    className="recent-application-item"
                    >
                    <div className="application-logo">
                        {app.company?.charAt(0) || "?"}
                    </div>

                    <div className="application-info">
                        <h4>{app.company}</h4>
                        <p>{app.role}</p>
                    </div>

                    <div className="application-status">
                        <span
                        className={`status-pill ${
                            app.status
                            ?.toLowerCase()
                            .replace(/\s+/g, "-") || "applied"
                        }`}
                        >
                        {app.status || "Applied"}
                        </span>
                    </div>
                    </li>
                ))}
                </ul>
            </StatCard>
            </div>
        </div>
    );
}