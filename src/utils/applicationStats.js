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

  const upcomingInterviews = [];

  const recentApplications = [...applications]
    .sort(
      (a, b) =>
        new Date(b.created_at) -
        new Date(a.created_at)
    )
    .slice(0, 3);


  return {
    total,
    interviews,
    offers,
    rejections,
    responseRate,
    interviewRate,
    offerRate,
    upcomingInterviews,
    recentApplications,
  };
}