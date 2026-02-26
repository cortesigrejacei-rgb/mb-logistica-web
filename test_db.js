require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: tech } = await supabase.from('technicians').select('name, start_lat, start_lng, lat, lng');
  console.log("Technicians:", tech);
  
  const { data: routes } = await supabase.from('route_summaries').select('technician_id, total_distance_km, date').order('date', {ascending: false}).limit(10);
  console.log("Route Summaries:", routes);
}
check();
