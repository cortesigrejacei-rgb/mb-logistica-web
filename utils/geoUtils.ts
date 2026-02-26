
export const simulateGeocode = (address: string, index: number = 0) => {
    const addr = address.toLowerCase();

    // São Paulo
    if (addr.includes('são paulo') || addr.includes('sp') || addr.includes('paulista') || addr.includes('itaim')) {
        return { lat: -23.5505 + (Math.sin(index) * 0.04), lng: -46.6333 + (Math.cos(index) * 0.04) };
    }

    // Rio Grande do Sul (Porto Alegre default)
    if (addr.includes('porto alegre') || addr.includes('canoas')) {
        return { lat: -30.0346 + (Math.sin(index) * 0.04), lng: -51.2177 + (Math.cos(index) * 0.04) };
    }
    if (addr.includes('pelotas')) {
        return { lat: -31.7654 + (Math.sin(index) * 0.04), lng: -52.3376 + (Math.cos(index) * 0.04) };
    }
    // Generic RS fallback
    if (addr.includes('rs') || addr.includes('rio grande do sul')) {
        return { lat: -30.0346 + (Math.sin(index) * 0.08), lng: -51.2177 + (Math.cos(index) * 0.08) };
    }

    // Santa Catarina (Joinville/Floripa logic)
    if (addr.includes('joinville')) {
        return { lat: -26.3044 + (Math.sin(index) * 0.04), lng: -48.8464 + (Math.cos(index) * 0.04) };
    }
    if (addr.includes('florianopolis') || addr.includes('floripa') || addr.includes('são josé')) {
        return { lat: -27.5954 + (Math.sin(index) * 0.04), lng: -48.5480 + (Math.cos(index) * 0.04) };
    }
    if (addr.includes('tubarao') || addr.includes('tubarão')) {
        return { lat: -28.4716 + (Math.sin(index) * 0.04), lng: -49.0142 + (Math.cos(index) * 0.04) };
    }
    if (addr.includes('rio do sul')) {
        return { lat: -27.2140 + (Math.sin(index) * 0.04), lng: -49.6436 + (Math.cos(index) * 0.04) };
    }
    if (addr.includes('itajai') || addr.includes('itajaí')) {
        return { lat: -26.9095 + (Math.sin(index) * 0.04), lng: -48.6657 + (Math.cos(index) * 0.04) };
    }
    if (addr.includes('lages')) {
        return { lat: -27.8188 + (Math.sin(index) * 0.04), lng: -50.3275 + (Math.cos(index) * 0.04) };
    }
    // Generic SC fallback
    if (addr.includes('sc') || addr.includes('santa catarina')) {
        return { lat: -27.5954 + (Math.sin(index) * 0.08), lng: -48.5480 + (Math.cos(index) * 0.08) };
    }

    // Padrão (Brasília ou aleatório em Curitiba se falhar tudo)
    return { lat: -25.4297 + (Math.random() * 0.1), lng: -49.2719 + (Math.random() * 0.1) };
};

// Real Geocoding using Nominatim (OpenStreetMap)
// Respects the 1 request per second limit via delay
export const geocodeAddress = async (address: string, city?: string, state?: string, neighborhood?: string): Promise<{ lat: number, lng: number, importance: number, isFuzzy?: boolean } | null> => {
    try {
        console.log(`[geoUtils] Request:`, { address, city, state, neighborhood });

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
        let level1Query = `${address || ''}${neighborhood ? ', ' + neighborhood : ''}${city ? ', ' + city : ''}${state ? ' - ' + state : ''}, Brazil`;
        level1Query = level1Query.replace(/^, /, '').trim();

        let result = await queryNominatim(level1Query);
        if (result && (!city || isCityMatch(result, city))) {
            console.log('[geoUtils] Level 1 Success:', result.display_name);
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                importance: parseFloat(result.importance || '0'),
                isFuzzy: false
            };
        }

        // 2. Level 2: Neighborhood + City (Fuzzy street)
        if (neighborhood && city) {
            console.log('[geoUtils] Level 1 failed. Trying Level 2: Neighborhood + City...');
            let level2Query = `${neighborhood}, ${city}${state ? ' - ' + state : ''}, Brazil`;
            result = await queryNominatim(level2Query);
            if (result && isCityMatch(result, city)) {
                console.log('[geoUtils] Level 2 Success:', result.display_name);
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    importance: parseFloat(result.importance || '0'),
                    isFuzzy: true
                };
            }
        }

        // 3. Level 3: City Center (Fallback if street/neighborhood not found)
        if (city) {
            console.log('[geoUtils] Level 2 failed. Trying Level 3: City Center Fallback...');
            let level3Query = `${city} - ${state || ''}, Brazil`;
            result = await queryNominatim(level3Query);
            if (result) {
                console.log('[geoUtils] Level 3 Success (City Center):', result.display_name);
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    importance: parseFloat(result.importance || '0'),
                    isFuzzy: true
                };
            }
        }

        // 4. Level 4: State Center (Absolute last resort)
        if (state) {
            console.log('[geoUtils] Level 3 failed. Trying Level 4: State Center...');
            let level4Query = `Estado de ${state}, Brazil`;
            result = await queryNominatim(level4Query);
            if (result) {
                console.log('[geoUtils] Level 4 Success (State Center):', result.display_name);
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    importance: parseFloat(result.importance || '0'),
                    isFuzzy: true
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
};
