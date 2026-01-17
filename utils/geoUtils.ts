
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
export const geocodeAddress = async (address: string, city?: string, state?: string, neighborhood?: string): Promise<{ lat: number, lng: number, importance: number } | null> => {
    try {
        console.log(`[geoUtils] Request:`, { address, city, state, neighborhood });

        // Construct query using structured parameters for better precision if possible
        let url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1`;
        let usedStructured = false;

        if (city && state) {
            // Structured Search (More Precise)
            usedStructured = true;
            if (address) {
                url += `&street=${encodeURIComponent(address)}`;
            }
            if (neighborhood) {
                url += `&neighborhood=${encodeURIComponent(neighborhood)}`;
            }
            url += `&city=${encodeURIComponent(city)}`;
            url += `&state=${encodeURIComponent(state)}`;
            url += `&country=Brazil`;
        } else {
            // Fallback to Free-form Search
            let query = address;
            if (city) query += `, ${city}`;
            if (state) query += ` - ${state}`;
            query += ', Brazil';
            url += `&q=${encodeURIComponent(query)}`;
        }

        console.log('[geoUtils] Trying Structured URL:', url);

        // Fetch with header to identify our app (good practice for Nominatim)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MBLogisticaApp/1.0'
            }
        });

        // Helper function to validate city match
        const isCityMatch = (result: any, targetCity: string): boolean => {
            if (!targetCity) return true;
            const addr = result.address || {};
            // Nominatim returns city, town, village, municipality, city_district, etc.
            const returnedCity = (addr.city || addr.town || addr.village || addr.municipality || '').toLowerCase();
            const target = targetCity.toLowerCase();

            // Simple inclusion check (e.g. "Porto Alegre" in "Município de Porto Alegre")
            const match = returnedCity.includes(target) || target.includes(returnedCity);
            if (!match) {
                console.log(`[geoUtils] City Mismatch! Requested: "${targetCity}", Got: "${returnedCity}". Discarding result.`);
            }
            return match;
        };

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                // VALIDATE CITY MATCH
                if (!city || isCityMatch(data[0], city)) {
                    console.log('[geoUtils] Structured Success:', data[0]);
                    return {
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon),
                        importance: parseFloat(data[0].importance || '0')
                    };
                } else {
                    console.log('[geoUtils] Structured result discarded due to city mismatch.');
                }
            } else {
                console.log('[geoUtils] Structured returned 0 results.');
            }
        } else {
            console.log('[geoUtils] Structured Network Error:', response.status);
        }

        // RETRY: If structured strict search failed, try Free-form (Fuzzy) search
        // This handles cases where "city" might be slightly different or Nominatim is fussy
        if (usedStructured && city && (address || neighborhood)) {
            console.log('[geocodeAddress] Structured search failed/mismatched. Retrying with fuzzy query...');
            let fuzzyQuery = `${address || ''}, ${neighborhood || ''}, ${city} - ${state}, Brazil`;
            // Clean up double commas
            fuzzyQuery = fuzzyQuery.replace(/, ,/g, ',');
            fuzzyQuery = fuzzyQuery.replace(/^, /, ''); // Remove leading comma

            const fuzzyUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(fuzzyQuery)}`;
            console.log('[geoUtils] Trying Fuzzy URL:', fuzzyUrl);

            const response2 = await fetch(fuzzyUrl, { headers: { 'User-Agent': 'MBLogisticaApp/1.0' } });
            if (response2.ok) {
                const data2 = await response2.json();
                if (data2 && data2.length > 0) {
                    // VALIDATE CITY MATCH AGAIN
                    if (isCityMatch(data2[0], city)) {
                        console.log('[geoUtils] Fuzzy Success:', data2[0]);
                        return {
                            lat: parseFloat(data2[0].lat),
                            lng: parseFloat(data2[0].lon),
                            importance: parseFloat(data2[0].importance || '0')
                        };
                    } else {
                        console.log('[geoUtils] Fuzzy result discarded due to city mismatch.');
                    }
                } else {
                    console.log('[geoUtils] Fuzzy returned 0 results.');
                }
            }
        }

        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
};
