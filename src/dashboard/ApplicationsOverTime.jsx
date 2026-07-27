import { Line } from "react-chartjs-2";
import "../styles/applicationsovertime.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

function getStartOfWeek(date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  // Makes Monday the first day of the week.
  const day = result.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - daysSinceMonday);

  return result;
}

function createWeekKey(date) {
  const weekStart = getStartOfWeek(date);

  return [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, "0"),
    String(weekStart.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatWeekLabel(date) {
  return `Week of ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function parseApplicationDate(value) {
  if (!value) return null;

  // Prevent YYYY-MM-DD dates from being interpreted as UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime())
    ? null
    : parsedDate;
}

export default function ApplicationsOverTime({
  applications = [],
}) {
  const validApplications = applications
    .map((application) => {
      const dateValue =
        application.created_at ??
        application.applied_date ??
        application.date_applied;

      if (!dateValue) return null;

      const parsedDate = new Date(dateValue);

      if (!parsedDate) {
        return null;
      }

      return {
        ...application,
        parsedDate,
      };
    })
    .filter(Boolean)
    .sort(
      (first, second) =>
        first.parsedDate - second.parsedDate
    );

  const applicationsByWeek = {};

  validApplications.forEach((application) => {
    const weekKey = createWeekKey(
      application.parsedDate
    );

    applicationsByWeek[weekKey] =
      (applicationsByWeek[weekKey] || 0) + 1;
  });

  const firstApplicationDate =
    validApplications[0]?.parsedDate;

  const currentWeekStart = getStartOfWeek(
    new Date()
  );

  const firstWeekStart = firstApplicationDate
    ? getStartOfWeek(firstApplicationDate)
    : currentWeekStart;

  /*
   * Generate every week between the first application
   * and today. This includes weeks with zero applications,
   * so the chart does not skip inactive weeks.
   */
  const weeks = [];

  for (
    let week = new Date(firstWeekStart);
    week <= currentWeekStart;
    week.setDate(week.getDate() + 7)
  ) {
    weeks.push(new Date(week));
  }

  let cumulativeTotal = 0;

  const chartPoints = weeks.map((weekStart) => {
    const weekKey = createWeekKey(weekStart);

    const applicationsThisWeek =
      applicationsByWeek[weekKey] || 0;

    cumulativeTotal += applicationsThisWeek;

    return {
      weekKey,
      label: formatWeekLabel(weekStart),
      applicationsThisWeek,
      cumulativeApplications: cumulativeTotal,
    };
  });

  const totalApplications =
    validApplications.length;

  const activeWeekCount = Math.max(
    chartPoints.length,
    1
  );

  const averagePerWeek =
    totalApplications > 0
      ? (
          totalApplications / activeWeekCount
        ).toFixed(1)
      : "0.0";

  const currentWeekKey = createWeekKey(
    new Date()
  );

  const applicationsThisWeek =
    applicationsByWeek[currentWeekKey] || 0;

  const data = {
    labels: chartPoints.map(
      (point) => point.label
    ),

    datasets: [
    {
      label: "Total Applications",

      data: chartPoints.map(
        (point) => point.cumulativeApplications
      ),

      fill: true,
      tension: 0.32,

      borderWidth: 2.5,
      borderColor: "#5b9cff",

      backgroundColor: "rgba(66, 133, 255, 0.11)",

      pointRadius: 3,
      pointHoverRadius: 6,

      pointBackgroundColor: "#6da7ff",
      pointBorderColor: "#0d1729",
      pointBorderWidth: 2,

      pointHoverBackgroundColor: "#a5c7ff",
      pointHoverBorderColor: "#0d1729",
      pointHoverBorderWidth: 3,
    },
  ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      intersect: false,
      mode: "index",
    },

    layout: {
      padding: {
        top: 6,
        right: 8,
        bottom: 0,
        left: 0,
      },
    },

    plugins: {
      legend: {
        display: false,
      },

      tooltip: {
        backgroundColor: "rgba(8, 15, 29, 0.96)",
        titleColor: "#f8fafc",
        bodyColor: "#cbd5e1",
        borderColor: "rgba(96, 165, 250, 0.22)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        displayColors: false,

        callbacks: {
          title: (items) =>
            chartPoints[items[0].dataIndex].label,

          label: (context) => {
            const point = chartPoints[context.dataIndex];

            return [
              `Total applications: ${point.cumulativeApplications}`,
              `Added this week: ${point.applicationsThisWeek}`,
            ];
          },
        },
      },
    },

    scales: {
      x: {
        grid: {
          display: false,
        },

        ticks: {
          color: "#64789a",
          font: {
            size: 11,
            weight: "500",
          },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
          padding: 8,
        },

        border: {
          display: false,
        },
      },

      y: {
        beginAtZero: true,

        ticks: {
          color: "#64789a",
          precision: 0,
          stepSize: 1,
          padding: 8,

          font: {
            size: 11,
            weight: "500",
          },
        },

        grid: {
          color: "rgba(120, 145, 185, 0.08)",
          drawTicks: false,
        },

        border: {
          display: false,
        },
      },
    },
  };

  return (
    <section className="applications-over-time-card">
      <div className="dashboard-card-header">
        <div>
          <h2>Applications Over Time</h2>

          <p>
            Your cumulative application progress
            by week.
          </p>
        </div>
      </div>

      <div className="applications-over-time-summary">
        <div>
          <span>Total Applications</span>
          <strong>{totalApplications}</strong>
        </div>

        <div>
          <span>Average Per Week</span>
          <strong>{averagePerWeek}</strong>
        </div>

        <div>
          <span>Applications This Week</span>
          <strong>{applicationsThisWeek}</strong>
        </div>
      </div>

      {chartPoints.length > 0 &&
      totalApplications > 0 ? (
        <div className="applications-over-time-chart">
          <Line
            data={data}
            options={options}
          />
        </div>
      ) : (
        <div className="applications-over-time-empty">
          <strong>
            No application data yet
          </strong>

          <p>
            Add an application to start tracking
            your progress.
          </p>
        </div>
      )}
    </section>
  );
}