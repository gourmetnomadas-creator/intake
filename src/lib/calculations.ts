import type { MealType } from '@/types';

// The order meals are normally logged through the day. Snack appears twice on
// purpose: a mid-morning one and an afternoon one.
export const MEAL_TYPE_SEQUENCE: readonly MealType[] = [
  'breakfast',
  'snack',
  'lunch',
  'snack',
  'dinner',
  'dessert',
];

/**
 * Suggest which meal to log next, from the types already logged that day.
 *
 * Each logged meal claims one slot in the sequence, so a day that already has
 * one snack still goes on to offer the second. Once every slot is claimed,
 * anything further is most likely a snack.
 */
export function suggestNextMealType(loggedMealTypes: string[]): MealType {
  const unclaimed = new Map<string, number>();
  for (const type of loggedMealTypes) {
    unclaimed.set(type, (unclaimed.get(type) ?? 0) + 1);
  }

  for (const type of MEAL_TYPE_SEQUENCE) {
    const remaining = unclaimed.get(type) ?? 0;
    if (remaining === 0) return type;
    unclaimed.set(type, remaining - 1);
  }

  return 'snack';
}

/**
 * The hours of the day each main meal normally falls in. The gaps between
 * them (15:00–19:00 here) belong to snacks, not to the next main meal.
 */
const MAIN_MEAL_WINDOWS: readonly { type: MealType; fromHour: number; endsAtHour: number }[] = [
  { type: 'breakfast', fromHour: 0, endsAtHour: 11 },
  { type: 'lunch', fromHour: 11, endsAtHour: 15 },
  { type: 'dinner', fromHour: 19, endsAtHour: 24 },
];

/** The hour from which the day counts as closing even without a dinner logged. */
const LATE_HOUR = 21;

/**
 * A calorie gap this small is noise: hitting it exactly matters less than not
 * eating a whole extra meal to chase it.
 */
export const CLOSE_ENOUGH_KCAL = 150;

export interface SuggestionContext {
  /** The slot a suggestion should fill. */
  mealType: MealType;
  /** Dinner is logged, or it is late: only a light close-out still fits. */
  isClosing: boolean;
  /** Minutes since the last meal was logged, when that is known. */
  minutesSinceLastMeal: number | null;
  /** Main meals still ahead today, this one included. Never below 1. */
  mealsLeftToday: number;
}

function minutesSince(at: string | Date | null | undefined, now: Date): number | null {
  if (!at) return null;
  const then = at instanceof Date ? at : new Date(at);
  if (isNaN(then.getTime())) return null;
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000);
  return minutes < 0 ? null : minutes;
}

/**
 * What the next suggestion should be aiming at, from the meals already logged
 * and the clock — the two together, since neither alone is enough. The clock
 * says dinner at 19:00 even when dinner is already eaten, and the logged meals
 * say "second snack" at 19:00 for someone who only had breakfast.
 */
export function suggestionContext(input: {
  loggedMealTypes: string[];
  lastMealAt?: string | Date | null;
  now?: Date;
}): SuggestionContext {
  const now = input.now ?? new Date();
  const hour = now.getHours();
  const logged = new Set(input.loggedMealTypes);

  const isClosing = logged.has('dinner') || hour >= LATE_HOUR;

  // Once the day is closing there is no main meal left to suggest, only
  // something small: dessert if it is still free, otherwise a snack.
  let mealType: MealType;
  if (isClosing) {
    mealType = logged.has('dessert') ? 'snack' : 'dessert';
  } else {
    // Between two main meals, or on one that is already logged, anything the
    // user eats now is a snack.
    const current = MAIN_MEAL_WINDOWS.find((w) => hour >= w.fromHour && hour < w.endsAtHour);
    mealType = current && !logged.has(current.type) ? current.type : 'snack';
  }

  const mealsLeftToday = isClosing
    ? 1
    : Math.max(1, MAIN_MEAL_WINDOWS.filter((w) => hour < w.endsAtHour && !logged.has(w.type)).length);

  return {
    mealType,
    isClosing,
    minutesSinceLastMeal: minutesSince(input.lastMealAt, now),
    mealsLeftToday,
  };
}

export interface SuggestionBudget {
  /** Hard ceiling for a single suggestion. Null when there is no calorie goal. */
  maxKcal: number | null;
  /** The size to aim for: the gap shared across the meals still to come. */
  targetKcal: number | null;
  /** The goal is met, or close enough that another meal is not needed. */
  nothingNeeded: boolean;
  /** How many suggestions are worth showing. Zero means: suggest nothing. */
  count: number;
}

/**
 * How much room a suggestion has. Without this the model is only told "fit
 * within the remaining calories", which it reads as "spend all of them" — a
 * full plate at 19:00 for a 300 kcal gap left after dinner.
 */
export function suggestionBudget(
  remainingKcal: number | null,
  context: Pick<SuggestionContext, 'isClosing' | 'mealsLeftToday'>
): SuggestionBudget {
  if (remainingKcal === null) {
    return { maxKcal: null, targetKcal: null, nothingNeeded: false, count: 3 };
  }

  if (remainingKcal <= 0) {
    return { maxKcal: 0, targetKcal: 0, nothingNeeded: true, count: 0 };
  }

  const maxKcal = Math.round(remainingKcal);

  if (remainingKcal < CLOSE_ENOUGH_KCAL) {
    // Worth offering something for whoever is actually hungry, but not a menu.
    return { maxKcal, targetKcal: maxKcal, nothingNeeded: true, count: 2 };
  }

  return {
    maxKcal,
    targetKcal: Math.round(remainingKcal / context.mealsLeftToday),
    nothingNeeded: false,
    count: 3,
  };
}

export interface MacroGaps {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MacroGapSummary {
  /** One line per known macro, ready to drop into a prompt. */
  lines: string[];
  /** The macro furthest below target, if any is meaningfully short. */
  priority: string | null;
  /** Macros already past target. Adding more of these is the wrong answer. */
  over: string[];
}

/** Grams either way that count as "on target" rather than short or over. */
const MACRO_TOLERANCE_G = 5;

/**
 * Turn signed macro gaps (target minus consumed) into prompt lines. Clamping
 * these at zero, as the API used to, hides every overshoot: a day 32 g past
 * its protein target looks exactly like one that hit it.
 */
export function describeMacroGaps(gaps: MacroGaps): MacroGapSummary {
  const lines: string[] = [];
  const over: string[] = [];
  let priority: string | null = null;
  let priorityGap = MACRO_TOLERANCE_G;

  for (const name of ['protein', 'carbs', 'fat'] as const) {
    const gap = gaps[name];
    if (gap === null || gap === undefined || isNaN(gap)) continue;

    const grams = Math.round(gap);
    if (grams > MACRO_TOLERANCE_G) {
      lines.push(`${name}: ${grams} g short of target.`);
      if (grams > priorityGap) {
        priority = name;
        priorityGap = grams;
      }
    } else if (grams < -MACRO_TOLERANCE_G) {
      over.push(name);
      lines.push(
        `${name}: ${Math.abs(grams)} g OVER target — do not add ${name}-heavy foods.`
      );
    } else {
      lines.push(`${name}: on target.`);
    }
  }

  return { lines, priority, over };
}

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

/**
 * Energy in a kilo of body mass — the metric twin of the ~3,500 kcal/lb figure
 * every calorie calculator uses for "how fast will I get there".
 */
export const KCAL_PER_KG = 7700;

/**
 * Pace of each goal as a share of bodyweight per week, with a daily cap.
 * A flat -500 is far too aggressive on a 50 kg person and too timid on a
 * 120 kg one, so the deficit follows the body it applies to; the caps keep
 * the fast paces inside the usual safe range.
 */
const PACE: Record<string, { pctPerWeek: number; capPerDay: number }> = {
  mild_deficit: { pctPerWeek: -0.005, capPerDay: 500 },
  lose: { pctPerWeek: -0.01, capPerDay: 750 },
  mild_surplus: { pctPerWeek: 0.0035, capPerDay: 300 },
  gain: { pctPerWeek: 0.006, capPerDay: 400 },
};

/** Fallback when bodyweight is unknown: the old flat presets. */
const FLAT_ADJUSTMENT: Record<string, number> = {
  lose: -500,
  mild_deficit: -250,
  maintain: 0,
  mild_surplus: 250,
  gain: 500,
  manual: 0,
};

/**
 * Daily calorie adjustment for a goal. With a bodyweight it is sized to a
 * percentage of that weight per week; without one it falls back to the flat
 * preset.
 */
export function getGoalAdjustment(goalType: string, weightKg?: number | null): number {
  const pace = PACE[goalType];
  if (!pace || !weightKg || weightKg <= 0) return FLAT_ADJUSTMENT[goalType] ?? 0;

  const perDay = (pace.pctPerWeek * weightKg * KCAL_PER_KG) / 7;
  const capped = Math.sign(perDay) * Math.min(Math.abs(perDay), pace.capPerDay);
  return Math.round(capped);
}

/**
 * Lowest daily intake this app will ever *calculate* for someone. Below these
 * a plan stops being a diet and starts being a medical matter, so an
 * aggressive deficit on a small body is clamped here rather than shipped.
 * Sex unknown -> the lower floor, so we never push someone to eat more than
 * their own numbers call for.
 */
export function minimumCalories(sex: string | null | undefined): number {
  return sex === 'male' ? 1500 : 1200;
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
  const adjustment = getGoalAdjustment(profile.goal_type ?? 'maintain', profile.weight_kg);

  // The floor applies to what we compute, never to a target the user typed in
  // themselves — that one is their call (and possibly their doctor's).
  return Math.max(
    minimumCalories(profile.sex),
    Math.round(bmr * multiplier + adjustment)
  );
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

/** A glass. The unit the +/- buttons move water by. */
export const GLASS_ML = 250;

/**
 * Daily water target in millilitres: ~35 ml per kg of bodyweight, rounded to
 * the nearest glass. Falls back to a flat 2 L when we do not know the weight.
 */
export function waterTargetMl(weightKg: number | null | undefined): number {
  if (!weightKg || weightKg <= 0) return 2000;
  const raw = weightKg * 35;
  return Math.max(1500, Math.round(raw / GLASS_ML) * GLASS_ML);
}

export function formatGrams(value: number): string {
  return `${Math.round(value)} g`;
}

export function formatKcal(value: number): string {
  return `${Math.round(value)} kcal`;
}
