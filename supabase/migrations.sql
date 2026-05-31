-- Run this in Supabase SQL Editor to add new columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_conditions TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;

-- workout_logs table for exercise load tracking
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_name TEXT NOT NULL,
  sets_data JSONB,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users manage own workout logs" ON workout_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, logged_at);
