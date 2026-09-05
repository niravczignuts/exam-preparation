import { useState, type FormEvent } from "react";
import { useLanguage } from "../lib/i18n";
import { useSettingsContext, type NotificationPrefs } from "../hooks/useSettings";
import { useExamStages } from "../hooks/useExamStages";
import { supabase } from "../lib/supabaseClient";
import "./Settings.css";

const NOTIFICATION_CATEGORIES: { key: keyof NotificationPrefs; labelKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }[] = [
  { key: "studySessionStart", labelKey: "notifStudySession" },
  { key: "upcomingSlot", labelKey: "notifUpcomingSlot" },
  { key: "pendingTarget", labelKey: "notifPendingTarget" },
  { key: "endOfDayCheckin", labelKey: "notifEndOfDayCheckin" },
  { key: "revisionDue", labelKey: "notifRevisionDue" },
  { key: "mockTestDue", labelKey: "notifMockTestDue" },
];

export function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { settings, loading, saveState, updateSettings, resetToDefaults } = useSettingsContext();
  const examStages = useExamStages();

  const [stageName, setStageName] = useState("");
  const [stageDate, setStageDate] = useState("");
  const [resetting, setResetting] = useState(false);

  if (loading || !settings) return <p>{t("loading")}</p>;

  async function handleAddStage(e: FormEvent) {
    e.preventDefault();
    if (!stageName.trim() || !stageDate) return;
    await examStages.addStage(stageName.trim(), stageDate);
    setStageName("");
    setStageDate("");
  }

  function toggleNotification(key: keyof NotificationPrefs) {
    void updateSettings({
      notification_prefs: { ...settings!.notification_prefs, [key]: !settings!.notification_prefs[key] },
    });
  }

  async function handleReset() {
    if (!window.confirm(t("dataResetConfirm"))) return;
    setResetting(true);
    try {
      const { error } = await supabase.rpc("reset_user_data");
      if (error) throw error;
      resetToDefaults();
      await examStages.reload();
    } finally {
      setResetting(false);
    }
  }

  const combinedSaveState = saveState === "offline" || examStages.saveState === "offline" ? "offline" : "saved";

  return (
    <main className="settings-page">
      <h1>{t("settingsTitle")}</h1>
      {(saveState !== "idle" || examStages.saveState !== "idle") && (
        <p className="save-indicator">{combinedSaveState === "offline" ? t("savedOffline") : t("saved")}</p>
      )}

      <section>
        <h2>{t("language")}</h2>
        <div className="pill-group">
          <button type="button" className={language === "gu" ? "active" : ""} onClick={() => setLanguage("gu")}>
            ગુજરાતી
          </button>
          <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>
            English
          </button>
        </div>
      </section>

      <section>
        <h2>{t("examStages")}</h2>
        {examStages.stages.length === 0 && <p>{t("noExamStages")}</p>}
        <ul className="exam-stage-list">
          {examStages.stages.map((stage) => (
            <li key={stage.id}>
              <span>{stage.name}</span>
              <span>{stage.exam_date}</span>
              <button type="button" onClick={() => examStages.deleteStage(stage.id)}>
                {t("deleteExamStage")}
              </button>
            </li>
          ))}
        </ul>
        <form className="exam-stage-form" onSubmit={handleAddStage}>
          <input
            type="text"
            placeholder={t("examStageNamePlaceholder")}
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
          />
          <input type="date" value={stageDate} onChange={(e) => setStageDate(e.target.value)} />
          <button type="submit">{t("addExamStage")}</button>
        </form>
      </section>

      <section>
        <h2>{t("notificationPrefs")}</h2>
        <ul className="checkbox-list">
          {NOTIFICATION_CATEGORIES.map(({ key, labelKey }) => (
            <li key={key}>
              <label>
                <input
                  type="checkbox"
                  checked={settings.notification_prefs[key]}
                  onChange={() => toggleNotification(key)}
                />
                {t(labelKey)}
              </label>
            </li>
          ))}
        </ul>

        <h3>{t("quietHours")}</h3>
        <div className="quiet-hours">
          <label>
            {t("quietHoursFrom")}
            <input
              type="time"
              value={settings.quiet_hours_start ?? ""}
              onChange={(e) => void updateSettings({ quiet_hours_start: e.target.value || null })}
            />
          </label>
          <label>
            {t("quietHoursTo")}
            <input
              type="time"
              value={settings.quiet_hours_end ?? ""}
              onChange={(e) => void updateSettings({ quiet_hours_end: e.target.value || null })}
            />
          </label>
        </div>
      </section>

      <section>
        <h2>{t("dataReset")}</h2>
        <p>{t("dataResetDescription")}</p>
        <button type="button" className="danger" onClick={handleReset} disabled={resetting}>
          {t("dataResetButton")}
        </button>
      </section>
    </main>
  );
}
