import { useState, type FormEvent } from "react";
import { CloudOffIcon, Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/lib/i18n";
import { useSettingsContext, type NotificationPrefs } from "@/hooks/useSettings";
import { useExamStages } from "@/hooks/useExamStages";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const NOTIFICATION_CATEGORIES: {
  key: keyof NotificationPrefs;
  labelKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0];
}[] = [
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
  const [resetOpen, setResetOpen] = useState(false);

  if (loading || !settings) {
    return (
      <main className="mx-auto flex max-w-2xl justify-center px-4 py-16">
        <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
      </main>
    );
  }

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
    setResetting(true);
    try {
      const { error } = await supabase.rpc("reset_user_data");
      if (error) throw error;
      resetToDefaults();
      await examStages.reload();
      toast.success(t("dataResetButton"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  }

  const combinedSaveState =
    saveState === "offline" || examStages.saveState === "offline" ? "offline" : "saved";
  const showSaveIndicator = saveState !== "idle" || examStages.saveState !== "idle";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("settingsTitle")}</h1>
        {showSaveIndicator && (
          <Badge variant={combinedSaveState === "offline" ? "warning" : "success"}>
            {combinedSaveState === "offline" ? (
              <>
                <CloudOffIcon /> {t("savedOffline")}
              </>
            ) : (
              t("saved")
            )}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("language")}</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            type="button"
            variant={language === "gu" ? "default" : "outline"}
            size="sm"
            onClick={() => setLanguage("gu")}
          >
            ગુજરાતી
          </Button>
          <Button
            type="button"
            variant={language === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLanguage("en")}
          >
            English
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("examStages")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {examStages.stages.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noExamStages")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {examStages.stages.map((stage) => (
                <li
                  key={stage.id}
                  className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm"
                >
                  <span className="font-medium">{stage.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground tabular-nums">{stage.exam_date}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      onClick={() => examStages.deleteStage(stage.id)}
                      aria-label={t("deleteExamStage")}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form className="flex flex-wrap items-end gap-2" onSubmit={handleAddStage}>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="stage-name" className="text-xs">
                {t("examStageNamePlaceholder")}
              </Label>
              <Input
                id="stage-name"
                type="text"
                placeholder={t("examStageNamePlaceholder")}
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage-date" className="text-xs">
                Date
              </Label>
              <Input
                id="stage-date"
                type="date"
                value={stageDate}
                onChange={(e) => setStageDate(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm">
              <PlusIcon /> {t("addExamStage")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("notificationPrefs")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {NOTIFICATION_CATEGORIES.map(({ key, labelKey }) => (
              <li key={key} className="flex items-center justify-between gap-4">
                <Label htmlFor={`notif-${key}`} className="text-sm font-normal">
                  {t(labelKey)}
                </Label>
                <Switch
                  id={`notif-${key}`}
                  checked={settings.notification_prefs[key]}
                  onCheckedChange={() => toggleNotification(key)}
                />
              </li>
            ))}
          </ul>

          <Separator />

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("quietHours")}</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quiet-from" className="text-xs">
                  {t("quietHoursFrom")}
                </Label>
                <Input
                  id="quiet-from"
                  type="time"
                  value={settings.quiet_hours_start ?? ""}
                  onChange={(e) => void updateSettings({ quiet_hours_start: e.target.value || null })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quiet-to" className="text-xs">
                  {t("quietHoursTo")}
                </Label>
                <Input
                  id="quiet-to"
                  type="time"
                  value={settings.quiet_hours_end ?? ""}
                  onChange={(e) => void updateSettings({ quiet_hours_end: e.target.value || null })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t("dataReset")}</CardTitle>
          <CardDescription>{t("dataResetDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                {t("dataResetButton")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dataResetButton")}</DialogTitle>
                <DialogDescription>{t("dataResetConfirm")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReset} disabled={resetting}>
                  {resetting ? <Loader2Icon className="animate-spin" /> : null}
                  {t("dataResetButton")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </main>
  );
}
