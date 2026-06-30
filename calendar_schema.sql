-- Table pour le calendrier du club
-- À exécuter dans le SQL Editor de Supabase (https://supabase.com/dashboard/project/ajbpzueanpeukozjhkiv/sql/new)

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'event', -- 'course', 'competition', 'exam', 'stage', 'holiday', 'other'
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz,
  all_day boolean DEFAULT false,
  category text, -- 'baby', 'enfants', 'ados', 'adultes', 'iaido', 'taiso', 'tous'
  location text,
  color text, -- hex color for the calendar
  recurrence text, -- NULL or 'weekly', 'monthly'
  recurrence_end date, -- end date for recurring events
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);

-- Enable RLS (Row Level Security)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read
CREATE POLICY "Anyone can read calendar events" ON calendar_events FOR SELECT USING (true);

-- Policy: only authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can insert calendar events" ON calendar_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update calendar events" ON calendar_events FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete calendar events" ON calendar_events FOR DELETE USING (true);

-- Insert default courses (récurrents - on stocke la prochaine occurrence)
-- Ces événements seront copiés chaque semaine par le frontend
INSERT INTO calendar_events (title, description, event_type, start_datetime, end_datetime, category, color, recurrence) VALUES
-- Baby Judo: Lundi 17h15-18h15
('Baby Judo', 'Cours de Baby Judo (3-5 ans)', 'course', '2026-06-22T17:15:00+02:00', '2026-06-22T18:15:00+02:00', 'baby', '#e2b13c', 'weekly'),
-- Baby Judo: Mardi 17h15-18h15
('Baby Judo', 'Cours de Baby Judo (3-5 ans)', 'course', '2026-06-23T17:15:00+02:00', '2026-06-23T18:15:00+02:00', 'baby', '#e2b13c', 'weekly'),
-- Baby Judo: Samedi 17h15-18h15
('Baby Judo', 'Cours de Baby Judo (3-5 ans)', 'course', '2026-06-27T17:15:00+02:00', '2026-06-27T18:15:00+02:00', 'baby', '#e2b13c', 'weekly'),

-- Mini-poussins/Poussins: Lundi 18h15-19h45
('Mini-poussins / Poussins', 'Cours 6-9 ans', 'course', '2026-06-22T18:15:00+02:00', '2026-06-22T19:45:00+02:00', 'enfants', '#3b82f6', 'weekly'),
-- Mini-poussins/Poussins: Mardi 18h15-19h45
('Mini-poussins / Poussins', 'Cours 6-9 ans', 'course', '2026-06-23T18:15:00+02:00', '2026-06-23T19:45:00+02:00', 'enfants', '#3b82f6', 'weekly'),
-- Mini-poussins/Poussins: Samedi 18h15-19h45
('Mini-poussins / Poussins', 'Cours 6-9 ans', 'course', '2026-06-27T18:15:00+02:00', '2026-06-27T19:45:00+02:00', 'enfants', '#3b82f6', 'weekly'),

-- Benjamins/Minimes: Lundi 19h30-21h15
('Benjamins / Minimes', 'Cours 10-13 ans', 'course', '2026-06-22T19:30:00+02:00', '2026-06-22T21:15:00+02:00', 'enfants', '#22c55e', 'weekly'),
-- Benjamins/Minimes: Mardi 19h30-21h15
('Benjamins / Minimes', 'Cours 10-13 ans', 'course', '2026-06-23T19:30:00+02:00', '2026-06-23T21:15:00+02:00', 'enfants', '#22c55e', 'weekly'),

-- Cadets/Juniors/Séniors: Mercredi 20h30-22h
('Cadets / Juniors / Séniors', 'Cours 14 ans et +', 'course', '2026-06-24T20:30:00+02:00', '2026-06-24T22:00:00+02:00', 'ados', '#a855f7', 'weekly'),
-- Cadets/Juniors/Séniors: Jeudi 16h30-19h30
('Cadets / Juniors / Séniors', 'Cours 14 ans et +', 'course', '2026-06-25T16:30:00+02:00', '2026-06-25T19:30:00+02:00', 'ados', '#a855f7', 'weekly'),
-- Cadets/Juniors/Séniors: Jeudi 20h30-22h
('Cadets / Juniors / Séniors', 'Cours 14 ans et +', 'course', '2026-06-25T20:30:00+02:00', '2026-06-25T22:00:00+02:00', 'ados', '#a855f7', 'weekly'),

-- Iaïdo: Lundi 19h45-21h15
('Iaïdo', 'Cours d''Iaïdo - Adultes', 'course', '2026-06-22T19:45:00+02:00', '2026-06-22T21:15:00+02:00', 'iaido', '#f97316', 'weekly'),
-- Iaïdo: Jeudi 19h30-22h
('Iaïdo', 'Cours d''Iaïdo - Adultes', 'course', '2026-06-25T19:30:00+02:00', '2026-06-25T22:00:00+02:00', 'iaido', '#f97316', 'weekly'),
-- Iaïdo: Samedi 11h-12h
('Iaïdo', 'Cours d''Iaïdo - Adultes', 'course', '2026-06-27T11:00:00+02:00', '2026-06-27T12:00:00+02:00', 'iaido', '#f97316', 'weekly'),

-- Taïso: Dimanche 9h30-11h
('Taïso', 'Cours de Taïso - Adultes', 'course', '2026-06-28T09:30:00+02:00', '2026-06-28T11:00:00+02:00', 'taiso', '#06b6d4', 'weekly');
