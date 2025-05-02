import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <ul className="sidebar-nav-list">
          <li className="sidebar-nav-item">
            <NavLink 
              to="/" 
              className={({ isActive }) => 
                "sidebar-nav-link" + (isActive ? " active" : "")
              }
              end
            >
              <span className="sidebar-icon">📊</span>
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink 
              to="/tenants" 
              className={({ isActive }) => 
                "sidebar-nav-link" + (isActive ? " active" : "")
              }
            >
              <span className="sidebar-icon">👥</span>
              <span>Tenants</span>
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink 
              to="/payments" 
              className={({ isActive }) => 
                "sidebar-nav-link" + (isActive ? " active" : "")
              }
            >
              <span className="sidebar-icon">💰</span>
              <span>Payments</span>
            </NavLink>
          </li>
          <li className="sidebar-nav-item">
            <NavLink 
              to="/notifications" 
              className={({ isActive }) => 
                "sidebar-nav-link" + (isActive ? " active" : "")
              }
            >
              <span className="sidebar-icon">🔔</span>
              <span>Notifications</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
