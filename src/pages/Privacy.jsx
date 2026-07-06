export default function Privacy() {
  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "50px auto",
        padding: "24px",
        color: "white",
        lineHeight: 1.8,
      }}
    >
      <h1>Privacy Policy</h1>

      <p><strong>Last Updated:</strong> July 2026</p>

      <p>
        Offerly is a job application tracking platform designed to help users
        organize their job search and save job postings from supported websites.
      </p>

      <h2>Information We Collect</h2>

      <ul>
        <li>Email address (for account authentication)</li>
        <li>Job application information you choose to save</li>
        <li>Job posting details such as company, role, location, and job URL</li>
      </ul>

      <h2>How We Use Information</h2>

      <p>
        We use this information solely to provide Offerly's job tracking
        features, synchronize your applications, and improve the user
        experience.
      </p>

      <h2>Chrome Extension</h2>

      <p>
        The Offerly Chrome Extension only accesses the active job posting page
        after you open the extension. It extracts job details from the page and
        saves them to your Offerly account. The extension does not continuously
        monitor your browsing activity.
      </p>

      <h2>AI Processing</h2>

      <p>
        Job posting content may be securely processed by AI services to extract
        structured information such as company name, job title, and location.
        This processing is performed only to provide the extension's
        functionality.
      </p>

      <h2>Data Sharing</h2>

      <p>
        Offerly does not sell your personal information. Information is shared
        only with trusted service providers required to operate the application,
        including authentication, database hosting, and AI processing.
      </p>

      <h2>Contact</h2>

      <p>
        Questions about this Privacy Policy may be directed through the Offerly
        website.
      </p>
    </div>
  );
}