// Quran surahs metadata: number, Arabic name, ayah count
// Limited to Juz' Amma (سور جزء عمّ): surahs 78–114
export type Surah = { number: number; name: string; ayahs: number };

export const SURAHS: Surah[] = [
  { number: 78, name: "النبأ", ayahs: 40 },
  { number: 79, name: "النازعات", ayahs: 46 },
  { number: 80, name: "عبس", ayahs: 42 },
  { number: 81, name: "التكوير", ayahs: 29 },
  { number: 82, name: "الانفطار", ayahs: 19 },
  { number: 83, name: "المطففين", ayahs: 36 },
  { number: 84, name: "الانشقاق", ayahs: 25 },
  { number: 85, name: "البروج", ayahs: 22 },
  { number: 86, name: "الطارق", ayahs: 17 },
  { number: 87, name: "الأعلى", ayahs: 19 },
  { number: 88, name: "الغاشية", ayahs: 26 },
  { number: 89, name: "الفجر", ayahs: 30 },
  { number: 90, name: "البلد", ayahs: 20 },
  { number: 91, name: "الشمس", ayahs: 15 },
  { number: 92, name: "الليل", ayahs: 21 },
  { number: 93, name: "الضحى", ayahs: 11 },
  { number: 94, name: "الشرح", ayahs: 8 },
  { number: 95, name: "التين", ayahs: 8 },
  { number: 96, name: "العلق", ayahs: 19 },
  { number: 97, name: "القدر", ayahs: 5 },
  { number: 98, name: "البينة", ayahs: 8 },
  { number: 99, name: "الزلزلة", ayahs: 8 },
  { number: 100, name: "العاديات", ayahs: 11 },
  { number: 101, name: "القارعة", ayahs: 11 },
  { number: 102, name: "التكاثر", ayahs: 8 },
  { number: 103, name: "العصر", ayahs: 3 },
  { number: 104, name: "الهمزة", ayahs: 9 },
  { number: 105, name: "الفيل", ayahs: 5 },
  { number: 106, name: "قريش", ayahs: 4 },
  { number: 107, name: "الماعون", ayahs: 7 },
  { number: 108, name: "الكوثر", ayahs: 3 },
  { number: 109, name: "الكافرون", ayahs: 6 },
  { number: 110, name: "النصر", ayahs: 3 },
  { number: 111, name: "المسد", ayahs: 5 },
  { number: 112, name: "الإخلاص", ayahs: 4 },
  { number: 113, name: "الفلق", ayahs: 5 },
  { number: 114, name: "الناس", ayahs: 6 },
];

export function getSurahByName(name: string): Surah | undefined {
  return SURAHS.find((s) => s.name === name);
}
