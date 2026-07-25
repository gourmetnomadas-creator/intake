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

export function formatGrams(value: number): string {
  return `${Math.round(value)} g`;
}

export function formatKcal(value: number): string {
  return `${Math.round(value)} kcal`;
}
