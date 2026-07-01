export function getApplicationStats(applications) {
  const total = applications.length;

  const interviews = applications.filter(app =>
    app.status === "Interview"
  ).length;

  const offers = applications.filter(app =>
    app.status === "Offer"
  ).length;

  const rejections = applications.filter(app =>
    app.status === "Rejected"
  ).length;

  const ghosted = applications.filter(app =>
    app.status === "Ghosted"
  ).length;

  const responses = interviews + offers + rejections;

  const responseRate = total
    ? Math.round((responses / total) * 100)
    : 0;

  const interviewRate = total
    ? Math.round((interviews / total) * 100)
    : 0;

  const offerRate = total
    ? Math.round((offers / total) * 100)
    : 0;

  return {
    total,
    interviews,
    offers,
    rejections,
    ghosted,
    responseRate,
    interviewRate,
    offerRate
  };
}