-- 1. Create the fuel_prices table
CREATE TABLE IF NOT EXISTS public.fuel_prices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    price_gasoline FLOAT DEFAULT 5.89,
    price_ethanol FLOAT DEFAULT 3.99,
    price_diesel FLOAT DEFAULT 6.09,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(city, state)
);

-- 2. Add Row Level Security (RLS) policies (Optional but recommended)
ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Enable read access for all users" ON public.fuel_prices FOR SELECT USING (true);

-- Allow write access to authenticated users (or admins only if you have roles)
CREATE POLICY "Enable write access for authenticated users" ON public.fuel_prices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON public.fuel_prices FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON public.fuel_prices FOR DELETE USING (auth.role() = 'authenticated');


-- 3. Add city and state columns to technicians table
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS state TEXT;

-- 4. Initial seed for Curitiba (Example)
INSERT INTO public.fuel_prices (city, state, price_gasoline, price_ethanol, price_diesel)
VALUES ('Curitiba', 'PR', 6.09, 4.09, 6.19)
ON CONFLICT (city, state) DO NOTHING;
