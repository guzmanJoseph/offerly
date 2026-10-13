import { useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/layout.css";

const navigationItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/applications", label: "Applications" },
  { to: "/gmail-import", label: "Gmail Sync" },
  { to: "/calendar", label: "Calendar" },
  { to: "/networking", label: "Networking" },
  { to: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <aside className={"sidebar" + (menuOpen ? " is-open" : "")}>
      <div className="sidebar-brand">
        <img
          src="/offerly.png"
          alt=""
          className="sidebar-logo"
          aria-hidden="true"
        />
        <h1 className="logo">Offerly</h1>
        <button
          className="sidebar-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
        </button>
      </div>

      <nav
        id="primary-navigation"
        className={"sidebar-nav" + (menuOpen ? " is-open" : "")}
        aria-label="Primary navigation"
      >
        {navigationItems.map(({ to, label }) => (
          <NavLink key={to} to={to} onClick={closeMenu}>
            {label}
          </NavLink>
        ))}
        <button className="logout-btn" onClick={handleLogout} type="button">
          Log Out
        </button>
      </nav>
    </aside>
  );
}
