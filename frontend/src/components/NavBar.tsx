import { GraduationCapIcon, LanguagesIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

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

const NAV_LINKS = [
  { to: "/", key: "navHome" as const, end: true },
  { to: "/syllabus", key: "navSyllabus" as const, end: false },
  { to: "/settings", key: "navSettings" as const, end: false },
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

export function NavBar() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
        <div className="text-foreground flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <GraduationCapIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">Exam Prep</span>
        </div>

        <nav className="flex flex-1 items-center gap-1">
          {NAV_LINKS.map(({ to, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )
              }
            >
              {t(key)}
            </NavLink>
          ))}
        </nav>

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
