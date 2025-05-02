import { Link } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">🏠</span>
          <span className="logo-text">Rent Whisperer</span>
        </Link>
        
        <div className="navbar-actions">
          <button className="btn btn-primary">
            Create Notification
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
