import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const today = new Date().toISOString().split('T')[0];
  console.log("Calling RPC for date:", today);
  const { data, error } = await supabase.rpc('get_daily_dash_stats', { query_date: today });
  console.log("Error:", error);
  console.log("Data:", data);
}
test()
