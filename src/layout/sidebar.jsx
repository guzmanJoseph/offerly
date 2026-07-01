import { NavLink } from "react-router-dom";

export default function Sidebar() {
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

        <NavLink to="/sign-out">
          Sign Out
        </NavLink>


      </nav>
    </aside>
  );
}