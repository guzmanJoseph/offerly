import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import "./dashboard.css";

export default function ApplicationStatusChart({ applications }) {
  const chartData = [
    {
      name: "Applied",
      value: applications.filter(app => app.status === "Applied").length,
    },
    {
      name: "Interview",
      value: applications.filter(app => app.status === "Interview").length,
    },
    {
      name: "Offer",
      value: applications.filter(app => app.status === "Offer").length,
    },
    {
      name: "Rejected",
      value: applications.filter(app => app.status === "Rejected").length,
    },
    {
      name: "Ghosted",
      value: applications.filter(app => app.status === "Ghosted").length,
    },
  ];

  const colors = ["#2563eb", "#7c3aed", "#16a34a", "#dc2626", "#64748b"];

  return (
    <div className="chart-card">
      <h2>Applications by Status</h2>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index]} />
            ))}
          </Pie>

          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}