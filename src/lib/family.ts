export const FAMILY_PERMS = [
  { key: "medication", label: "Medicine reminders & adherence", hi: "दवा रिमाइंडर और पालन", desc: "Which scheduled doses were confirmed taken, missed or not yet confirmed." },
  { key: "food", label: "Meal goals & food insights", hi: "भोजन लक्ष्य", desc: "Recent meals (carb level only) and meal goals from the care plan." },
  { key: "glucose", label: "Glucose trend summary", hi: "शुगर रुझान", desc: "Plain-language trend vs usual range. No raw history." },
  { key: "progress", label: "Weekly progress", hi: "साप्ताहिक प्रगति", desc: "Habit completion this week and HbA1c if recorded." },
] as const;

export const RELATIONSHIPS = ["Spouse", "Son/Daughter", "Other caregiver"];

export type Lang = "en" | "hi";

const T = {
  today: { en: "Today's support", hi: "आज की मदद" },
  meds: { en: "Medicine", hi: "दवा" },
  food: { en: "Food & glucose", hi: "भोजन और शुगर" },
  progress: { en: "This week", hi: "इस सप्ताह" },
  send: { en: "Send support", hi: "हौसला भेजें" },
  updates: { en: "Updates", hi: "अपडेट" },
  taken: { en: "Taken", hi: "ली गई" },
  missed: { en: "Missed", hi: "छूट गई" },
  not_confirmed: { en: "Not yet confirmed", hi: "पुष्टि नहीं" },
  na: { en: "Data not available", hi: "डेटा उपलब्ध नहीं" },
  noAccess: { en: "Not shared with you", hi: "आपके साथ साझा नहीं" },
  encourage: { en: "Encourage", hi: "प्रोत्साहन" },
  remind: { en: "Remind", hi: "याद दिलाएँ" },
  acknowledge: { en: "Well done", hi: "शाबाश" },
} as const;
export type TKey = keyof typeof T;
export const t = (k: TKey, l: Lang) => T[k][l];

export const QUICK_MESSAGES: Record<"encourage" | "remind" | "acknowledge", { en: string; hi: string }> = {
  encourage: { en: "Proud of you, Papa. Small steps every day!", hi: "पापा, आप पर गर्व है। रोज़ छोटे कदम!" },
  remind: { en: "Shall we go for our 15-minute walk after dinner?", hi: "खाने के बाद 15 मिनट टहलने चलें?" },
  acknowledge: { en: "Great job taking your medicine on time today!", hi: "आज समय पर दवा लेने के लिए शाबाश!" },
};
