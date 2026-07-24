import {
  ageFromBirthdate,
  calculateItemNutrition,
  calculateMealTotals,
  calculateBMR,
  getActivityMultiplier,
  getGoalAdjustment,
  calculateDailyCalorieTarget,
  formatGrams,
  formatKcal,
} from '../src/lib/calculations';
import { analyzeMealSchema, mealItemSchema, totalGramsValidation } from '../src/lib/validations';
import { buildMarkdownReport } from '../src/lib/export-report';

describe('buildMarkdownReport', () => {
  it('includes profile, day totals with items, and supplement adherence', () => {
    const md = buildMarkdownReport({
      profile: { name: 'Joa', current_weight_kg: 80, birthdate: '1988-07-03' },
      meals: [
        {
          date: '2026-07-24',
          meal_time: '2026-07-24T08:00:00.000Z',
          meal_type: 'breakfast',
          description: 'oats',
          total_kcal: 400,
          total_protein_g: 20,
          total_carbs_g: 60,
          total_fat_g: 8,
          items: [
            { food_name: 'oats', grams: 80, kcal: 300, protein_g: 12, carbs_g: 50, fat_g: 5 },
          ],
        },
      ],
      weights: [{ date: '2026-07-20', weight_kg: 79.5, notes: null }],
      supplements: [
        { id: 'a', name: 'Magnesium', dose: '400mg', time_of_day: 'night', with_food: true, tip: 't' },
      ],
      supplementLogs: [{ supplement_id: 'a', date: '2026-07-24' }],
    });
    expect(md).toContain('# Intake');
    expect(md).toContain('Joa');
    expect(md).toContain('2026-07-24 — 400 kcal');
    expect(md).toContain('oats: 80 g');
    expect(md).toContain('Magnesium');
    expect(md).toContain('tildado 1 día(s)');
    // protein target 80 * 1.6 = 128
    expect(md).toContain('128 g/día');
  });
});

describe('analyzeMealSchema', () => {
  const base = {
    description: 'chicken and rice',
    totalWeightGrams: 300,
    weightContext: 'whole_plate',
    mealType: 'dinner',
  };

  it('accepts a meal with no photo (imageBase64 null)', () => {
    expect(analyzeMealSchema.safeParse({ ...base, imageBase64: null }).success).toBe(true);
  });

  it('accepts a meal with a photo', () => {
    expect(analyzeMealSchema.safeParse({ ...base, imageBase64: 'abc123' }).success).toBe(true);
  });
});

describe('ageFromBirthdate', () => {
  it('returns null for missing or invalid dates', () => {
    expect(ageFromBirthdate(null)).toBeNull();
    expect(ageFromBirthdate('')).toBeNull();
    expect(ageFromBirthdate('not-a-date')).toBeNull();
  });

  it('computes age accounting for whether the birthday has passed this year', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const fmt = (d: Date) =>
      `${d.getFullYear() - 30}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // birthday was yesterday -> already turned 30
    expect(ageFromBirthdate(fmt(yesterday))).toBe(30);
    // birthday is tomorrow -> still 29
    expect(ageFromBirthdate(fmt(tomorrow))).toBe(29);
  });
});

describe('calculateItemNutrition', () => {
  it('calculates nutrition for a given weight and per-100g values', () => {
    const result = calculateItemNutrition({
      grams: 200,
      kcal_per_100g: 71,
      protein_per_100g: 2.5,
      carbs_per_100g: 12,
      fat_per_100g: 1.5,
    });

    expect(result.kcal).toBeCloseTo(142, 1);
    expect(result.protein_g).toBeCloseTo(5, 1);
    expect(result.carbs_g).toBeCloseTo(24, 1);
    expect(result.fat_g).toBeCloseTo(3, 1);
  });

  it('returns 0 for 0 grams', () => {
    const result = calculateItemNutrition({
      grams: 0,
      kcal_per_100g: 100,
      protein_per_100g: 10,
      carbs_per_100g: 10,
      fat_per_100g: 10,
    });

    expect(result.kcal).toBe(0);
    expect(result.protein_g).toBe(0);
    expect(result.carbs_g).toBe(0);
    expect(result.fat_g).toBe(0);
  });
});

describe('calculateMealTotals', () => {
  it('sums multiple items correctly', () => {
    const items = [
      { grams: 150, kcal_per_100g: 71, protein_per_100g: 2.5, carbs_per_100g: 12, fat_per_100g: 1.5 },
      { grams: 50, kcal_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fat_per_100g: 0.3 },
    ];

    const result = calculateMealTotals(items);

    expect(result.totalKcal).toBeCloseTo(151, 0);
    expect(result.totalProtein).toBeCloseTo(4.3, 0);
    expect(result.totalCarbs).toBeCloseTo(29.5, 0);
    expect(result.totalFat).toBeCloseTo(2.4, 0);
  });
});

describe('calculateBMR', () => {
  it('calculates BMR for male', () => {
    const bmr = calculateBMR(70, 175, 30, 'male');
    expect(bmr).toBe(10 * 70 + 6.25 * 175 - 5 * 30 + 5);
  });

  it('calculates BMR for female', () => {
    const bmr = calculateBMR(60, 165, 28, 'female');
    expect(bmr).toBe(10 * 60 + 6.25 * 165 - 5 * 28 - 161);
  });
});

describe('getActivityMultiplier', () => {
  it('returns correct multipliers', () => {
    expect(getActivityMultiplier('sedentary')).toBe(1.2);
    expect(getActivityMultiplier('light')).toBe(1.375);
    expect(getActivityMultiplier('moderate')).toBe(1.55);
    expect(getActivityMultiplier('active')).toBe(1.725);
    expect(getActivityMultiplier('very_active')).toBe(1.9);
  });

  it('defaults to sedentary for unknown value', () => {
    expect(getActivityMultiplier('unknown')).toBe(1.2);
  });
});

describe('getGoalAdjustment', () => {
  it('returns correct adjustments', () => {
    expect(getGoalAdjustment('maintain')).toBe(0);
    expect(getGoalAdjustment('mild_deficit')).toBe(-250);
    expect(getGoalAdjustment('mild_surplus')).toBe(250);
    expect(getGoalAdjustment('manual')).toBe(0);
  });
});

describe('calculateDailyCalorieTarget', () => {
  it('returns manual target when goal is manual', () => {
    const result = calculateDailyCalorieTarget({
      weight_kg: null,
      height_cm: null,
      age: null,
      sex: null,
      activity_level: null,
      goal_type: 'manual',
      manual_calorie_target: 2000,
    });

    expect(result).toBe(2000);
  });

  it('calculates maintenance calories correctly', () => {
    const result = calculateDailyCalorieTarget({
      weight_kg: 70,
      height_cm: 175,
      age: 30,
      sex: 'male',
      activity_level: 'moderate',
      goal_type: 'maintain',
      manual_calorie_target: null,
    });

    const bmr = 10 * 70 + 6.25 * 175 - 5 * 30 + 5;
    expect(result).toBe(Math.round(bmr * 1.55));
  });

  it('returns null for incomplete profile', () => {
    const result = calculateDailyCalorieTarget({
      weight_kg: null,
      height_cm: null,
      age: null,
      sex: null,
      activity_level: null,
      goal_type: 'maintain',
      manual_calorie_target: null,
    });

    expect(result).toBeNull();
  });
});

describe('formatGrams', () => {
  it('formats grams correctly', () => {
    expect(formatGrams(200)).toBe('200 g');
    expect(formatGrams(100.5)).toBe('101 g');
  });
});

describe('formatKcal', () => {
  it('formats kcal correctly', () => {
    expect(formatKcal(500)).toBe('500 kcal');
    expect(formatKcal(142.7)).toBe('143 kcal');
  });
});

describe('meal item validation', () => {
  it('requires positive grams', () => {
    const result = mealItemSchema.safeParse({
      foodName: 'oatmeal',
      grams: -50,
      kcalPer100g: 71,
      proteinPer100g: 2.5,
      carbsPer100g: 12,
      fatPer100g: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('requires non-negative kcal per 100g', () => {
    const result = mealItemSchema.safeParse({
      foodName: 'oatmeal',
      grams: 100,
      kcalPer100g: -10,
      proteinPer100g: 2.5,
      carbsPer100g: 12,
      fatPer100g: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('validates correct meal item', () => {
    const result = mealItemSchema.safeParse({
      foodName: 'oatmeal',
      grams: 150,
      kcalPer100g: 71,
      proteinPer100g: 2.5,
      carbsPer100g: 12,
      fatPer100g: 1.5,
    });
    expect(result.success).toBe(true);
  });
});

describe('total grams validation', () => {
  it('validates that item grams sum equals total weight', () => {
    const items = [{ grams: 150 }, { grams: 50 }];
    expect(totalGramsValidation(items, 200)).toBe(true);
  });

  it('rejects when sum does not match total', () => {
    const items = [{ grams: 100 }, { grams: 50 }];
    expect(totalGramsValidation(items, 200)).toBe(false);
  });
});
