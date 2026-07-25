export interface Profile {
  id: string;
  name: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  age: number | null;
  birthdate: string | null;
  sex: string | null;
  activity_level: string | null;
  goal_type: string | null;
  diet_type: string | null;
  dietary_restrictions: string | null;
  manual_calorie_target: number | null;
  calculated_calorie_target: number | null;
  created_at: string;
  updated_at: string;
}

export interface BodyWeightLog {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  notes: string | null;
  created_at: string;
}

export interface Meal {
  id: string;
  user_id: string;
  date: string;
  meal_time: string;
  meal_type: string;
  description: string | null;
  photo_url: string | null;
  total_weight_g: number | null;
  weight_context: string | null;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  ai_confidence: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  items?: MealItem[];
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_name: string;
  grams: number;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string | null;
  confidence: number | null;
  created_at: string;
}

export interface FavoriteMeal {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  default_total_weight_g: number | null;
  created_at: string;
  updated_at: string;
  items?: FavoriteMealItem[];
}

export interface FavoriteMealItem {
  id: string;
  favorite_meal_id: string;
  food_name: string;
  grams: number;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  created_at: string;
}

export interface AIAnalysisItem {
  foodName: string;
  grams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: string;
  confidence: number;
}

export interface AIAnalysisResult {
  items: AIAnalysisItem[];
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confidence: number;
  warnings: string[];
}

export interface Supplement {
  id: string;
  user_id: string;
  name: string;
  dose: string | null;
  time_of_day: TimeOfDay;
  with_food: boolean;
  tip: string | null;
  created_at: string;
}

export interface SupplementLog {
  id: string;
  user_id: string;
  supplement_id: string;
  date: string;
  created_at: string;
}

export type TimeOfDay = 'morning' | 'midday' | 'evening' | 'night';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type WeightContext = 'whole_plate' | 'one_ingredient' | 'separate_ingredients';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'mild_deficit' | 'maintain' | 'mild_surplus' | 'gain' | 'manual';
