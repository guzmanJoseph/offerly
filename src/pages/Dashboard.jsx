import StatCard from "../dashboard/StatCard";

import { sampleApplications } from "../data/sampleApplications";
import { getApplicationStats } from "../utils/applicationStats";
import ApplicationStatusChart from "../dashboard/ApplicationStatusChart";

export default function Dashboard() {

    const stats = getApplicationStats(sampleApplications);

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
                    title="Ghosted"
                    value={stats.ghosted} // add a value here for ghosted applications if you have that data
                />

                <StatCard
                    title="Follow-Ups Needed"
                    value={stats.followUps} // add a value here for follow-ups if you have that data
                />

                <StatCard
                    title="Response Rate"
                    value={stats.responseRate} // add a value here for response rate if you have that data
                />

                <StatCard
                    title="Interview Rate"
                    value={stats.interviewRate} // add a value here for interview rate if you have that data
                />

                <StatCard
                    title="Offer Rate"
                    value={stats.offerRate} // add a value here for offer rate if you have that data
                />

                <StatCard
                    title="Upcoming Interviews"
                    value={stats.upcomingInterviews} // add a value here for upcoming interviews if you have that data
                />

                <StatCard
                    title="Recent Applications"
                    value={stats.recentApplications} // add a value here for recent applications if you have that data
                />

            </div>

            <ApplicationStatusChart applications={sampleApplications} />
        </>
    );
}