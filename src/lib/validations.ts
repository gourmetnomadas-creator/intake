import { z } from 'zod';
import { MEAL_TYPES, WEIGHT_CONTEXTS } from '@/types';

// Derived from the shared constants so the schema can never fall behind the
// meal types the form actually offers — "dessert" used to be missing here,
// which made analyzing a dessert fail with a 400.
export const mealTypeSchema = z.enum(MEAL_TYPES);
export const weightContextSchema = z.enum(WEIGHT_CONTEXTS);

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

// A 1024px JPEG at quality 0.8 lands around 150-350 KB of base64. Two million
// characters leaves generous headroom while still rejecting a photo that
// skipped the client-side downscaling.
export const MAX_IMAGE_BASE64_LENGTH = 2_000_000;

export const analyzeMealSchema = z.object({
  imageUrl: z.string().nullable().optional(),
  imageBase64: z
    .string()
    .max(MAX_IMAGE_BASE64_LENGTH, 'Photo is too large to analyze')
    .nullable()
    .optional(),
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
