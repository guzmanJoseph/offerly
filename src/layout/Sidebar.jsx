import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./layout.css";


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

            <h1 className="logo">Offerly</h1>

            <nav className="sidebar-nav">

                <NavLink to="/">Dashboard</NavLink>

                <NavLink to="/applications">
                    Applications
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