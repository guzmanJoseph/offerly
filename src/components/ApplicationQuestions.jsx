
import {
  ProfileField,
  ProfileDropdown
} from "./AutofillFields";

const YES_NO = ["Yes", "No"];
const YES_NO_UNSURE = ["Yes", "No", "Unsure"];

export const DEFAULT_APPLICATION_ANSWERS = {
  // Eligibility
  workAuthorization: "",
  sponsorship: "",
  sponsorshipType: "",
  age18: "",
  securityClearance: "",

  // Job preferences
  relocation: "",
  employmentType: "",
  workArrangement: "",
  willingToTravel: "",
  preferredLocations: "",
  earliestStartDate: "",
  noticePeriod: "",
  salaryExpectation: "",

  // Employer-specific answers
  previouslyEmployed: "",
  previousApplication: "",
  employeeReferral: "",
  referralName: "",

  // Other questions
  backgroundCheck: "",
  nonCompete: "",
  preferredName: "",
  pronouns: "",
  additionalInformation: ""
};

export default function ApplicationQuestions({
  profile,
  update
}) {
  const select = (label, name, options) => (
    <ProfileDropdown
      key={name}
      label={label}
      name={name}
      value={profile[name]}
      options={options}
      onChange={update}
    />
  );

  const field = (label, name, multiline = false) => (
    <ProfileField
      key={name}
      label={label}
      name={name}
      value={profile[name]}
      multiline={multiline}
      onChange={update}
    />
  );

  return (
    <>
      <section className="af-card">
        <h2>Application Questions</h2>
        <p className="af-muted">
          Save answers to frequently asked questions.
          Leave anything you're unsure about blank.
          Review your answers before applying.
        </p>
      </section>

      {/* Work eligibility */}

      <section className="af-card">
        <h2>Work Eligibility</h2>

        <div className="af-grid">
          {select(
            "Are you legally authorized to work in the United States?",
            "workAuthorization",
            YES_NO
          )}

          {select(
            "Will you now or in the future require employer sponsorship?",
            "sponsorship",
            YES_NO_UNSURE
          )}

          {select(
            "Are you at least 18 years old?",
            "age18",
            YES_NO
          )}

          {select(
            "Do you currently hold a security clearance?",
            "securityClearance",
            [
              "No",
              "Public Trust",
              "Confidential",
              "Secret",
              "Top Secret",
              "Top Secret / SCI"
            ]
          )}
        </div>

        {profile.sponsorship === "Yes" && (
          <div className="af-grid">
            {field(
              "Sponsorship details (optional)",
              "sponsorshipType"
            )}
          </div>
        )}
      </section>

      {/* Employment preferences */}

      <section className="af-card">
        <h2>Employment Preferences</h2>

        <div className="af-grid">
          {select(
            "Are you willing to relocate?",
            "relocation",
            ["Yes", "No", "Depends on location"]
          )}

          {select(
            "Preferred employment type",
            "employmentType",
            [
              "Full-time",
              "Part-time",
              "Internship",
              "Contract",
              "Temporary",
              "Flexible"
            ]
          )}

          {select(
            "Preferred work arrangement",
            "workArrangement",
            [
              "Remote",
              "Hybrid",
              "On-site",
              "Flexible"
            ]
          )}

          {select(
            "Are you willing to travel for work?",
            "willingToTravel",
            [
              "Yes",
              "No",
              "Up to 25%",
              "Up to 50%",
              "Up to 75%"
            ]
          )}

          {field(
            "Preferred work locations",
            "preferredLocations"
          )}

          {field(
            "Earliest start date (YYYY-MM-DD)",
            "earliestStartDate"
          )}

          {select(
            "Required notice period",
            "noticePeriod",
            [
              "Immediately available",
              "1 week",
              "2 weeks",
              "3 weeks",
              "4 weeks",
              "More than 4 weeks"
            ]
          )}

          {field(
            "Expected annual salary (USD)",
            "salaryExpectation"
          )}
        </div>
      </section>

      {/* Application history */}

      <section className="af-card">
        <h2>Application History</h2>

        <p className="af-muted">
          These answers are company-specific.
          Offerly should ask you to confirm them
          for each employer rather than reuse them automatically.
        </p>

        <div className="af-grid">
          {select(
            "Have you previously worked for this company?",
            "previouslyEmployed",
            YES_NO
          )}

          {select(
            "Have you previously applied to this company?",
            "previousApplication",
            YES_NO
          )}

          {select(
            "Were you referred by an employee?",
            "employeeReferral",
            YES_NO
          )}

          {profile.employeeReferral === "Yes" && field(
            "Employee referral name",
            "referralName"
          )}
        </div>
      </section>

      {/* Additional information */}

      <section className="af-card">
        <h2>Additional Questions</h2>

        <div className="af-grid">
          {select(
            "Are you willing to undergo a background check?",
            "backgroundCheck",
            ["Yes", "No", "Depends on requirements"]
          )}

          {select(
            "Are you subject to a non-compete agreement?",
            "nonCompete",
            YES_NO_UNSURE
          )}

          {field(
            "Preferred name (optional)",
            "preferredName"
          )}

          {field(
            "Pronouns (optional)",
            "pronouns"
          )}
        </div>

        {field(
          "Additional information or saved notes",
          "additionalInformation",
          true
        )}
      </section>

      <section className="af-card">
        <h2>Voluntary Self-Identification</h2>

        <p className="af-muted">
          Some employers ask optional questions about
          demographic information, veteran status,
          and disability status.
        </p>

        <p className="af-muted">
          Offerly will leave these questions for you to
          answer directly on the application.
          We won't infer or preselect those answers.
        </p>
      </section>
    </>
  );
}
