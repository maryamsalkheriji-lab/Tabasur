import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hmxnubgqtygipxuxyuqt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhteG51YmdxdHlnaXB4dXh5dXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzM0MTQsImV4cCI6MjA5NTMwOTQxNH0.2n8P96CiXPiwgOrMznTAv7aUUwVdzH3v3fxJTSfWNRI'

export const isSupabaseActive = true
export const supabase = createClient(supabaseUrl, supabaseKey)