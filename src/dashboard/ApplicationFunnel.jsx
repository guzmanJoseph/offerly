// should be fixed
import "../styles/applicationfunnel.css";

export default function ApplicationFunnel({
  applications = [],
}) {
  const normalizeStatus = (status = "") =>
    status.trim().toLowerCase();

  const statuses = applications.map((application) =>
    normalizeStatus(application.status)
  );

  const totalApplications = applications.length;

  const rejectionStatuses = [
    "rejected",
    "rejection",
    "declined",
    "not selected",
  ];

  const interviewStatuses = [
    "interview",
    "interviewing",
    "phone screen",
    "recruiter screen",
    "first round",
    "technical interview",
  ];

  const nextRoundStatuses = [
    "second round",
    "next round",
    "final round",
    "onsite",
    "superday",
  ];

  const offerStatuses = [
    "offer",
    "offered",
    "accepted",
  ];

  const responseStatuses = [
    ...rejectionStatuses,
    ...interviewStatuses,
    ...nextRoundStatuses,
    ...offerStatuses,
  ];

  const countMatchingStatuses = (allowedStatuses) =>
    statuses.filter((status) =>
      allowedStatuses.includes(status)
    ).length;

  const responses = countMatchingStatuses(
    responseStatuses
  );

  const interviews = countMatchingStatuses([
    ...interviewStatuses,
    ...nextRoundStatuses,
    ...offerStatuses,
  ]);

  const nextRounds = countMatchingStatuses([
    ...nextRoundStatuses,
    ...offerStatuses,
  ]);

  const offers = countMatchingStatuses(
    offerStatuses
  );

  const rejections = countMatchingStatuses(
    rejectionStatuses
  );

  const stages = [
    {
      label: "Applications",
      value: totalApplications,
    },
    {
      label: "Responses",
      value: responses,
    },
    {
      label: "Interviews",
      value: interviews,
    },
    {
      label: "Next Rounds",
      value: nextRounds,
    },
    {
      label: "Offers",
      value: offers,
    },
  ];

  const getPercentage = (value) =>
    totalApplications > 0
      ? Math.round(
          (value / totalApplications) * 100
        )
      : 0;

  return (
    <section className="funnel-card">
      <div className="dashboard-card-header">
        <div>
          <h2>Application Funnel</h2>

          <p>
            Track how your applications progress
            through each hiring stage.
          </p>
        </div>
      </div>

      <div className="application-funnel">
        {stages.map((stage, index) => {
          const percentage = getPercentage(
            stage.value
          );

          return (
            <div
              className="funnel-stage"
              key={stage.label}
            >
              <div
                className="funnel-stage-bar"
                style={{
                  width:
                    index === 0
                      ? "100%"
                      : `${Math.max(
                          percentage,
                          20
                        )}%`,
                }}
              >
                <div>
                  <span className="funnel-stage-label">
                    {stage.label}
                  </span>

                  <strong>{stage.value}</strong>
                </div>

                <span className="funnel-percentage">
                  {percentage}%
                </span>
              </div>

              {index < stages.length - 1 && (
                <div className="funnel-arrow">
                  ↓
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="funnel-outcomes">
        <div className="funnel-outcome">
          <div>
            <span>Rejections</span>
            <strong>{rejections}</strong>
          </div>

          <span className="funnel-outcome-rate">
            {getPercentage(rejections)}%
          </span>
        </div>

        <div className="funnel-outcome">
          <div>
            <span>Still Active</span>

            <strong>
              {Math.max(
                totalApplications -
                  rejections -
                  offers,
                0
              )}
            </strong>
          </div>

          <span className="funnel-outcome-rate">
            {getPercentage(
              Math.max(
                totalApplications -
                  rejections -
                  offers,
                0
              )
            )}
            %
          </span>
        </div>
      </div>
    </section>
  );
}
