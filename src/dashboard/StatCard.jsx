export default function StatCard({
  title,
  value,
  children,
}) {
  return (
    <div className="stat-card">
      <h3>{title}</h3>

      {children ? (
        children
      ) : (
        <h2>{value}</h2>
      )}
    </div>
  );
}