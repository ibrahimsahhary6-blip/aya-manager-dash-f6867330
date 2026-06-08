// Quran surahs metadata: number, Arabic name, ayah count, juz
// Includes Juz 28, 29, and 30 (سور أجزاء قد سمع وتبارك وعمّ)
export type Surah = { number: number; name: string; ayahs: number; juz: 28 | 29 | 30 };

export const SURAHS: Surah[] = [
  // Juz 28 (قد سمع)
  { number: 58, name: "المجادلة", ayahs: 22, juz: 28 },
  { number: 59, name: "الحشر", ayahs: 24, juz: 28 },
  { number: 60, name: "الممتحنة", ayahs: 13, juz: 28 },
  { number: 61, name: "الصف", ayahs: 14, juz: 28 },
  { number: 62, name: "الجمعة", ayahs: 11, juz: 28 },
  { number: 63, name: "المنافقون", ayahs: 11, juz: 28 },
  { number: 64, name: "التغابن", ayahs: 18, juz: 28 },
  { number: 65, name: "الطلاق", ayahs: 12, juz: 28 },
  { number: 66, name: "التحريم", ayahs: 12, juz: 28 },
  // Juz 29 (تبارك)
  { number: 67, name: "الملك", ayahs: 30, juz: 29 },
  { number: 68, name: "القلم", ayahs: 52, juz: 29 },
  { number: 69, name: "الحاقة", ayahs: 52, juz: 29 },
  { number: 70, name: "المعارج", ayahs: 44, juz: 29 },
  { number: 71, name: "نوح", ayahs: 28, juz: 29 },
  { number: 72, name: "الجن", ayahs: 28, juz: 29 },
  { number: 73, name: "المزمل", ayahs: 20, juz: 29 },
  { number: 74, name: "المدثر", ayahs: 56, juz: 29 },
  { number: 75, name: "القيامة", ayahs: 40, juz: 29 },
  { number: 76, name: "الإنسان", ayahs: 31, juz: 29 },
  { number: 77, name: "المرسلات", ayahs: 50, juz: 29 },
  // Juz 30 (عمّ)
  { number: 78, name: "النبأ", ayahs: 40, juz: 30 },
  { number: 79, name: "النازعات", ayahs: 46, juz: 30 },
  { number: 80, name: "عبس", ayahs: 42, juz: 30 },
  { number: 81, name: "التكوير", ayahs: 29, juz: 30 },
  { number: 82, name: "الانفطار", ayahs: 19, juz: 30 },
  { number: 83, name: "المطففين", ayahs: 36, juz: 30 },
  { number: 84, name: "الانشقاق", ayahs: 25, juz: 30 },
  { number: 85, name: "البروج", ayahs: 22, juz: 30 },
  { number: 86, name: "الطارق", ayahs: 17, juz: 30 },
  { number: 87, name: "الأعلى", ayahs: 19, juz: 30 },
  { number: 88, name: "الغاشية", ayahs: 26, juz: 30 },
  { number: 89, name: "الفجر", ayahs: 30, juz: 30 },
  { number: 90, name: "البلد", ayahs: 20, juz: 30 },
  { number: 91, name: "الشمس", ayahs: 15, juz: 30 },
  { number: 92, name: "الليل", ayahs: 21, juz: 30 },
  { number: 93, name: "الضحى", ayahs: 11, juz: 30 },
  { number: 94, name: "الشرح", ayahs: 8, juz: 30 },
  { number: 95, name: "التين", ayahs: 8, juz: 30 },
  { number: 96, name: "العلق", ayahs: 19, juz: 30 },
  { number: 97, name: "القدر", ayahs: 5, juz: 30 },
  { number: 98, name: "البينة", ayahs: 8, juz: 30 },
  { number: 99, name: "الزلزلة", ayahs: 8, juz: 30 },
  { number: 100, name: "العاديات", ayahs: 11, juz: 30 },
  { number: 101, name: "القارعة", ayahs: 11, juz: 30 },
  { number: 102, name: "التكاثر", ayahs: 8, juz: 30 },
  { number: 103, name: "العصر", ayahs: 3, juz: 30 },
  { number: 104, name: "الهمزة", ayahs: 9, juz: 30 },
  { number: 105, name: "الفيل", ayahs: 5, juz: 30 },
  { number: 106, name: "قريش", ayahs: 4, juz: 30 },
  { number: 107, name: "الماعون", ayahs: 7, juz: 30 },
  { number: 108, name: "الكوثر", ayahs: 3, juz: 30 },
  { number: 109, name: "الكافرون", ayahs: 6, juz: 30 },
  { number: 110, name: "النصر", ayahs: 3, juz: 30 },
  { number: 111, name: "المسد", ayahs: 5, juz: 30 },
  { number: 112, name: "الإخلاص", ayahs: 4, juz: 30 },
  { number: 113, name: "الفلق", ayahs: 5, juz: 30 },
  { number: 114, name: "الناس", ayahs: 6, juz: 30 },
];

export function getSurahByName(name: string): Surah | undefined {
  return SURAHS.find((s) => s.name === name);
}

// Filter surahs by which juz the student has enabled. Juz 30 is always enabled.
export function getSurahsForStudent(extraJuz: number[] | null | undefined): Surah[] {
  const allowed = new Set<number>([30, ...(extraJuz ?? [])]);
  return SURAHS.filter((s) => allowed.has(s.juz));
}
