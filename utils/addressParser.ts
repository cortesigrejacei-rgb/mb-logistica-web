/**
 * Utility to parse Brazilian address strings into components (Street, Neighborhood, City, State)
 * Expected formats:
 * - "Rua X, 123, Bairro Y, Cidade Z - UF"
 * - "Rua X, 123 - Bairro Y - Cidade Z"
 */

export interface AddressComponents {
    street: string;
    number?: string;
    neighborhood: string;
    city: string;
    state?: string;
    fullAddress: string;
}

export const parseAddress = (address: string): AddressComponents => {
    const cleanAddress = address.trim();

    // Default fallback
    const components: AddressComponents = {
        street: cleanAddress,
        neighborhood: 'Desconhecido',
        city: 'Desconhecida',
        fullAddress: cleanAddress
    };

    try {
        // Strategy 1: Split by commas (common in Google Maps / formal data)
        // Ex: "Rua 15 de Novembro, 100, Centro, Blumenau - SC"
        const partsByComma = cleanAddress.split(',').map(p => p.trim());

        if (partsByComma.length >= 3) {
            components.street = partsByComma[0];
            components.number = partsByComma[1];

            // Try to find city/state in the last part
            const lastPart = partsByComma[partsByComma.length - 1]; // "Blumenau - SC" or "Blumenau"
            const cityState = lastPart.split('-').map(p => p.trim());

            if (cityState.length > 1) {
                components.city = cityState[0];
                components.state = cityState[1];
            } else {
                components.city = lastPart;
            }

            // Middle parts are usually neighborhood
            if (partsByComma.length >= 4) {
                components.neighborhood = partsByComma[2];
            }

            return components;
        }

        // Strategy 2: Split by hyphen (common in informal input)
        // Ex: "Rua X - Bairro Y - Cidade Z"
        const partsByDash = cleanAddress.split('-').map(p => p.trim());
        if (partsByDash.length >= 3) {
            // Assuming: Street - Neighborhood - City
            components.street = partsByDash[0];
            components.neighborhood = partsByDash[1];
            components.city = partsByDash[2];
            return components;
        }

    } catch (e) {
        console.error("Error parsing address:", address, e);
    }

    return components;
};

/**
 * Normalizes city names to ensure grouping works (e.g., "Blumenau " -> "Blumenau")
 */
export const normalizeCity = (city: string) => {
    return city.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Normalizes neighborhood names
 */
export const normalizeNeighborhood = (neighborhood: string) => {
    return neighborhood.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
