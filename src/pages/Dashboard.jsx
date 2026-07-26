import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";

import StatCard from "../dashboard/StatCard";
import ApplicationStatusChart from "../dashboard/ApplicationStatusChart";

import { getApplicationStats } from "../utils/applicationStats";

export default function Dashboard() {

    const [applications, setApplications] = useState([]);

    useEffect(() => {
        fetchApplications();
    }, []);

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
        <>
            <div className="page-header">

                <h1>Dashboard</h1>

                <p>
                    Your job search at a glance.
                </p>

            </div>

            <div className="stats-grid">

                <StatCard
                    title="Applications"
                    value={stats.total}
                />

                <StatCard
                    title="Interviews"
                    value={stats.interviews}
                />

                <StatCard
                    title="Offers"
                    value={stats.offers}
                />

                <StatCard
                    title="Rejections"
                    value={stats.rejections}
                />

                <StatCard
                    title="Response Rate"
                    value={`${stats.responseRate}%`}
                />

                <StatCard
                    title="Interview Rate"
                    value={`${stats.interviewRate}%`}
                />

                <StatCard
                    title="Offer Rate"
                    value={`${stats.offerRate}%`}
                />

                <StatCard title="Upcoming Interviews">
                    <ul className="stat-list">
                        {stats.upcomingInterviews.map((interview) => (
                        <li key={interview.id}>
                            <strong>{interview.company}</strong>
                            <div>
                            {new Date(
                                interview.interview_date ??
                                interview.start_time
                            ).toLocaleDateString()}
                            </div>
                        </li>
                        ))}
                    </ul>
                </StatCard>

                <StatCard title="Recent Applications">
                    <ul className="stat-list">
                        {stats.recentApplications.map((app) => (
                        <li key={app.id}>
                            <strong>{app.company}</strong>
                            <div>{app.role}</div>
                        </li>
                        ))}
                    </ul>
                </StatCard>

            </div>

            <ApplicationStatusChart
                applications={applications}
            />

        </>
    );
}