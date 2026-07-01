export function getApplicationStats(applications) {

    const total = applications.length;

    const interviews = applications.filter(
        app => app.status === "Interview"
    ).length;

    const offers = applications.filter(
        app => app.status === "Offer"
    ).length;

    const rejections = applications.filter(
        app => app.status === "Rejected"
    ).length;

    return {
        total,
        interviews,
        offers,
        rejections
    };
}