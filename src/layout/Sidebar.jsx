import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
    FiGrid,
    FiBriefcase,
    FiMail,
    FiCalendar,
    FiUsers,
    FiSettings
} from "react-icons/fi";
import "../styles/layout.css";


export default function Sidebar() {

    const [open, setOpen] = useState(false);

    // Lock page scroll while the mobile drawer is open
    useEffect(() => {
        document.body.classList.toggle("nav-locked", open);
        return () => document.body.classList.remove("nav-locked");
    }, [open]);

    async function handleLogout() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error(error);
            return;
        }

        // App.jsx will automatically detect the logout
        // and send the user back to the login screen.
    }

    function closeDrawer() {
        setOpen(false);
    }

    return (
        <>
            {/* Mobile top bar */}
            <header className="mobile-topbar">
                <button
                    className="menu-btn"
                    onClick={() => setOpen(true)}
                    aria-label="Open menu"
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>

                <div className="mobile-brand">
                    <img src="/offerly.png" alt="Offerly" className="mobile-brand-logo" />
                    <span>Offerly</span>
                </div>

                <span className="menu-btn menu-btn-placeholder" aria-hidden="true"></span>
            </header>

            {/* Backdrop */}
            <div
                className={`drawer-backdrop ${open ? "visible" : ""}`}
                onClick={closeDrawer}
                aria-hidden="true"
            ></div>

            <aside className={`sidebar ${open ? "drawer-open" : ""}`}>

                <div className="sidebar-brand">
                    <img
                        src="/offerly.png"
                        alt="Offerly"
                        className="sidebar-logo"
                    />

                    <h1 className="logo">Offerly</h1>
                </div>

                <nav className="sidebar-nav">

                    <NavLink to="/dashboard" onClick={closeDrawer}>
                        <FiGrid className="nav-icon" />
                        <span>Dashboard</span>
                    </NavLink>

                    <NavLink to="/applications" onClick={closeDrawer}>
                        <FiBriefcase className="nav-icon" />
                        <span>Applications</span>
                    </NavLink>

                    <NavLink to="/gmail-import" onClick={closeDrawer}>
                        <FiMail className="nav-icon" />
                        <span>Gmail Sync</span>
                    </NavLink>

                    <NavLink to="/calendar" onClick={closeDrawer}>
                        <FiCalendar className="nav-icon" />
                        <span>Calendar</span>
                    </NavLink>

                    <NavLink to="/networking" onClick={closeDrawer}>
                        <FiUsers className="nav-icon" />
                        <span>Networking</span>
                    </NavLink>

                    <NavLink to="/settings" onClick={closeDrawer}>
                        <FiSettings className="nav-icon" />
                        <span>Settings</span>
                    </NavLink>

                </nav>

                <button
                    className="logout-btn"
                    onClick={handleLogout}
                >
                    Log Out
                </button>

            </aside>
        </>
    );
}
