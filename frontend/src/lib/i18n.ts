import { createContext, useContext } from "react";

export type Language = "gu" | "en";

// Covers the nav + Settings page only (KAN-60) — no ticket in this sprint asks
// for translating the rest of the app, so this stays a small, hand-written
// dictionary rather than a full i18n framework.
const strings = {
  gu: {
    navHome: "હોમ",
    navSettings: "સેટિંગ્સ",
    settingsTitle: "સેટિંગ્સ",
    language: "ભાષા",
    examStages: "પરીક્ષા તારીખો",
    examStageNamePlaceholder: "તબક્કાનું નામ (દા.ત. પ્રિલિમ)",
    addExamStage: "ઉમેરો",
    deleteExamStage: "કાઢી નાખો",
    noExamStages: "હજી કોઈ પરીક્ષા તારીખ ઉમેરાઈ નથી.",
    notificationPrefs: "સૂચના પસંદગીઓ",
    notifStudySession: "અભ્યાસ સત્ર શરૂ",
    notifUpcomingSlot: "આગામી સમયપત્રક સ્લોટ",
    notifPendingTarget: "બાકી દૈનિક લક્ષ્ય",
    notifEndOfDayCheckin: "દિવસના અંતે ચેક-ઇન",
    notifRevisionDue: "પુનરાવર્તન બાકી",
    notifMockTestDue: "મોક ટેસ્ટ બાકી",
    quietHours: "શાંત કલાકો",
    quietHoursFrom: "થી",
    quietHoursTo: "સુધી",
    dataReset: "ડેટા રીસેટ",
    dataResetDescription: "તમારો બધો સંગ્રહિત ડેટા (સેટિંગ્સ, પરીક્ષા તારીખો, વગેરે) કાયમ માટે ભૂંસી નાખો.",
    dataResetButton: "બધો ડેટા રીસેટ કરો",
    dataResetConfirm: "ખરેખર? આ ક્રિયા પાછી ફેરવી શકાતી નથી.",
    saved: "સંગ્રહાયું",
    savedOffline: "ઓફલાઇન સંગ્રહાયું — ફરી ઓનલાઇન થતાં સિંક થશે",
    loading: "લોડ થઈ રહ્યું છે…",
  },
  en: {
    navHome: "Home",
    navSettings: "Settings",
    settingsTitle: "Settings",
    language: "Language",
    examStages: "Exam Dates",
    examStageNamePlaceholder: "Stage name (e.g. Prelim)",
    addExamStage: "Add",
    deleteExamStage: "Delete",
    noExamStages: "No exam dates added yet.",
    notificationPrefs: "Notification preferences",
    notifStudySession: "Study session start",
    notifUpcomingSlot: "Upcoming timetable slot",
    notifPendingTarget: "Pending daily target",
    notifEndOfDayCheckin: "End-of-day check-in",
    notifRevisionDue: "Revision due",
    notifMockTestDue: "Mock test due",
    quietHours: "Quiet hours",
    quietHoursFrom: "From",
    quietHoursTo: "To",
    dataReset: "Data reset",
    dataResetDescription: "Permanently erase all your stored data (settings, exam dates, etc).",
    dataResetButton: "Reset all data",
    dataResetConfirm: "Are you sure? This cannot be undone.",
    saved: "Saved",
    savedOffline: "Saved offline — will sync when back online",
    loading: "Loading…",
  },
} as const;

export type TranslationKey = keyof (typeof strings)["en"];

export function translate(language: Language, key: TranslationKey): string {
  return strings[language][key];
}

export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({
  language: "gu",
  setLanguage: () => {},
});

export function useLanguage() {
  const { language, setLanguage } = useContext(LanguageContext);
  const t = (key: TranslationKey) => translate(language, key);
  return { language, setLanguage, t };
}
