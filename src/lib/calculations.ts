export interface NutritionPer100g {
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export interface MealItemInput {
  grams: number;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

export function ageFromBirthdate(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}

export function calculateItemNutrition(item: MealItemInput) {
  const factor = item.grams / 100;
  return {
    kcal: Math.round(item.kcal_per_100g * factor * 10) / 10,
    protein_g: Math.round(item.protein_per_100g * factor * 10) / 10,
    carbs_g: Math.round(item.carbs_per_100g * factor * 10) / 10,
    fat_g: Math.round(item.fat_per_100g * factor * 10) / 10,
  };
}

export function calculateMealTotals(items: MealItemInput[]) {
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const item of items) {
    const nutrition = calculateItemNutrition(item);
    totalKcal += nutrition.kcal;
    totalProtein += nutrition.protein_g;
    totalCarbs += nutrition.carbs_g;
    totalFat += nutrition.fat_g;
  }

  return {
    totalKcal: Math.round(totalKcal * 10) / 10,
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
  };
}

export function calculateBMR(weightKg: number, heightCm: number, age: number, sex: string): number {
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export function getActivityMultiplier(activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return multipliers[activityLevel] ?? 1.2;
}

export function getGoalAdjustment(goalType: string): number {
  const adjustments: Record<string, number> = {
    lose: -500,
    mild_deficit: -250,
    maintain: 0,
    mild_surplus: 250,
    gain: 500,
    manual: 0,
  };
  return adjustments[goalType] ?? 0;
}

export function calculateDailyCalorieTarget(profile: {
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  sex: string | null;
  activity_level: string | null;
  goal_type: string | null;
  manual_calorie_target: number | null;
}): number | null {
  if (
    profile.goal_type === 'manual' &&
    profile.manual_calorie_target != null
  ) {
    return profile.manual_calorie_target;
  }

  if (
    !profile.weight_kg ||
    !profile.height_cm ||
    !profile.age ||
    !profile.sex ||
    !profile.activity_level
  ) {
    return null;
  }

  const bmr = calculateBMR(
    profile.weight_kg,
    profile.height_cm,
    profile.age,
    profile.sex
  );
  const multiplier = getActivityMultiplier(profile.activity_level);
  const adjustment = getGoalAdjustment(profile.goal_type ?? 'maintain');

  return Math.round(bmr * multiplier + adjustment);
}

export const TREND_RANGE_DAYS = { week: 7, month: 30, year: 365 } as const;
export type TrendRange = keyof typeof TREND_RANGE_DAYS;

/** Entries dated within the last `days` days (inclusive of today). */
export function logsWithinDays<T extends { date: string }>(
  logs: T[],
  days: number,
  today: Date = new Date()
): T[] {
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  return logs.filter((l) => l.date >= fromStr && l.date <= todayStr);
}

export function logsInRange<T extends { date: string }>(
  logs: T[],
  range: TrendRange,
  today: Date = new Date()
): T[] {
  return logsWithinDays(logs, TREND_RANGE_DAYS[range], today);
}

/**
 * Average of the weigh-ins in the 7 days up to `today` — the "real" weight
 * behind day-to-day water/food fluctuations. Null with fewer than 2 entries,
 * since a single reading is not an average.
 */
export function weeklyAverageWeight(
  logs: { date: string; weight_kg: number }[],
  today: Date = new Date()
): number | null {
  const week = logsWithinDays(logs, 7, today);
  if (week.length < 2) return null;

  const sum = week.reduce((acc, l) => acc + l.weight_kg, 0);
  return Math.round((sum / week.length) * 10) / 10;
}

/**
 * SVG geometry for a sparkline-style trend chart: the line path, the filled
 * area beneath it, the plotted points, and the y-projection so callers can
 * place extra marks (a goal line) on the same scale.
 *
 * `include` widens the y-range to keep an off-series value (the goal weight)
 * on canvas. Returns null for an empty series.
 */
export function buildTrendPath(
  values: number[],
  opts: {
    width: number;
    height: number;
    padTop?: number;
    padBottom?: number;
    include?: number | null;
  }
): { line: string; area: string; points: [number, number][]; yAt: (v: number) => number } | null {
  if (values.length === 0) return null;

  const { width: W, height: H, padTop = 10, padBottom = 10, include = null } = opts;
  const plotH = H - padTop - padBottom;
  const scale = include != null ? [...values, include] : values;
  const lo = Math.min(...scale);
  const hi = Math.max(...scale);
  // Proportional headroom: a fixed ±1 kg would flatten a week whose real
  // spread is a few hundred grams, which is exactly what this chart is for.
  const pad = Math.max(0.3, (hi - lo) * 0.15);
  const minVal = lo - pad;
  const maxVal = hi + pad;
  const span = maxVal - minVal || 1;
  const n = values.length;

  const xAt = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const yAt = (v: number) => padTop + plotH - ((v - minVal) / span) * plotH;

  const points = values.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
  const at = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

  return {
    points,
    yAt,
    line: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${at(p)}`).join(' '),
    area: `M${points[0][0].toFixed(1)},${H} ${points.map((p) => `L${at(p)}`).join(' ')} L${points[n - 1][0].toFixed(1)},${H} Z`,
  };
}

export function formatGrams(value: number): string {
  return `${Math.round(value)} g`;
}

export function formatKcal(value: number): string {
  return `${Math.round(value)} kcal`;
}
