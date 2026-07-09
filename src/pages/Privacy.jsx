import "../styles/privacy.css";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="privacy-page">
      <div className="privacy-container">

        <Link to="/" className="privacy-home">
          ← Back to Home
        </Link>

        <h1 className="privacy-title">Offerly Privacy Policy</h1>

        <p className="privacy-updated">
          Last Updated • July 2026
        </p>

        <p>
          Offerly helps users organize and manage their job search by allowing
          them to save job postings, track applications, organize networking
          contacts, and monitor recruiting progress.
        </p>

        <h2>Information We Collect</h2>

        <ul>
          <li>Email address used to create your Offerly account.</li>
          <li>Job applications you choose to save.</li>
          <li>Job information such as company, role, location, and URL.</li>
          <li>Optional Gmail data if you choose to connect Gmail.</li>
        </ul>

        <h2>How We Use Your Information</h2>

        <p>
          Your information is used only to provide Offerly's features,
          including tracking applications, organizing your job search,
          importing recruiting emails, and managing networking contacts.
        </p>

        <h2>Chrome Extension</h2>

        <p>
          The Offerly Chrome Extension only reads the currently open job page
          when you explicitly save a job. It does not monitor your browsing or
          collect information from other websites.
        </p>

        <h2>AI Processing</h2>

        <p>
          Offerly may use AI services to extract structured information from job
          postings solely to improve the application's features.
        </p>

        <h2>Data Sharing</h2>

        <p>
          We do not sell your personal information. Data is shared only with
          trusted infrastructure providers required to operate Offerly.
        </p>

        <h2>Data Security</h2>

        <p>
          We use reasonable technical and organizational safeguards to help
          protect your information from unauthorized access.
        </p>

        <h2>Contact</h2>

        <div className="contact-card">
          <p>
            Questions about this Privacy Policy?
          </p>

          <p>
            Email us at{" "}
            <a href="mailto:jguzmannn05@gmail.com">
              jguzmannn05@gmail.com
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}