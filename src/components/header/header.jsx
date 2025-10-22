import { NavLink } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { FaSun, FaMoon, FaLock, FaEye, FaPenAlt, FaInfoCircle , FaRocketchat } from "react-icons/fa";
import "../CSS/Header.css";
import Logo from '../../assets/Icon.png';

function Header() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className={`header-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <div className="header-content">
        <div className="logo-container">
          <img src={Logo} alt="Secret Confessions" className="logo" />
          <span className="logo-text">Anonymous Secrets</span>
        </div>

        <nav className="nav-links">
          <NavLink 
            to="/" 
            end 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            <button className={`nav-btn ${isDarkMode ? "dark" : "light"}`}>
              <FaLock className="nav-icon" />
              <span>Home</span>
            </button>
          </NavLink>
          
          <NavLink 
            to="/secrets" 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            <button className={`nav-btn ${isDarkMode ? "dark" : "light"}`}>
              <FaEye className="nav-icon" />
              <span>Secrets</span>
            </button>
          </NavLink>

          <NavLink 
            to="/write" 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            <button className={`nav-btn primary ${isDarkMode ? "dark" : "light"}`}>
              <FaPenAlt className="nav-icon" />
              <span>Share Secret</span>
            </button>
          </NavLink>

          <NavLink 
            to="/rules" 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            <button className={`nav-btn ${isDarkMode ? "dark" : "light"}`}>
              <FaInfoCircle className="nav-icon" />
              <span>Rules</span>
            </button>
          </NavLink>
        </nav>

        <div className="header-actions">
          <button 
            onClick={toggleTheme} 
            className="theme-toggle"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <FaSun className="theme-icon" />
            ) : (
              <FaMoon className="theme-icon" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;