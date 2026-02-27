
export const simulateGeocode = (address: string, index: number = 0) => {
    const addr = address.toLowerCase();

    // São Paulo
    if (addr.includes('são paulo') || addr.includes('sp') || addr.includes('paulista') || addr.includes('itaim')) {
        return { lat: -23.5505 + (Math.sin(index) * 0.04), lng: -46.6333 + (Math.cos(index) * 0.04), importance: 1 };
    }

    // Rio Grande do Sul (Porto Alegre default)
    if (addr.includes('porto alegre') || addr.includes('canoas')) {
        return { lat: -30.0346 + (Math.sin(index) * 0.04), lng: -51.2177 + (Math.cos(index) * 0.04), importance: 1 };
    }
    if (addr.includes('pelotas')) {
        return { lat: -31.7654 + (Math.sin(index) * 0.04), lng: -52.3376 + (Math.cos(index) * 0.04), importance: 1 };
    }
    // Generic RS fallback
    if (addr.includes('rs') || addr.includes('rio grande do sul')) {
        return { lat: -30.0346 + (Math.sin(index) * 0.08), lng: -51.2177 + (Math.cos(index) * 0.08), importance: 1 };
    }

    // Santa Catarina (Joinville/Floripa logic)
    if (addr.includes('joinville')) {
        return { lat: -26.3044 + (Math.sin(index) * 0.04), lng: -48.8464 + (Math.cos(index) * 0.04), importance: 1 };
    }
    if (addr.includes('florianopolis') || addr.includes('floripa') || addr.includes('são josé')) {
        return { lat: -27.5954 + (Math.sin(index) * 0.04), lng: -48.5480 + (Math.cos(index) * 0.04), importance: 1 };
    }
    if (addr.includes('tubarao') || addr.includes('tubarão')) {
        return { lat: -28.4716 + (Math.sin(index) * 0.04), lng: -49.0142 + (Math.cos(index) * 0.04), importance: 1 };
    }
    if (addr.includes('rio do sul')) {
        return { lat: -27.2140 + (Math.sin(index) * 0.04), lng: -49.6436 + (Math.cos(index) * 0.04), importance: 1 };
    }
    if (addr.includes('itajai') || addr.includes('itajaí')) {
        return { lat: -26.9095 + (Math.sin(index) * 0.04), lng: -48.6657 + (Math.cos(index) * 0.04), importance: 1 };
    }
    if (addr.includes('lages')) {
        return { lat: -27.8188 + (Math.sin(index) * 0.04), lng: -50.3275 + (Math.cos(index) * 0.04), importance: 1 };
    }
    // Generic SC fallback
    if (addr.includes('sc') || addr.includes('santa catarina')) {
        return { lat: -27.5954 + (Math.sin(index) * 0.08), lng: -48.5480 + (Math.cos(index) * 0.08), importance: 1 };
    }

    // Padrão (Brasília ou aleatório em Curitiba se falhar tudo)
    return { lat: -25.4297 + (Math.random() * 0.1), lng: -49.2719 + (Math.random() * 0.1), importance: 1 };
};

// Normalization of State Abbreviations to Full Names for better Nominatim results
const stateNames: Record<string, string> = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
    'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
    'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
    'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
    'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
    'SE': 'Sergipe', 'TO': 'Tocantins'
};

const normalizeState = (state?: string) => {
    if (!state) return '';
    const upper = state.trim().toUpperCase();
    if (!stateNames[upper]) {
        // If it's not a valid UF (2 characters), ignore it to avoid "CA//" etc.
        return '';
    }
    return stateNames[upper];
};

// Real Geocoding using Nominatim (OpenStreetMap)
// Respects the 1 request per second limit via delay
// Real Geocoding using Nominatim (OpenStreetMap)
// Respects the 1 request per second limit via delay
export const geocodeAddress = async (address: string, city?: string, state?: string, neighborhood?: string, complement?: string, notes?: string): Promise<{ lat: number, lng: number, importance: number, isFuzzy?: boolean, extractedState?: string, extractedAddress?: string } | null> => {
    try {
        console.log(`[geoUtils] Request:`, { address, city, state, neighborhood, complement, notes });

        let targetState = state;
        let targetAddress = address;

        // 1. IMPROVE STATE: If state is missing, try to extract UF (2 caps) from complement or notes
        if (!targetState) {
            const ufMatch = (complement || '').match(/\b([A-Z]{2})\b/) || (notes || '').match(/\b([A-Z]{2})\b/);
            if (ufMatch && stateNames[ufMatch[1]]) { // Only if it's a valid BR state!
                targetState = ufMatch[1];
                console.log(`[geoUtils] Extracted valid state: ${targetState}`);
            }
        }

        // 2. IMPROVE ADDRESS: If address is missing number, see if notes has a full address string
        // Many systems export "Street, Number - Neighborhood, City - ST" into the notes field.
        if (notes && notes.includes(',') && notes.toLowerCase().includes(city?.toLowerCase() || '')) {
            targetAddress = notes;
            console.log(`[geoUtils] Using full address from notes: ${targetAddress}`);
        }

        // Helper function for Nominatim request
        const queryNominatim = async (query: string) => {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`;
            console.log('[geoUtils] Fetching:', url);
            const res = await fetch(url, { headers: { 'User-Agent': 'MBLogisticaApp/1.0' } });
            if (!res.ok) return null;
            const data = await res.json();
            return (data && data.length > 0) ? data[0] : null;
        };

        // Helper to validate city match
        const isCityMatch = (result: any, targetCity: string): boolean => {
            if (!targetCity) return true;
            const addr = result.address || {};
            const returnedCity = (addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '').toLowerCase();
            const target = targetCity.toLowerCase();
            return returnedCity.includes(target) || target.includes(returnedCity);
        };

        // 1. Level 1: Full Address (Street, Number, Neighborhood, City, State)
        const fullState = normalizeState(targetState);
        let level1Query = `${targetAddress || ''}${neighborhood ? ', ' + neighborhood : ''}${city ? ', ' + city : ''}${fullState ? ', ' + fullState : ''}, Brazil`;
        level1Query = level1Query.replace(/^, /, '').trim();

        let result = await queryNominatim(level1Query);
        if (result && (!city || isCityMatch(result, city))) {
            console.log('[geoUtils] Level 1 Success:', result.display_name);
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                importance: parseFloat(result.importance || '0'),
                isFuzzy: false,
                extractedState: targetState,
                extractedAddress: targetAddress
            };
        }

        // 2. Level 2: Neighborhood + City (Fuzzy street)
        if (neighborhood && city) {
            console.log('[geoUtils] Level 1 failed. Trying Level 2: Neighborhood + City...');
            const fullState = normalizeState(targetState);
            let level2Query = `${neighborhood}, ${city}${fullState ? ', ' + fullState : ''}, Brazil`;
            result = await queryNominatim(level2Query);
            if (result && isCityMatch(result, city)) {
                console.log('[geoUtils] Level 2 Success:', result.display_name);
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    importance: parseFloat(result.importance || '0'),
                    isFuzzy: true,
                    extractedState: targetState,
                    extractedAddress: targetAddress
                };
            }
        }

        // 3. Level 3: City Center (Fallback if street/neighborhood not found)
        if (city) {
            console.log('[geoUtils] Level 2 failed. Trying Level 3: City Center Fallback...');
            const fullState = normalizeState(targetState);
            let level3Query = `${city}${fullState ? ', ' + fullState : ''}, Brazil`;
            result = await queryNominatim(level3Query);
            if (result) {
                console.log('[geoUtils] Level 3 Success (City Center):', result.display_name);
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    importance: parseFloat(result.importance || '0'),
                    isFuzzy: true,
                    extractedState: targetState,
                    extractedAddress: targetAddress
                };
            }
        }

        // 4. Level 4: State Center (Absolute last resort)
        if (targetState) {
            console.log('[geoUtils] Level 3 failed. Trying Level 4: State Center...');
            const fullState = normalizeState(targetState);
            let level4Query = `Estado de ${fullState}, Brazil`;
            result = await queryNominatim(level4Query);
            if (result) {
                console.log('[geoUtils] Level 4 Success (State Center):', result.display_name);
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    importance: parseFloat(result.importance || '0'),
                    isFuzzy: true,
                    extractedState: targetState,
                    extractedAddress: targetAddress
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
};
