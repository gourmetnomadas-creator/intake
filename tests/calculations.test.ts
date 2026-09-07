import {
  ageFromBirthdate,
  calculateItemNutrition,
  calculateMealTotals,
  calculateBMR,
  getActivityMultiplier,
  getGoalAdjustment,
  minimumCalories,
  calculateDailyCalorieTarget,
  formatGrams,
  formatKcal,
  weeklyAverageWeight,
  logsInRange,
  buildTrendPath,
  suggestNextMealType,
  suggestionContext,
  suggestionBudget,
  describeMacroGaps,
  CLOSE_ENOUGH_KCAL,
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
    expect(md).toContain('checked off on 1 day(s)');
    // protein target 80 * 1.6 = 128
    expect(md).toContain('128 g/day');
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

  it('accepts a photo with nothing written about it', () => {
    const withoutDescription = { ...base, description: undefined };
    expect(
      analyzeMealSchema.safeParse({ ...withoutDescription, imageBase64: 'abc123' }).success
    ).toBe(true);
    expect(
      analyzeMealSchema.safeParse({ ...base, description: '   ', imageBase64: 'abc123' }).success
    ).toBe(true);
  });

  it('rejects a meal with neither a photo nor a description', () => {
    const result = analyzeMealSchema.safeParse({ ...base, description: '  ', imageBase64: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/description or a photo/i);
    }
  });
});

describe('suggestNextMealType', () => {
  it('starts the day with breakfast', () => {
    expect(suggestNextMealType([])).toBe('breakfast');
  });

  it('walks the whole day one meal at a time', () => {
    const logged: string[] = [];
    const suggestions: string[] = [];

    // Log whatever is suggested, six times over, and record the path taken.
    for (let i = 0; i < 6; i++) {
      const next = suggestNextMealType(logged);
      suggestions.push(next);
      logged.push(next);
    }

    expect(suggestions).toEqual(['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'dessert']);
  });

  it('offers the second snack after lunch', () => {
    // The bug this guards: counting distinct types rather than occurrences
    // treated one snack as filling both slots and skipped ahead to dinner.
    expect(suggestNextMealType(['breakfast', 'snack', 'lunch'])).toBe('snack');
  });

  it('moves on to dinner once both snacks are logged', () => {
    expect(suggestNextMealType(['breakfast', 'snack', 'lunch', 'snack'])).toBe('dinner');
  });

  it('ignores the order meals were logged in', () => {
    expect(suggestNextMealType(['lunch', 'breakfast', 'snack'])).toBe('snack');
  });

  it('suggests a snack once every slot is filled', () => {
    expect(
      suggestNextMealType(['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'dessert'])
    ).toBe('snack');
  });

  it('skips ahead when the day started late', () => {
    expect(suggestNextMealType(['lunch'])).toBe('breakfast');
    expect(suggestNextMealType(['breakfast', 'lunch'])).toBe('snack');
  });

  it('is unfazed by meal types outside the sequence', () => {
    expect(suggestNextMealType(['breakfast', 'brunch'])).toBe('snack');
  });
});

describe('suggestionContext', () => {
  const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

  it('does not offer dinner to someone who just ate dinner', () => {
    // The bug this guards: the card read the clock only, so 18:59 meant
    // "dinner" even with dinner already on the plate behind you.
    const ctx = suggestionContext({
      loggedMealTypes: ['breakfast', 'lunch', 'dinner'],
      now: at(18, 59),
    });

    expect(ctx.isClosing).toBe(true);
    expect(ctx.mealType).toBe('dessert');
    expect(ctx.mealsLeftToday).toBe(1);
  });

  it('falls back to a snack once dessert is logged too', () => {
    const ctx = suggestionContext({
      loggedMealTypes: ['dinner', 'dessert'],
      now: at(21, 30),
    });
    expect(ctx.mealType).toBe('snack');
  });

  it('closes the day late even without a dinner logged', () => {
    const ctx = suggestionContext({ loggedMealTypes: ['breakfast'], now: at(22) });
    expect(ctx.isClosing).toBe(true);
  });

  it('offers the meal the clock is on when it is still free', () => {
    const ctx = suggestionContext({ loggedMealTypes: ['breakfast'], now: at(13) });
    expect(ctx.isClosing).toBe(false);
    expect(ctx.mealType).toBe('lunch');
    // Lunch and dinner still ahead.
    expect(ctx.mealsLeftToday).toBe(2);
  });

  it('offers a snack when the main meal for this hour is already logged', () => {
    const ctx = suggestionContext({
      loggedMealTypes: ['breakfast', 'lunch'],
      now: at(16),
    });
    expect(ctx.mealType).toBe('snack');
    expect(ctx.isClosing).toBe(false);
  });

  it('starts a bare day at breakfast', () => {
    const ctx = suggestionContext({ loggedMealTypes: [], now: at(8) });
    expect(ctx.mealType).toBe('breakfast');
    expect(ctx.mealsLeftToday).toBe(3);
  });

  it('reports how long ago the last meal was', () => {
    const ctx = suggestionContext({
      loggedMealTypes: ['dinner'],
      lastMealAt: at(18, 30).toISOString(),
      now: at(19),
    });
    expect(ctx.minutesSinceLastMeal).toBe(30);
  });

  it('reports no elapsed time for a missing or unusable timestamp', () => {
    const now = at(19);
    expect(suggestionContext({ loggedMealTypes: [], now }).minutesSinceLastMeal).toBeNull();
    expect(
      suggestionContext({ loggedMealTypes: [], lastMealAt: 'not a date', now }).minutesSinceLastMeal
    ).toBeNull();
    expect(
      suggestionContext({ loggedMealTypes: [], lastMealAt: at(20).toISOString(), now })
        .minutesSinceLastMeal
    ).toBeNull();
  });
});

describe('suggestionBudget', () => {
  const closing = { isClosing: true, mealsLeftToday: 1 };
  const midDay = { isClosing: false, mealsLeftToday: 2 };

  it('suggests nothing at all once the goal is covered', () => {
    const budget = suggestionBudget(0, closing);
    expect(budget.count).toBe(0);
    expect(budget.nothingNeeded).toBe(true);
    expect(suggestionBudget(-200, midDay).count).toBe(0);
  });

  it('says a small gap does not need a meal, but still offers a light option', () => {
    const budget = suggestionBudget(CLOSE_ENOUGH_KCAL - 1, closing);
    expect(budget.nothingNeeded).toBe(true);
    expect(budget.count).toBe(2);
    expect(budget.maxKcal).toBe(CLOSE_ENOUGH_KCAL - 1);
  });

  it('caps a close-out at the calories actually left', () => {
    // The 323 kcal left after dinner: a close-out, not a second dinner.
    const budget = suggestionBudget(323, closing);
    expect(budget.nothingNeeded).toBe(false);
    expect(budget.maxKcal).toBe(323);
    expect(budget.targetKcal).toBe(323);
  });

  it('shares the gap across the meals still to come', () => {
    const budget = suggestionBudget(1200, midDay);
    expect(budget.targetKcal).toBe(600);
    expect(budget.maxKcal).toBe(1200);
  });

  it('leaves portions unconstrained when there is no calorie goal', () => {
    const budget = suggestionBudget(null, midDay);
    expect(budget.maxKcal).toBeNull();
    expect(budget.count).toBe(3);
    expect(budget.nothingNeeded).toBe(false);
  });
});

describe('describeMacroGaps', () => {
  it('flags a macro that is over target instead of hiding it', () => {
    // The bug this guards: clamping gaps at zero made 32 g of extra protein
    // read exactly like protein landing on target.
    const summary = describeMacroGaps({ protein: -32, carbs: 45, fat: 0 });

    expect(summary.over).toEqual(['protein']);
    expect(summary.lines.some((l) => /protein: 32 g OVER/.test(l))).toBe(true);
    expect(summary.priority).toBe('carbs');
  });

  it('treats a few grams either way as on target', () => {
    const summary = describeMacroGaps({ protein: 3, carbs: -4, fat: 0 });
    expect(summary.over).toEqual([]);
    expect(summary.priority).toBeNull();
    expect(summary.lines).toHaveLength(3);
    expect(summary.lines.every((l) => /on target/.test(l))).toBe(true);
  });

  it('picks the largest shortfall as the priority', () => {
    expect(describeMacroGaps({ protein: 20, carbs: 60, fat: 10 }).priority).toBe('carbs');
    expect(describeMacroGaps({ protein: 40, carbs: 12, fat: 10 }).priority).toBe('protein');
  });

  it('skips macros with no target to compare against', () => {
    const summary = describeMacroGaps({ protein: null, carbs: 30, fat: null });
    expect(summary.lines).toHaveLength(1);
    expect(summary.lines[0]).toMatch(/carbs/);
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

describe('getGoalAdjustment with bodyweight', () => {
  it('scales the deficit to the body it applies to', () => {
    // 0.5%/week of 60 kg = 0.3 kg = 2310 kcal over 7 days = 330/day
    expect(getGoalAdjustment('mild_deficit', 60)).toBe(-330);
    expect(getGoalAdjustment('mild_deficit', 120)).toBe(-500); // capped
  });

  it('caps the aggressive pace at 750 a day', () => {
    expect(getGoalAdjustment('lose', 50)).toBe(-550);
    expect(getGoalAdjustment('lose', 100)).toBe(-750);
  });

  it('keeps surpluses in the 300-400 range', () => {
    expect(getGoalAdjustment('mild_surplus', 70)).toBe(270);
    expect(getGoalAdjustment('gain', 90)).toBe(400);
  });

  it('falls back to the flat preset without a weight', () => {
    expect(getGoalAdjustment('lose')).toBe(-500);
    expect(getGoalAdjustment('lose', 0)).toBe(-500);
  });
});

describe('calorie floor', () => {
  it('never calculates below the floor for the sex', () => {
    const result = calculateDailyCalorieTarget({
      weight_kg: 45,
      height_cm: 150,
      age: 60,
      sex: 'female',
      activity_level: 'sedentary',
      goal_type: 'lose',
      manual_calorie_target: null,
    });

    // BMR 1029 * 1.2 = 1235, minus a 495 deficit = 740 — clamped to 1200.
    expect(result).toBe(1200);
    expect(minimumCalories('female')).toBe(1200);
    expect(minimumCalories('male')).toBe(1500);
  });

  it('leaves a manual target alone', () => {
    const result = calculateDailyCalorieTarget({
      weight_kg: 45,
      height_cm: 150,
      age: 60,
      sex: 'female',
      activity_level: 'sedentary',
      goal_type: 'manual',
      manual_calorie_target: 900,
    });

    expect(result).toBe(900);
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

describe('weeklyAverageWeight', () => {
  const today = new Date('2026-08-06');

  it('averages only the weigh-ins inside the 7-day window', () => {
    expect(
      weeklyAverageWeight(
        [
          { date: '2026-08-06', weight_kg: 61.1 },
          { date: '2026-08-05', weight_kg: 60.4 },
          { date: '2026-08-01', weight_kg: 60.3 },
          { date: '2026-07-25', weight_kg: 99 }, // outside the window
        ],
        today
      )
    ).toBe(60.6);
  });

  it('returns null with fewer than two entries in the window', () => {
    expect(weeklyAverageWeight([{ date: '2026-08-06', weight_kg: 61.1 }], today)).toBeNull();
    expect(weeklyAverageWeight([], today)).toBeNull();
  });
});

describe('logsInRange', () => {
  const today = new Date('2026-08-06');
  const logs = [
    { date: '2026-08-06', weight_kg: 61 },
    { date: '2026-08-02', weight_kg: 60 },
    { date: '2026-07-20', weight_kg: 59 },
    { date: '2025-09-01', weight_kg: 58 },
    { date: '2024-01-01', weight_kg: 57 },
  ];

  it('windows by range', () => {
    expect(logsInRange(logs, 'week', today).map((l) => l.date)).toEqual(['2026-08-06', '2026-08-02']);
    expect(logsInRange(logs, 'month', today)).toHaveLength(3);
    expect(logsInRange(logs, 'year', today)).toHaveLength(4);
  });

  it('excludes future-dated entries', () => {
    expect(logsInRange([{ date: '2026-08-09', weight_kg: 61 }], 'year', today)).toEqual([]);
  });
});

describe('buildTrendPath', () => {
  const opts = { width: 100, height: 50, padTop: 0, padBottom: 0 };

  it('returns null for an empty series', () => {
    expect(buildTrendPath([], opts)).toBeNull();
  });

  it('spreads points across the width and inverts the y axis', () => {
    const p = buildTrendPath([60, 62], opts)!;
    expect(p.points[0][0]).toBe(0);
    expect(p.points[1][0]).toBe(100);
    // heavier weight sits higher on screen => smaller y
    expect(p.points[1][1]).toBeLessThan(p.points[0][1]);
    expect(p.line.startsWith('M0.0,')).toBe(true);
    // area closes back down to the baseline
    expect(p.area.endsWith('L100.0,50 Z')).toBe(true);
  });

  it('keeps an out-of-series goal on canvas', () => {
    const p = buildTrendPath([60, 61], { ...opts, include: 40 })!;
    const goalY = p.yAt(40);
    expect(goalY).toBeGreaterThan(0);
    expect(goalY).toBeLessThanOrEqual(50);
  });

  it('centres a single point', () => {
    expect(buildTrendPath([60], opts)!.points[0][0]).toBe(50);
  });
});
