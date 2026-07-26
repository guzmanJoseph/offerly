import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import { supabase } from "../lib/supabaseClient";
import ApplicationFunnel from "../dashboard/ApplicationFunnel";
import StatCard from "../dashboard/StatCard";
import ApplicationsOverTime from "../dashboard/ApplicationsOverTime";

import { getApplicationStats } from "../utils/applicationStats";

export default function Dashboard() {

    const [applications, setApplications] = useState([]);
    const [nextActions, setNextActions] = useState([]);
    const [generatingActions, setGeneratingActions] = useState(false);
    const [actionsError, setActionsError] = useState("");

    useEffect(() => {
        fetchApplications();
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

    const stats = getApplicationStats(applications);

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
            <StatCard title="Upcoming & Next Actions">
                <div className="next-actions-list">
                {nextActions.length > 0 ? (
                    nextActions.map((action) => (
                    <div
                        key={action.id}
                        className="next-action-item"
                    >
                        <div className={`action-icon ${action.type}`}>
                        {action.icon}
                        </div>

                        <div className="action-info">
                        <h4>{action.title}</h4>
                        <p>{action.subtitle}</p>
                        </div>

                        <span className="action-date">
                        {action.date}
                        </span>
                    </div>
                    ))
                ) : (
                    <div className="empty-actions">
                    <div className="empty-actions-icon">
                        ✨
                    </div>

                    <h3>Nothing scheduled</h3>

                    <p>
                        You're all caught up. Generate a few suggestions
                        to keep your job search moving.
                    </p>

                    <button
                        type="button"
                        className="generate-actions-button"
                        onClick={handleGenerateActions}
                        disabled={generatingActions}
                    >
                        {generatingActions
                            ? "Reviewing your schedule..."
                            : "Generate Smart Suggestions"}
                        </button>

                    {actionsError && (
                        <p className="actions-error">
                            {actionsError}
                        </p>
                    )}
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