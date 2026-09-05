import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUserId, supabase } from "../lib/supabaseClient";
import { LanguageContext, type Language } from "../lib/i18n";
import { onWritesFlushed, queueWrite, registerReplayHandler } from "../lib/offlineQueue";

export interface NotificationPrefs {
  studySessionStart: boolean;
  upcomingSlot: boolean;
  pendingTarget: boolean;
  endOfDayCheckin: boolean;
  revisionDue: boolean;
  mockTestDue: boolean;
  motivational: boolean;
}

export interface SettingsRow {
  user_id: string;
  language: Language;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  notification_prefs: NotificationPrefs;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  studySessionStart: true,
  upcomingSlot: true,
  pendingTarget: true,
  endOfDayCheckin: true,
  revisionDue: true,
  mockTestDue: true,
  motivational: true,
};

function defaultSettings(userId: string): SettingsRow {
  return {
    user_id: userId,
    language: "gu",
    quiet_hours_start: null,
    quiet_hours_end: null,
    notification_prefs: DEFAULT_NOTIFICATION_PREFS,
  };
}

async function persistSettings(row: SettingsRow): Promise<void> {
  const { error } = await supabase.from("settings").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

registerReplayHandler("settings-upsert", async (payload) => {
  await persistSettings(payload as SettingsRow);
});

type SaveState = "idle" | "saved" | "offline";

interface SettingsContextValue {
  settings: SettingsRow | null;
  loading: boolean;
  saveState: SaveState;
  updateSettings: (partial: Partial<Omit<SettingsRow, "user_id">>) => Promise<void>;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const load = useCallback(async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    setSettings((data as SettingsRow | null) ?? defaultSettings(userId));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => onWritesFlushed(() => void load()), [load]);

  const updateSettings = useCallback(
    async (partial: Partial<Omit<SettingsRow, "user_id">>) => {
      const userId = await getCurrentUserId();
      const next: SettingsRow = { ...(settings ?? defaultSettings(userId)), ...partial };
      setSettings(next);
      try {
        await persistSettings(next);
        setSaveState("saved");
      } catch {
        queueWrite("settings-upsert", next);
        setSaveState("offline");
      }
    },
    [settings],
  );

  const resetToDefaults = useCallback(() => {
    if (settings) setSettings(defaultSettings(settings.user_id));
  }, [settings]);

  return createElement(
    SettingsContext.Provider,
    { value: { settings, loading, saveState, updateSettings, resetToDefaults } },
    createElement(
      LanguageContext.Provider,
      {
        value: {
          language: settings?.language ?? "gu",
          setLanguage: (language: Language) => void updateSettings({ language }),
        },
      },
      children,
    ),
  );
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within a SettingsProvider");
  return ctx;
}
