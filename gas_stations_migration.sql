-- 1. Drop the previous table if it exists (since we are changing the model)
DROP TABLE IF EXISTS public.fuel_prices;

-- 2. Create the gas_stations table
CREATE TABLE IF NOT EXISTS public.gas_stations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    price_gasoline FLOAT DEFAULT 0.0,
    price_ethanol FLOAT DEFAULT 0.0,
    price_diesel FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Add Row Level Security (RLS)
ALTER TABLE public.gas_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.gas_stations FOR SELECT USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.gas_stations FOR ALL USING (auth.role() = 'authenticated');

-- 4. Initial seed
INSERT INTO public.gas_stations (name, city, state, price_gasoline, price_ethanol, price_diesel)
VALUES ('Posto Central', 'Curitiba', 'PR', 6.09, 4.09, 6.19);
