-- User dietary preferences, used to tailor AI meal suggestions
ALTER TABLE profiles ADD COLUMN diet_type text;
ALTER TABLE profiles ADD COLUMN dietary_restrictions text;
