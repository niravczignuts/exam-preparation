import {
  BookOpenIcon,
  ChevronDownIcon,
  GraduationCapIcon,
  LanguagesIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { useAiFeaturesEnabled } from "@/lib/aiFeatures";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRIMARY_LINKS = [
  { to: "/", key: "navHome" as const, end: true },
  { to: "/dashboard", key: "navDashboard" as const, end: false },
  { to: "/daily-target", key: "navDailyTarget" as const, end: false },
  { to: "/timetable", key: "navTimetable" as const, end: false },
];

const STUDY_LINKS = [
  { to: "/syllabus", key: "navSyllabus" as const },
  { to: "/pyq", key: "navPyq" as const },
  { to: "/practice", key: "navPractice" as const },
  { to: "/mock-test", key: "navMockTest" as const },
  { to: "/revision", key: "navRevision" as const },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <MonitorIcon /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  );

export function NavBar() {
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const aiFeaturesEnabled = useAiFeaturesEnabled();
  // Ask a Doubt only appears once the backend actually has an OpenAI key
  // configured — otherwise it'd be a nav link to a control that just errors.
  const studyLinks = aiFeaturesEnabled
    ? [...STUDY_LINKS, { to: "/doubts", key: "navDoubts" as const }]
    : STUDY_LINKS;
  const isStudySectionActive = studyLinks.some((l) => location.pathname.startsWith(l.to));

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
        <div className="text-foreground flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <GraduationCapIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">Exam Prep</span>
        </div>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {PRIMARY_LINKS.map(({ to, key, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              {t(key)}
            </NavLink>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto shrink-0 gap-1 rounded-md px-3 py-1.5 text-sm font-medium",
                  isStudySectionActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <BookOpenIcon className="size-3.5" />
                {t("navStudy")}
                <ChevronDownIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {studyLinks.map(({ to, key }) => (
                <DropdownMenuItem key={to} asChild>
                  <NavLink to={to} className="w-full">
                    {t(key)}
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <Button variant="ghost" size="icon" asChild>
          <NavLink to="/settings" aria-label={t("navSettings")}>
            <SettingsIcon />
          </NavLink>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("language")}>
              <LanguagesIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage("gu")} className={language === "gu" ? "bg-accent" : ""}>
              ગુજરાતી
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("en")} className={language === "en" ? "bg-accent" : ""}>
              English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
      </div>
    </header>
  );
}
