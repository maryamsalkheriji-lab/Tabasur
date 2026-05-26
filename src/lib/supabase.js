// ============================================
// إعداد Supabase — ضع بياناتك هنا
// ============================================
// 1. اذهب إلى https://supabase.com وأنشئ مشروعًا جديدًا
// 2. من Project Settings > API انسخ:
//    - Project URL  ← ضعه في VITE_SUPABASE_URL
//    - anon/public key ← ضعه في VITE_SUPABASE_ANON_KEY
// 3. ضعهم في ملف .env في جذر المشروع
// ============================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hmxnubgqtygipxuxyuqt.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhteG51YmdxdHlnaXB4dXh5dXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzM0MTQsImV4cCI6MjA5NTMwOTQxNH0.2n8P96CiXPiwgOrMznTAv7aUUwVdzH3v3fxJTSfWNRI'

export const isSupabaseActive = true
export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================
// SQL — شغّله في SQL Editor داخل Supabase:
// ============================================
/*
CREATE TABLE IF NOT EXISTS registrations (
  id            BIGSERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  mobile        TEXT NOT NULL,
  city          TEXT,
  specialty     TEXT NOT NULL,
  experience    TEXT,
  ai_experience TEXT,
  portfolio     TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- السماح بالإدراج للزوار
CREATE POLICY "allow_insert" ON registrations
  FOR INSERT TO anon WITH CHECK (true);

-- السماح بالقراءة للمسجّلين فقط (لصفحة الأدمن)
CREATE POLICY "allow_select_auth" ON registrations
  FOR SELECT TO authenticated USING (true);

-- أو إذا أردت قراءة بدون auth (للتطوير فقط):
-- CREATE POLICY "allow_select_all" ON registrations
--   FOR SELECT TO anon USING (true);
*/
