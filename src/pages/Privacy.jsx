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

        <p className="privacy-updated">Last Updated • October 2026</p>

        <p>
          Offerly helps users organize their job search by saving job postings,
          tracking applications, organizing networking contacts, and monitoring
          recruiting progress. This policy explains what information Offerly
          collects, how it is used, and how you can manage or delete it.
        </p>

        <h2>Information We Collect</h2>

        <ul>
          <li>
            Account information, such as the email address and account
            identifiers used to create and manage your Offerly account.
          </li>
          <li>
            Information you choose to save in Offerly, including job postings,
            application details, notes, and networking contacts.
          </li>
          <li>
            Technical and diagnostic information needed to operate and secure
            Offerly.
          </li>
          <li>
            Optional Gmail information, if you choose to connect your Gmail
            account.
          </li>
        </ul>

        <h2>Gmail Access and Use</h2>

        <p>
          If you connect Gmail, Offerly uses the Gmail API to read email
          messages and identify recruiting-related updates. This can include
          message senders, subjects, dates, and message text. Offerly uses this
          information to identify application confirmations, assessments,
          interviews, rejections, offers, and other recruiting updates, and to
          create or update records in your Offerly application tracker.
        </p>

        <p>
          Offerly does not send, modify, or delete messages in your Gmail
          account. Gmail access is optional, and you can disconnect Gmail in
          Offerly at any time.
        </p>

        <h2>How We Use Information</h2>

        <p>
          We use information to provide and maintain Offerly’s features,
          including saving job postings, managing applications and networking
          contacts, and importing recruiting updates from Gmail when you connect
          it.
        </p>

        <p>
          We use Google user data only to provide the Offerly features described
          in this policy. We do not sell Google user data, use it for
          advertising, or use it to train generalized artificial intelligence
          or machine-learning models.
        </p>

        <h2>Chrome Extension</h2>

        <p>
          When you explicitly choose to save a job using the Offerly Chrome
          Extension, it reads information from the currently open job page to
          help create a job record. It does not monitor your browsing activity
          or collect information from other websites.
        </p>

        <h2>AI Processing</h2>

        <p>
          Offerly may use the OpenAI API to classify recruiting messages and
          extract job-related details needed for Offerly features. Offerly may
          also use AI to extract structured information from job postings you
          choose to save. When this processing is used, information is sent to
          OpenAI for that purpose.
        </p>

        <p>
          OpenAI states that API data is not used to train or improve its models
          by default. OpenAI may retain API content in abuse-monitoring logs for
          up to 30 days by default, subject to its stated exceptions. Offerly
          does not opt in to using Google user data to train generalized models.
        </p>

        <h2>Data Sharing</h2>

        <p>We do not sell your personal information or Google user data.</p>

        <p>
          We share information with service providers only as needed to operate
          Offerly. These providers include Supabase for database, authentication,
          and backend infrastructure, and OpenAI when Offerly uses its API to
          process recruiting messages or job postings. They process information
          to provide services to Offerly under their applicable terms and
          policies.
        </p>

        <h2>Gmail Data Retention and Deletion</h2>

        <p>
          Offerly retains application information created from Gmail, such as
          employer, role, and recruiting status, while it is associated with
          your Offerly account. You can delete saved application records or
          request deletion of your Offerly account.
        </p>

        <p>
          When you disconnect Gmail, Offerly stops future Gmail access and syncs
          and deletes the stored Gmail authorization tokens. Disconnecting Gmail
          does not automatically delete application records already saved in
          Offerly.
        </p>

        <p>
          If you request deletion of your Offerly account, we will delete your
          account information and associated application data from active
          systems within 30 days. Protected backup copies may remain until they
          are overwritten in the normal backup cycle. We may retain information
          longer where required by law or for security purposes.
        </p>

        <p>
          You can also revoke Offerly’s access in your Google Account security
          settings. Revoking access prevents future Gmail access but does not
          delete information already stored in Offerly.
        </p>

        <h2>Data Security</h2>

        <p>
          We use reasonable safeguards designed to protect information from
          unauthorized access, use, or disclosure. Data is transmitted over
          HTTPS, and access to stored information is limited to what is needed
          to operate and secure Offerly.
        </p>

        <h2>Your Choices and Requests</h2>

        <p>
          You can choose whether to connect Gmail, disconnect it at any time,
          and request deletion of your information or Offerly account. To make a
          privacy or deletion request, contact us using the email below.
        </p>

        <h2>Google API Services Limited Use</h2>

        <p>
          Offerly’s use and transfer of information received from Google APIs
          will adhere to the Google API Services User Data Policy, including its
          Limited Use requirements.
        </p>

        <h2>Changes to This Policy</h2>

        <p>
          We may update this policy as Offerly’s features or data practices
          change. We will update the date above when we make changes. If a
          change affects how Offerly accesses or uses Google user data, we will
          provide notice and request consent where required.
        </p>

        <h2>Contact</h2>

        <div className="contact-card">
          <p>Questions, privacy requests, or account deletion requests?</p>

          <p>
            Email us at{" "}
            <a href="mailto:jguzmannn05@gmail.com">jguzmannn05@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}