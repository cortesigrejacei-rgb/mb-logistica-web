import { Collection, Technician } from '../context/DataContext';
import { parseAddress, normalizeCity, normalizeNeighborhood } from './addressParser';

export interface TechAssignment {
    technicianId: string;
    city: string; // The city this technician is assigned to for this run
}

interface DistributionResult {
    collectionId: string;
    technicianId: string;
}

export const smartDistribute = (
    collections: Collection[],
    technicians: Technician[],
    assignments: TechAssignment[] = []
): DistributionResult[] => {
    const result: DistributionResult[] = [];
    const pending = collections.filter(c => c.status === 'Pendente');
    const availableTechs = technicians.filter(t => t.status !== 'Inativo');

    if (pending.length === 0 || availableTechs.length === 0) return [];

    // 0. Separate Pre-assigned vs Unassigned
    const preAssigned = pending.filter(c => c.driverId && availableTechs.some(t => t.id === c.driverId));
    const unassigned = pending.filter(c => !c.driverId || !availableTechs.some(t => t.id === c.driverId));

    // Add pre-assigned immediately to result (so they get status updates if needed)
    preAssigned.forEach(c => {
        result.push({
            collectionId: c.id,
            technicianId: c.driverId
        });
    });

    if (unassigned.length === 0) return result;

    // 1. Prepare Data (only for unassigned)
    const collectionsWithLoc = unassigned.map(c => ({
        ...c,
        parsed: parseAddress(c.address)
    }));

    // Map assignments for quick lookup
    const techCityMap = new Map<string, string>();
    assignments.forEach(a => techCityMap.set(a.technicianId, normalizeCity(a.city)));

    // INFER CITY FROM PRE-ASSIGNED:
    // If a tech already has collections in the sheet, lock them to that city/area.
    // This prevents them from being treated as "Floaters" for other distant cities.
    const techPreAssignedCities: Record<string, Record<string, number>> = {};

    preAssigned.forEach(c => {
        if (!c.driverId) return;
        const city = normalizeCity(parseAddress(c.address).city);
        if (!techPreAssignedCities[c.driverId]) techPreAssignedCities[c.driverId] = {};
        techPreAssignedCities[c.driverId][city] = (techPreAssignedCities[c.driverId][city] || 0) + 1;
    });

    Object.keys(techPreAssignedCities).forEach(techId => {
        if (techCityMap.has(techId)) return; // Explicit override wins

        // Find dominant city
        const cities = techPreAssignedCities[techId];
        const dominantCity = Object.keys(cities).reduce((a, b) => cities[a] > cities[b] ? a : b);

        techCityMap.set(techId, dominantCity);
    });

    // 2. Group Collections by City
    const cityGroups: Record<string, typeof collectionsWithLoc> = {};

    collectionsWithLoc.forEach(c => {
        const city = normalizeCity(c.parsed.city);
        if (!cityGroups[city]) cityGroups[city] = [];
        cityGroups[city].push(c);
    });

    // 3. Process each City
    const processedCollectionIds = new Set<string>();

    Object.keys(cityGroups).forEach(city => {
        const cityCollections = cityGroups[city];

        // Find techs assigned to this city (Dynamically assigned OR static zone fallback)
        const cityTechs = availableTechs.filter(t => {
            const dynamicCity = techCityMap.get(t.id);
            if (dynamicCity) return dynamicCity === city;
            // Fallback to static zone if no dynamic assignment
            return t.zone && normalizeCity(t.zone) === city;
        });

        if (cityTechs.length > 0) {
            // We have specific techs for this city. Distribute by Contiguous Neighborhood Clusters.
            distributeGeographically(cityCollections, cityTechs, result);
            cityCollections.forEach(c => processedCollectionIds.add(c.id));
        }
    });

    // 4. Handle Leftovers (Collections in cities with no specific tech)
    // Distribute to techs who have NO specific assignment (Floaters)
    // AND include Zoned techs if they have very few assignments compared to floaters (Load Balancing)
    let floaters = availableTechs.filter(t => !techCityMap.has(t.id));

    if (floaters.length > 0) {
        const leftovers = collectionsWithLoc.filter(c => !processedCollectionIds.has(c.id));
        if (leftovers.length > 0) {
            distributeGeographically(leftovers, floaters, result);
        }
    }

    return result;
};

// Helper: Distribute to techs splitting neighborhoods into contiguous chunks (City > Neighborhood sort)
const distributeGeographically = (
    collections: any[],
    techs: any[],
    result: DistributionResult[]
) => {
    // Group by City + Neighborhood to ensure local clustering
    const locationGroups: Record<string, any[]> = {};
    collections.forEach(c => {
        const key = `${normalizeCity(c.parsed.city)}_${normalizeNeighborhood(c.parsed.neighborhood)}`;
        if (!locationGroups[key]) locationGroups[key] = [];
        locationGroups[key].push(c);
    });

    // Sort locations alphabetically (City A - Hood A, City A - Hood B, City B...)
    const sortedLocations = Object.keys(locationGroups).sort();

    if (sortedLocations.length === 0) return;

    // BAD CASE HANDLING REMOVED: We prefer to leave a tech idle rather than scattering 1 city across 3 techs.
    // The chunk logic below handles "less locations than techs" naturally (some get []).

    // Normal Case: Split locations into chunks
    const chunkSize = Math.ceil(sortedLocations.length / techs.length);

    techs.forEach((tech: any, i: number) => {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const myLocations = sortedLocations.slice(start, end);

        myLocations.forEach(loc => {
            locationGroups[loc].forEach(c => {
                result.push({ collectionId: c.id, technicianId: tech.id });
            });
        });
    });
};
