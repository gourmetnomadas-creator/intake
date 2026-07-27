import { z } from 'zod';

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const weightContextSchema = z.enum(['whole_plate', 'one_ingredient', 'separate_ingredients']);

export const mealItemSchema = z.object({
  foodName: z.string().min(1, 'Food name is required'),
  grams: z.number().positive('Grams must be positive'),
  kcalPer100g: z.number().nonnegative('Calories per 100g must be non-negative'),
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const analyzeMealSchema = z.object({
  imageUrl: z.string().nullable().optional(),
  imageBase64: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  totalWeightGrams: z.number().positive('Total weight in grams must be positive').nullable().optional(),
  weightContext: weightContextSchema.nullable().optional(),
  mealType: mealTypeSchema,
});

export const recalculateMealSchema = z.object({
  items: z.array(mealItemSchema).min(1, 'At least one item is required'),
});

export const totalGramsValidation = (items: { grams: number }[], totalWeightGrams: number): boolean => {
  const sum = items.reduce((acc, item) => acc + item.grams, 0);
  return Math.abs(sum - totalWeightGrams) < 0.5;
};
