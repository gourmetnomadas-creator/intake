-- Daily water intake: one row per user per day, in millilitres.

CREATE TABLE water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  ml integer NOT NULL DEFAULT 0 CHECK (ml >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own water logs"
  ON water_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own water logs"
  ON water_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own water logs"
  ON water_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own water logs"
  ON water_logs FOR DELETE USING (auth.uid() = user_id);
