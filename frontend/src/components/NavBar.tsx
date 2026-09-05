import { NavLink } from "react-router-dom";
import { useLanguage } from "../lib/i18n";
import "./NavBar.css";

export function NavBar() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <header className="nav-bar">
      <nav className="nav-bar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          {t("navHome")}
        </NavLink>
        <NavLink to="/syllabus" className={({ isActive }) => (isActive ? "active" : "")}>
          {t("navSyllabus")}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
          {t("navSettings")}
        </NavLink>
      </nav>
      <div className="nav-bar__lang" role="group" aria-label={t("language")}>
        <button
          type="button"
          className={language === "gu" ? "active" : ""}
          onClick={() => setLanguage("gu")}
        >
          ગુજરાતી
        </button>
        <button
          type="button"
          className={language === "en" ? "active" : ""}
          onClick={() => setLanguage("en")}
        >
          English
        </button>
      </div>
    </header>
  );
}
