import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/layout.css";


export default function Sidebar() {

    async function handleLogout() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error(error);
            return;
        }

        // App.jsx will automatically detect the logout
        // and send the user back to the login screen.
    }

    return (
        <aside className="sidebar">

            <div className="sidebar-brand">
                <img
                    src="/offerly.png"
                    alt="Offerly"
                    className="sidebar-logo"
                />

                <h1 className="logo">Offerly</h1>
            </div>

            <nav className="sidebar-nav">

                <NavLink to="/dashboard">Dashboard</NavLink>

                <NavLink to="/applications">
                    Applications
                </NavLink>

                <NavLink to="/gmail-import">
                    Gmail Import
                </NavLink>

                <NavLink to="/calendar">
                    Calendar
                </NavLink>

                <NavLink to="/networking">
                    Networking
                </NavLink>

                <NavLink to="/settings">
                    Settings
                </NavLink>

            </nav>

            <button
                className="logout-btn"
                onClick={handleLogout}
            >
                Log Out
            </button>

        </aside>
    );
}