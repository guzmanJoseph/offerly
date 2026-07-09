import "../styles/home.css";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="home">
      <div className="home-glow glow-one"></div>
      <div className="home-glow glow-two"></div>

      <nav className="home-navbar">
        <Link to="/" className="home-logo">
          <span className="logo-mark">O</span>
          Offerly
        </Link>

        <div className="home-nav-links">
          <a href="#features">Features</a>
          <a href="#extension">Extension</a>
          <Link to="/privacy">Privacy</Link>
        </div>

        <Link to="/auth" className="home-login">
          Login
        </Link>
      </nav>

      <section className="home-hero">
        <div className="hero-content">
          <span className="home-badge">
            ✨ Job Search Management Platform
          </span>

          <h1>
            Turn job hunting chaos into a clean, organized system.
          </h1>

          <p>
            Track applications, import Gmail updates, save jobs with the
            Chrome Extension, manage networking, and stay ready for every
            interview.
          </p>

          <div className="hero-actions">
            <Link to="/auth" className="home-primary-btn">
              Start for Free
            </Link>

            <a
              href="https://chromewebstore.google.com/detail/fphkldkkmkhefaknadkfekeappojnoji?utm_source=item-share-cb"
              className="home-secondary-btn"
              target="_blank"
              rel="noreferrer"
            >
              Add Chrome Extension
            </a>
          </div>

          <div className="hero-mini-stats">
            <span>28 applications</span>
            <span>4 interviews</span>
            <span>1 offer</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-card card-one">
            <span>Google</span>
            <strong>Interview Scheduled</strong>
          </div>

          <div className="floating-card card-two">
            <span>LinkedIn Job</span>
            <strong>Saved to Offerly</strong>
          </div>

          <img
            src="/offerly.png"
            alt="Offerly Dashboard Preview"
            className="dashboard-preview"
          />
        </div>
      </section>

      <section id="features" className="home-features">
        <div className="section-heading">
          <span>Features</span>
          <h2>Everything your job search needs.</h2>
          <p>
            Offerly keeps your applications, emails, contacts, and interviews
            in one smooth workflow.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📋</div>
            <h3>Application Tracking</h3>
            <p>Track company, role, status, priority, notes, and dates.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📧</div>
            <h3>Gmail Import</h3>
            <p>Pull job-related emails into your dashboard automatically.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤝</div>
            <h3>Networking CRM</h3>
            <p>Manage recruiters, alumni, referrals, and follow-ups.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <h3>Calendar View</h3>
            <p>See interviews, deadlines, and reminders in one place.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🧩</div>
            <h3>Chrome Extension</h3>
            <p>Save jobs from job boards without leaving the page.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Job Search Insights</h3>
            <p>Understand your response rate and follow-up opportunities.</p>
          </div>
        </div>
      </section>

      <section id="extension" className="home-extension">
        <div className="extension-copy">
          <span>Chrome Extension</span>
          <h2>Save jobs instantly from the web.</h2>
          <p>
            Browse job boards like normal. When you find a role you like, save
            it directly into Offerly with one click.
          </p>

          <a
            href="https://chromewebstore.google.com/detail/fphkldkkmkhefaknadkfekeappojnoji?utm_source=item-share-cb"
            className="home-primary-btn"
            target="_blank"
            rel="noreferrer"
          >
            Download Extension
          </a>
        </div>

        <div className="extension-preview-wrap">
          <img
            src="/offerly-extension.png"
            alt="Offerly Chrome Extension"
            className="extension-preview"
          />
        </div>
      </section>

      <section className="home-cta">
        <h2>Ready to make your job search feel easier?</h2>
        <p>Start organizing applications, interviews, emails, and contacts today.</p>

        <Link to="/auth" className="home-primary-btn">
          Create Free Account
        </Link>
      </section>

      <footer className="home-footer">
        <span>Offerly</span>
        <p>© 2026 Offerly. Built to help you land your next offer.</p>
      </footer>
    </div>
  );
}