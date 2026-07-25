-- Intake initial schema
-- Run this in Supabase SQL editor

-- 1. Profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  height_cm numeric,
  current_weight_kg numeric,
  age integer,
  sex text,
  activity_level text,
  goal_type text,
  manual_calorie_target integer,
  calculated_calorie_target integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Body weight logs
CREATE TABLE body_weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  weight_kg numeric NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE body_weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight logs"
  ON body_weight_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight logs"
  ON body_weight_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight logs"
  ON body_weight_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight logs"
  ON body_weight_logs FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Meals
CREATE TABLE meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  meal_time timestamp with time zone DEFAULT now(),
  meal_type text NOT NULL,
  description text,
  photo_url text,
  total_weight_g numeric,
  weight_context text,
  total_kcal numeric DEFAULT 0,
  total_protein_g numeric DEFAULT 0,
  total_carbs_g numeric DEFAULT 0,
  total_fat_g numeric DEFAULT 0,
  ai_confidence numeric,
  status text DEFAULT 'draft',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meals"
  ON meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meals"
  ON meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals"
  ON meals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals"
  ON meals FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Meal items
CREATE TABLE meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid REFERENCES meals(id) ON DELETE CASCADE NOT NULL,
  food_name text NOT NULL,
  grams numeric NOT NULL,
  kcal_per_100g numeric DEFAULT 0,
  protein_per_100g numeric DEFAULT 0,
  carbs_per_100g numeric DEFAULT 0,
  fat_per_100g numeric DEFAULT 0,
  kcal numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  source text,
  confidence numeric,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal items"
  ON meal_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own meal items"
  ON meal_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own meal items"
  ON meal_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own meal items"
  ON meal_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid()
    )
  );

-- 5. Favorite meals
CREATE TABLE favorite_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  default_total_weight_g numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE favorite_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorite meals"
  ON favorite_meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorite meals"
  ON favorite_meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorite meals"
  ON favorite_meals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorite meals"
  ON favorite_meals FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Favorite meal items
CREATE TABLE favorite_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  favorite_meal_id uuid REFERENCES favorite_meals(id) ON DELETE CASCADE NOT NULL,
  food_name text NOT NULL,
  grams numeric NOT NULL,
  kcal_per_100g numeric DEFAULT 0,
  protein_per_100g numeric DEFAULT 0,
  carbs_per_100g numeric DEFAULT 0,
  fat_per_100g numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE favorite_meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorite meal items"
  ON favorite_meal_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM favorite_meals WHERE favorite_meals.id = favorite_meal_items.favorite_meal_id AND favorite_meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own favorite meal items"
  ON favorite_meal_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM favorite_meals WHERE favorite_meals.id = favorite_meal_items.favorite_meal_id AND favorite_meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own favorite meal items"
  ON favorite_meal_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM favorite_meals WHERE favorite_meals.id = favorite_meal_items.favorite_meal_id AND favorite_meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own favorite meal items"
  ON favorite_meal_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM favorite_meals WHERE favorite_meals.id = favorite_meal_items.favorite_meal_id AND favorite_meals.user_id = auth.uid()
    )
  );

-- Storage bucket for meal photos
-- Run this separately in Supabase Storage:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('meal-photos', 'meal-photos', false);
