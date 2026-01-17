
interface GeoPoint {
    lat: number;
    lng: number;
    originalIndex?: number; // Used internally for tracking
}

interface RouteResult {
    totalDistanceKm: number;
    totalDurationSeconds: number;
    geometry: string;
    optimizedOrder?: number[];
}

const OSRM_BASE_URL = 'http://router.project-osrm.org/trip/v1/driving';
const MAX_BATCH_SIZE = 23;

// Helper: Calculate Haversine distance for greedy sort (client-side approx)
function getDist(p1: GeoPoint, p2: GeoPoint) {
    const R = 6371; // km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const calculateOptimalRoute = async (
    startPoint: GeoPoint,
    stops: GeoPoint[],
    endPoint?: GeoPoint
): Promise<RouteResult> => {
    if (stops.length === 0) {
        return { totalDistanceKm: 0, totalDurationSeconds: 0, geometry: '' };
    }

    // 1. PRE-SORT (Greedy Nearest Neighbor)
    // This groups geographically close stops together before batching, preventing
    // the system from batching a point in City A with a point in City B.
    const sortedStops: GeoPoint[] = [];
    const originalStyleStops = stops.map((s, i) => ({ ...s, originalIndex: i }));
    const remaining = [...originalStyleStops];
    let current = startPoint;

    // Map to keep track of sorted index -> original index
    // We don't strictly need a separate array if we keep originalIndex on the object
    // but the object is clean in the chunk call.

    while (remaining.length > 0) {
        let nearestIdx = -1;
        let minDist = Infinity;

        // Optimization: For very large lists (>500), this O(N^2) might be slowish, but for <200 it's <1ms.
        for (let i = 0; i < remaining.length; i++) {
            const d = getDist(current, remaining[i]);
            if (d < minDist) {
                minDist = d;
                nearestIdx = i;
            }
        }

        const nextStop = remaining[nearestIdx];
        sortedStops.push(nextStop);
        current = nextStop;
        remaining.splice(nearestIdx, 1);
    }

    // 2. BATCHING and OPTIMIZATION
    let totalDist = 0;
    let totalDur = 0;
    let combinedGeometry = '';
    const finalOptimizedOrder: number[] = [];
    let batchStartPoint = startPoint;

    console.log(`[RouteOptimizer] Optimizing ${stops.length} stops in ${Math.ceil(stops.length / MAX_BATCH_SIZE)} batches...`);

    for (let i = 0; i < sortedStops.length; i += MAX_BATCH_SIZE) {
        const chunk = sortedStops.slice(i, i + MAX_BATCH_SIZE);
        const isLastBatch = i + MAX_BATCH_SIZE >= sortedStops.length;
        const batchEndPoint = isLastBatch ? endPoint : undefined;

        console.log(`[RouteOptimizer] Processing Batch ${i / MAX_BATCH_SIZE + 1}, Start: ${batchStartPoint.lat},${batchStartPoint.lng}`);

        // Perform OSRM Request
        const result = await callOSRM(batchStartPoint, chunk, batchEndPoint);

        if (result) {
            totalDist += result.totalDistanceKm;
            totalDur += result.totalDurationSeconds;
            // Only keep first geometry for visual sanity or TODO: Implement polyline merge
            if (!combinedGeometry) combinedGeometry = result.geometry;

            if (result.optimizedOrder) {
                // result.optimizedOrder contains indices local to the 'chunk' array (0..chunkLen-1)
                result.optimizedOrder.forEach(localBatchIndex => {
                    const stopObj = chunk[localBatchIndex];
                    if (stopObj.originalIndex !== undefined) {
                        finalOptimizedOrder.push(stopObj.originalIndex);
                    }
                });
            }

            // Update start for next batch to be the last visited point in this batch
            if (result.optimizedOrder && result.optimizedOrder.length > 0) {
                const lastIdxInChunk = result.optimizedOrder[result.optimizedOrder.length - 1];
                batchStartPoint = chunk[lastIdxInChunk];
            } else if (chunk.length > 0) {
                // Fallback (shouldn't happen on success)
                batchStartPoint = chunk[chunk.length - 1];
            }
        } else {
            console.error('[RouteOptimizer] Batch failed, skipping entries.');
        }
    }

    return {
        totalDistanceKm: totalDist,
        totalDurationSeconds: totalDur,
        geometry: combinedGeometry,
        optimizedOrder: finalOptimizedOrder
    };
};

// Helper for Sequential Route (Fixed Order)
export const calculateSequentialRoute = async (
    startPoint: GeoPoint,
    stops: GeoPoint[],
    endPoint?: GeoPoint
): Promise<RouteResult> => {
    if (stops.length === 0) return { totalDistanceKm: 0, totalDurationSeconds: 0, geometry: '' };

    // Break into chunks to avoid URL limits, but maintain STRICT A->B->C order
    const allPoints = [startPoint, ...stops];
    if (endPoint) allPoints.push(endPoint);

    let totalDist = 0;
    let totalDur = 0;

    // Process in sliding windows / batches
    // OSRM Route service handles ~50-100 coordinates easily. MAX_BATCH_SIZE is 23 (safe).
    // We need to overlap batches: [0..22], then [22..44] so 22 is visited.

    for (let i = 0; i < allPoints.length - 1; i += (MAX_BATCH_SIZE - 1)) {
        // Take a chunk of size MAX_BATCH_SIZE
        const chunk = allPoints.slice(i, i + MAX_BATCH_SIZE);

        if (chunk.length < 2) break; // Should not happen if logic correct

        const result = await callOSRMRoute(chunk);

        if (result) {
            totalDist += result.totalDistanceKm;
            totalDur += result.totalDurationSeconds;
        } else {
            // Fallback: Linear distance if API fails
            console.warn('[Sequential] OSRM Failed for chunk, using fallback.');
            for (let j = 0; j < chunk.length - 1; j++) {
                totalDist += getDist(chunk[j], chunk[j + 1]);
            }
        }
    }

    return {
        totalDistanceKm: totalDist,
        totalDurationSeconds: totalDur,
        geometry: '', // TODO: Merging geometries is complex, skipping for Summary purpose
        optimizedOrder: stops.map((_, i) => i) // Order preserved
    };
};

// Internal Helper for OSRM /route Call
async function callOSRMRoute(points: GeoPoint[]): Promise<RouteResult | null> {
    const coordString = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_BASE_URL.replace('/trip/', '/route/')}/${coordString}?overview=false`; // explicit route service

    try {
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (data.code !== 'Ok') return null;

        const route = data.routes[0];
        return {
            totalDistanceKm: route.distance / 1000,
            totalDurationSeconds: route.duration,
            geometry: '',
            optimizedOrder: []
        };
    } catch (e) {
        console.error("OSRM Route Exception:", e);
        return null;
    }
}

// Internal Helper for OSRM Call (Trip Optimization)
async function callOSRM(start: GeoPoint, stops: GeoPoint[], end?: GeoPoint): Promise<RouteResult | null> {
    const coords = [start, ...stops];
    if (end) coords.push(end);

    // OSRM expects: /trip/v1/driving/lon,lat;lon,lat;...?source=first[&destination=last]...
    const coordString = coords.map(p => `${p.lng},${p.lat}`).join(';');

    let options = 'source=first&roundtrip=false&overview=simplified&geometries=polyline';
    if (end) options += '&destination=last';

    const url = `${OSRM_BASE_URL}/${coordString}?${options}`;

    try {
        const res = await fetch(url);

        if (res.status === 400) {
            console.error("OSRM 400 Error. URL likely too long still.");
            return null;
        }

        const data = await res.json();
        if (data.code !== 'Ok') {
            console.error(`OSRM API Error: ${data.code}`);
            return null;
        }

        const trip = data.trips[0];
        const waypoints = data.waypoints; // Sorted by visit order

        // Map waypoints back to 'stops' array indices
        // waypoints[i].waypoint_index corresponds to index in 'coords' array
        // coords = [Start, Stop0, Stop1, ..., End?]
        // So waypoint_index 0 is Start.
        // waypoint_index 1 is Stop0...

        const localOrder: number[] = [];
        if (waypoints) {
            waypoints.forEach((wp: any) => {
                const idx = wp.waypoint_index;
                // We only care about stops indices (which start at 1 and go up to stops.length)
                if (idx > 0 && idx <= stops.length) {
                    localOrder.push(idx - 1); // 0-based index relative to 'stops'
                }
            });
        }

        return {
            totalDistanceKm: trip.distance / 1000,
            totalDurationSeconds: trip.duration,
            geometry: trip.geometry,
            optimizedOrder: localOrder
        };

    } catch (e) {
        console.error("OSRM Request Exception:", e);
        return null;
    }
}
