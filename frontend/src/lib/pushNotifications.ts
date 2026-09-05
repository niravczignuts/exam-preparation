import { onForegroundMessage, requestPushToken } from "@/firebase";
import { getCurrentUserId, supabase } from "@/lib/supabaseClient";

/** Persists the FCM token so the notification_job (KAN-46..49) can push to this
 * device — KAN-45's other half, previously scaffolding-only (the token was shown
 * on Home but never saved anywhere the backend could read it). */
async function saveToken(token: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("device_tokens")
    .upsert({ user_id: userId, fcm_token: token }, { onConflict: "fcm_token" });
  if (error) throw error;
}

let foregroundHandlerRegistered = false;

function registerForegroundHandler() {
  if (foregroundHandlerRegistered) return;
  foregroundHandlerRegistered = true;
  onForegroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    new Notification(title ?? "Exam Prep App", { body: body ?? "" });
  });
}

/** KAN-45: requests permission on first load (browser's standard flow) rather than
 * requiring a button click, registers + saves the token if granted, and quietly
 * re-saves it on later loads if permission was already granted (tokens can
 * rotate). Does nothing if previously denied — Settings offers a manual retry
 * for once the user re-enables it at the browser level. */
export async function ensurePushRegistered(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "denied") return "denied";

  try {
    const token = await requestPushToken();
    if (!token) return "denied";
    await saveToken(token);
    registerForegroundHandler();
    return "granted";
  } catch (err) {
    console.error("ensurePushRegistered failed", err);
    return "unsupported";
  }
}
