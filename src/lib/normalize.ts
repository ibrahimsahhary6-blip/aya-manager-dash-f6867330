// Arabic text normalization for fuzzy search & duplicate detection.
// Matches the SQL `normalize_arabic` function used in unique indexes.

const TRANSLIT: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ى": "ي",
  "ة": "ه",
  "ؤ": "و",
  "ئ": "ي",
  "ـ": "",
  // diacritics
  "ً": "", "ٌ": "", "ٍ": "", "َ": "", "ُ": "", "ِ": "", "ّ": "", "ْ": "",
};

export function normalizeArabic(input: string): string {
  if (!input) return "";
  let out = "";
  for (const ch of input) out += TRANSLIT[ch] ?? ch;
  return out.toLowerCase().trim().replace(/\s+/g, " ");
}
