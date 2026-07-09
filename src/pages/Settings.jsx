// src/pages/Settings.jsx
import "../styles/Settings.css";
import React from "react";

export default function Settings({ user }) {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account, preferences, and app data.</p>
      </div>

      <section className="settings-card">
        <h2>Profile</h2>

        <label>
          Display Name
          <input placeholder="Your name" />
        </label>

        <label>
          Email
          <input value={user?.email || ""} disabled />
        </label>

        <button className="primary-btn">Save Changes</button>
      </section>

      <section className="settings-card">
        <h2>Preferences</h2>

        <div className="setting-row">
          <div>
            <h3>Dark Mode</h3>
            <p>Use the dark theme across the app.</p>
          </div>
          <input type="checkbox" defaultChecked />
        </div>

        <div className="setting-row">
          <div>
            <h3>Default View</h3>
            <p>Choose what page opens first.</p>
          </div>
          <select>
            <option>Dashboard</option>
            <option>Applications</option>
            <option>Calendar</option>
          </select>
        </div>
      </section>

      <section className="settings-card">
        <h2>Notifications</h2>

        <div className="setting-row">
          <div>
            <h3>Application Reminders</h3>
            <p>Remind me to follow up on saved jobs.</p>
          </div>
          <input type="checkbox" />
        </div>

        <div className="setting-row">
          <div>
            <h3>Interview Alerts</h3>
            <p>Notify me before upcoming interviews.</p>
          </div>
          <input type="checkbox" />
        </div>
      </section>

      <section className="settings-card danger-zone">
        <h2>Account</h2>
        <button className="secondary-btn">Export Data</button>
        <button className="danger-btn">Delete Account</button>
      </section>
    </div>
  );
}