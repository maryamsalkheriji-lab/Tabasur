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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseActive = supabaseUrl.startsWith('http')

export const supabase = isSupabaseActive
  ? createClient(supabaseUrl, supabaseKey)
  : null

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
