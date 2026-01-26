
import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabaseClient';

export const Mapa = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const { technicians, collections, fixGeocodes, updateCollection, unassignCollections, optimizeRouteForTechnician } = useData();

  const [selectedTechId, setSelectedTechId] = React.useState<string | null>(null);
  const [routeStats, setRouteStats] = React.useState<{ distance: number; duration: number } | null>(null);
  const [editCollectionId, setEditCollectionId] = React.useState<string | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Route Layer Group
  useEffect(() => {
    if (mapInstance.current && !routeLayerRef.current) {
      routeLayerRef.current = L.layerGroup().addTo(mapInstance.current);
    }
  }, [mapInstance.current]);

  // Listen for custom edit event from popup
  useEffect(() => {
    const handleEdit = (e: any) => {
      console.log('Edit Event Received:', e.detail);
      setEditCollectionId(e.detail);
    };

    const handleUnassign = (e: any) => {
      console.log('Unassign Event Received:', e.detail);
      if (confirm('Tem certeza que deseja remover esta coleta do técnico?')) {
        unassignCollections([e.detail]);
      }
    };

    window.addEventListener('editCollection', handleEdit);
    window.addEventListener('unassignCollection', handleUnassign);

    return () => {
      window.removeEventListener('editCollection', handleEdit);
      window.removeEventListener('unassignCollection', handleUnassign);
    };
  }, []);

  // Background Sync: Ensure ALL active techs have their routes calculated and saved
  useEffect(() => {
    const syncAllRoutes = async () => {
      // We only run this if we have data
      if (technicians.length === 0 || collections.length === 0) return;

      console.log("[Mapa] Starting Background Route Sync...");

      for (const tech of technicians) {
        const techCollections = collections
          .filter(c => c.driverId === tech.id && c.status !== 'Coletado' && c.status !== 'Falha')
          .sort((a, b) => ((a.sequence_order || 999) - (b.sequence_order || 999)) || a.id.localeCompare(b.id));

        if (techCollections.length === 0) continue;

        // Determine Date
        const dateCounts: Record<string, number> = {};
        techCollections.forEach(c => {
          if (c.date) dateCounts[c.date] = (dateCounts[c.date] || 0) + 1;
        });
        const bestDate = Object.keys(dateCounts).sort((a, b) => dateCounts[b] - dateCounts[a])[0] || new Date().toISOString().split('T')[0];

        // Start/End logic
        const startLat = tech.start_lat || tech.lat;
        const startLng = tech.start_lng || tech.lng;
        if (!startLat || !startLng) continue;

        const coords = [`${startLng},${startLat}`];
        techCollections.forEach(c => {
          if (c.lat && c.lng) coords.push(`${c.lng},${c.lat}`);
        });

        // Use end location if available, otherwise return to start
        const endLat = tech.end_lat || startLat;
        const endLng = tech.end_lng || startLng;
        coords.push(`${endLng},${endLat}`);

        if (coords.length < 2) continue;

        // Call OSRM (HTTPS)
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=false`;
          const response = await fetch(url);
          const json = await response.json();

          if (json.code === 'Ok' && json.routes[0]) {
            const route = json.routes[0];
            const totalDistKm = route.distance / 1000;

            // Upsert Summary
            const { error } = await supabase.from('route_summaries').upsert({
              technician_id: tech.id,
              date: bestDate,
              total_distance_km: totalDistKm,
              collection_count: techCollections.length,
              status: 'Calculated (Auto-Map)',
              geometry: route.geometry // Persist the GeoJSON if available
            }, { onConflict: 'technician_id,date' });

            if (!error) console.log(`[Mapa] Synced route for ${tech.name}: ${totalDistKm.toFixed(2)}km`);
          }
        } catch (e) {
          console.error(`[Mapa] Sync failed for ${tech.name}`, e);
        }

        // Short delay to be nice to OSRM
        await new Promise(r => setTimeout(r, 200));
      }
      console.log("[Mapa] Background Sync Complete.");
    };

    // Debounce or just run? 
    // DataContext updates often. Let's use a timeout.
    const timer = setTimeout(() => {
      syncAllRoutes();
    }, 2000);

    return () => clearTimeout(timer);

  }, [collections, technicians]); // Fixed dependency to run on updates, not just length changes

  // Handle Technician Selection & Route Display
  useEffect(() => {
    if (!selectedTechId || !mapInstance.current || !routeLayerRef.current) return;

    const tech = technicians.find(t => t.id === selectedTechId);
    if (!tech) return;

    // Clear previous route
    routeLayerRef.current.clearLayers();

    // Filter and Sort Collections
    const techCollections = collections
      .filter(c => c.driverId === tech.id && c.status !== 'Coletado' && c.status !== 'Falha')
      .sort((a, b) => ((a.sequence_order || 999) - (b.sequence_order || 999)) || a.id.localeCompare(b.id));

    if (techCollections.length === 0) return;

    // 1. Draw Stops
    techCollections.forEach((col, index) => {
      if (col.lat && col.lng) {
        const icon = L.divIcon({
          className: 'custom-number-icon',
          html: `<div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md">${index + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([col.lat, col.lng], { icon })
          .bindPopup(`
            <div class="min-w-[150px]">
                <div class="font-bold text-slate-800 border-b pb-1 mb-1 flex justify-between items-center">
                    <span>${index + 1}. ${col.client}</span>
                    <span class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">${col.status}</span>
                </div>
                <div class="text-xs text-slate-600 mb-1">
                    <span class="material-symbols-outlined text-[10px] align-middle mr-1">location_on</span>
                    ${col.neighborhood || 'Bairro indefinido'} - ${col.city || 'Cidade indefinida'}
                </div>
                <div class="text-xs text-slate-500 italic truncate max-w-[200px] mb-2">${col.address}</div>
                <div class="flex gap-1">
                  <button onclick="window.dispatchEvent(new CustomEvent('editCollection', {detail: '${col.id}'}))" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold py-1 rounded border border-slate-300 flex items-center justify-center gap-1">
                     <span class="material-symbols-outlined text-[10px]">edit</span>
                     Editar
                  </button>
                  <button onclick="window.dispatchEvent(new CustomEvent('unassignCollection', {detail: '${col.id}'}))" class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold py-1 rounded border border-red-200 flex items-center justify-center gap-1">
                     <span class="material-symbols-outlined text-[10px]">person_remove</span>
                     Remover
                  </button>
                </div>
            </div>
          `)
          .addTo(routeLayerRef.current!);
      }
    });

    // 2. Fetch and Draw Route Polyline
    const fetchRoute = async () => {
      // Use explicit start location (Home/Base) if available, otherwise current live location
      const startLat = tech.start_lat || tech.lat;
      const startLng = tech.start_lng || tech.lng;

      if (!startLat || !startLng) return;

      // Draw Start Marker (Base)
      const homeIcon = L.divIcon({
        className: 'custom-home-icon',
        html: `<div class="w-8 h-8 bg-slate-800 rounded-full border-2 border-white flex items-center justify-center text-white shadow-md"><span class="material-symbols-outlined text-sm">home</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([startLat, startLng], { icon: homeIcon })
        .bindPopup(`<div class="font-bold text-slate-800">Início</div><div class="text-xs text-slate-500">Base / Casa</div>`)
        .addTo(routeLayerRef.current!);

      const coords = [`${startLng},${startLat}`]; // Start
      techCollections.forEach(c => {
        if (c.lat && c.lng) coords.push(`${c.lng},${c.lat}`);
      });

      // Use end location if available, otherwise return to start
      const endLat = tech.end_lat || startLat;
      const endLng = tech.end_lng || startLng;
      coords.push(`${endLng},${endLat}`);

      // Draw End Marker if different from Start
      if (endLat !== startLat || endLng !== startLng) {
        const flagIcon = L.divIcon({
          className: 'custom-flag-icon',
          html: `<div class="w-8 h-8 bg-emerald-800 rounded-full border-2 border-white flex items-center justify-center text-white shadow-md"><span class="material-symbols-outlined text-sm">flag</span></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        L.marker([endLat, endLng], { icon: flagIcon })
          .bindPopup(`<div class="font-bold text-slate-800">Fim</div><div class="text-xs text-slate-500">Destino de Chegada</div>`)
          .addTo(routeLayerRef.current!);
      }

      if (coords.length < 2) return;

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.code === 'Ok' && json.routes[0]) {
          const route = json.routes[0];
          const routeGeoJSON = route.geometry;

          const serviceTimeSeconds = techCollections.length * 600; // 10 minutes * 60 seconds

          // Set Stats
          const totalDistKm = route.distance / 1000;
          setRouteStats({
            distance: route.distance, // meters
            duration: route.duration + serviceTimeSeconds  // seconds
          });

          // PERSIST TO DB
          const dateCounts: Record<string, number> = {};
          techCollections.forEach(c => {
            if (c.date) dateCounts[c.date] = (dateCounts[c.date] || 0) + 1;
          });
          const bestDate = Object.keys(dateCounts).sort((a, b) => dateCounts[b] - dateCounts[a])[0] || new Date().toISOString().split('T')[0];

          try {
            const { error } = await supabase.from('route_summaries').upsert({
              technician_id: tech.id,
              date: bestDate,
              total_distance_km: totalDistKm,
              collection_count: techCollections.length,
              status: 'Calculated (Map)'
            }, { onConflict: 'technician_id,date' });

            if (error) console.error("Failed to save map stats:", error);
            else console.log(`[Mapa] Saved route stats for ${tech.name}: ${totalDistKm.toFixed(2)}km`);
          } catch (err) {
            console.error("Error saving map stats:", err);
          }

          // Draw Polyline
          const polyline = L.geoJSON(routeGeoJSON, {
            style: { color: '#3b82f6', weight: 4, opacity: 0.7 }
          }).addTo(routeLayerRef.current!);

          // Fit bounds to show whole route
          mapInstance.current?.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        }
      } catch (e) {
        console.error("Error fetching route", e);
      }
    };

    fetchRoute();

  }, [selectedTechId, collections, technicians]);

  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      // Inicia visão do Brasil
      const map = L.map(mapRef.current).setView([-15.7797, -47.9297], 4);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstance.current = map;
      routeLayerRef.current = L.layerGroup().addTo(map);
    }

    if (mapInstance.current) {
      // Clear ONLY technician markers, preserve route layer
      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.Marker && !(layer as any)._routeMarker) { // Hacky check or specific pane would be better
          // Actually, simplest is to just manage tech markers separately if possible, 
          // but let's just clear everything NOT in our routeLayer
          if (routeLayerRef.current && !routeLayerRef.current.hasLayer(layer) && layer !== routeLayerRef.current) {
            // It's likely a base layer or a tech marker. 
            // Let's rely on the fact we re-add tech markers below.
          }
        }
      });

      // Re-add selection bounds logic logic if no selection? 
      // Simplified: Just re-render tech markers. 
      // Issue: We need to avoid clearing the route layer.
      // Better approach: Store tech markers in a layer group too.
    }

    // ... (Refactoring Map Logic to use LayerGroups for cleaner updates) ...
    // Let's stick to the existing loop but add a Tech Layer Group concept implicitly or explicitly.
    // Given the previous code cleared ALL layers `mapInstance.current.eachLayer...`, I should modify that to ONLY clear tech markers.

    // To play it safe with the existing code structure:
    // I will let the previous effect logic stand but modify user interaction.

    // WAIT, I am replacing the entire useEffect block. 
    // I will rewrite the rendering logic to be more robust.

    if (mapInstance.current) {
      // Create or get Tech Layer
      let techLayer = (window as any).techLayerGroup;
      if (!techLayer) {
        techLayer = L.layerGroup().addTo(mapInstance.current);
        (window as any).techLayerGroup = techLayer;
      } else {
        techLayer.clearLayers();
      }

      const bounds = L.latLngBounds([]);
      let activeCount = 0;

      technicians.forEach((tech) => {
        if (tech.status === 'Online' || tech.status === 'Em Rota') {
          const lat = tech.lat;
          const lng = tech.lng;

          if (lat && lng) {
            const customIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div class="relative flex items-center justify-center cursor-pointer transform transition-transform hover:scale-110">
                  <div class="absolute w-8 h-8 ${selectedTechId === tech.id ? 'bg-blue-500' : 'bg-primary/30'} rounded-full ${selectedTechId === tech.id ? 'animate-pulse' : 'animate-ping'}"></div>
                  <div class="relative w-8 h-8 rounded-full border-2 ${selectedTechId === tech.id ? 'border-blue-400' : 'border-white'} overflow-hidden shadow-lg bg-[#1e293b]">
                    <img 
                      src="${tech.avatar}" 
                      onerror="this.src='https://ui-avatars.com/api/?name=${tech.name}&background=1e293b&color=fff'" 
                      class="w-full h-full object-cover" 
                    />
                  </div>
                  <div class="absolute -bottom-1 -right-1 bg-emerald-500 w-3 h-3 rounded-full border border-[#1e293b]"></div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });

            const marker = L.marker([lat, lng], { icon: customIcon })
              .on('click', () => setSelectedTechId(tech.id)) // Select on click
              .addTo(techLayer);

            bounds.extend([lat, lng]);
            activeCount++;

            marker.bindPopup(`
              <div class="flex flex-col gap-1 min-w-[150px]">
                <strong class="text-white text-sm">${tech.name}</strong>
                <span class="text-xs text-emerald-400 font-bold">${tech.status}</span>
                <button onclick="window.dispatchEvent(new CustomEvent('selectTech', {detail: '${tech.id}'}))" class="mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-500">Ver Rota</button>
              </div>
            `);
          }
        }
      });

      // Only fit bounds if NO technician is selected (overall view)
      if (activeCount > 0 && !selectedTechId) {
        mapInstance.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 12 });
      }
    }

    return () => {
      // Cleanup if needed
    }
  }, [technicians, selectedTechId]); // Added selectedTechId dependency to re-render markers highlighted

  // Format helpers
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  };

  return (
    <div className="flex bg-[#0f172a] h-screen overflow-hidden">
      {/* Sidebar de Técnicos */}
      <div className="w-[300px] border-r border-[#1f2d3d] h-full flex flex-col z-10 bg-[#0f172a]">
        <div className="p-4 border-b border-[#1f2d3d]">
          <h2 className="text-white font-bold text-lg mb-1">Operação em Tempo Real</h2>
          <p className="text-slate-400 text-xs">Monitoramento de frota e rotas ativas</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <tbody className="divide-y divide-[#1f2d3d]">
              {technicians.map(tech => (
                <TechListItem
                  key={tech.id}
                  name={tech.name}
                  // Show summary if selected
                  route={selectedTechId === tech.id && routeStats
                    ? `${formatDistance(routeStats.distance)} • ${formatDuration(routeStats.duration)}`
                    : tech.status}
                  status={tech.status}
                  statusColor={
                    tech.status === 'Online' ? 'text-green-400 bg-green-400/10' :
                      tech.status === 'Em Rota' ? 'text-blue-400 bg-blue-400/10' :
                        'text-slate-400 bg-slate-400/10'
                  }
                  img={tech.avatar}
                  battery={tech.battery_level}
                  active={selectedTechId === tech.id}
                  onClick={() => setSelectedTechId(selectedTechId === tech.id ? null : tech.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1f2d3d] bg-[#0f172a]">
          <button
            onClick={() => {
              if (confirm('Isso vai verificar o endereço de TODAS as paradas no OpenStreetMap. Pode demorar alguns minutos. Continuar?')) {
                fixGeocodes();
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-4 rounded transition-colors border border-slate-700"
          >
            <span className="material-symbols-outlined text-sm">satellite_alt</span>
            Corrigir GPS (OpenStreetMap)
          </button>
        </div>
      </div>

      {/* Área do Mapa */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full bg-[#1e293b]" />

        {/* Floating Route Stats Card */}
        {selectedTechId && routeStats && (
          <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-2xl z-[1000] w-64 animate-fade-in-up">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">route</span>
              Resumo da Rota
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Distância</p>
                <p className="text-white text-xl font-mono">{formatDistance(routeStats.distance)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Tempo Est.</p>
                <p className="text-white text-xl font-mono">{formatDuration(routeStats.duration)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center text-xs">
              <span className="text-slate-400">Paradas/Entregas:</span>
              <span className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded-md">
                {collections.filter(c => c.driverId === selectedTechId && c.status !== 'Coletado' && c.status !== 'Falha').length}
              </span>
            </div>

            <button
              onClick={async () => {
                const today = new Date().toISOString().split('T')[0];
                if (optimizeRouteForTechnician) {
                  await optimizeRouteForTechnician(selectedTechId, today);
                }
              }}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
            >
              <span className="material-symbols-outlined text-sm">magic_button</span>
              Otimizar Menor KM
            </button>
          </div>
        )}

        {/* Legenda Flutuante */}
        <div className="absolute bottom-6 left-6 z-[1000]">
          <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-slate-300 text-xs">Rota Ativa</span>
            </div>
            <div className="flex items-center gap-2 gap-x-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-slate-300 text-xs">Online</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="material-symbols-outlined text-xs text-white">home</span>
              <span className="text-slate-300 text-xs">Base / Início</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editCollectionId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-[#1e293b] w-full max-w-md rounded-xl border border-slate-700 shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">edit_location</span>
                Editar Coleta
              </h3>
              <button onClick={() => setEditCollectionId(null)} className="text-slate-400 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Find collection */}
              {(() => {
                const col = collections.find(c => c.id === editCollectionId);
                if (!col) return <p className="text-red-400">Coleta não encontrada.</p>;

                return (
                  <>
                    <div>
                      <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Cliente</label>
                      <input
                        type="text"
                        defaultValue={col.client}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                        id="edit_client"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Cidade</label>
                        <input
                          type="text"
                          defaultValue={col.city || ''}
                          className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                          id="edit_city"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Estado</label>
                        <input
                          type="text"
                          defaultValue={col.state || ''}
                          className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                          id="edit_state"
                          maxLength={2}
                          placeholder="UF"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Bairro</label>
                        <input
                          type="text"
                          defaultValue={col.neighborhood || ''}
                          className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                          id="edit_neighborhood"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Endereço (Rua e Número)</label>
                      <input
                        type="text"
                        defaultValue={col.address}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                        id="edit_address"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Complemento</label>
                        <input
                          type="text"
                          defaultValue={col.complement || ''}
                          className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                          id="edit_complement"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Equipamento</label>
                        <input
                          type="text"
                          defaultValue={col.equipment_code || ''}
                          className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                          id="edit_equipment"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Observações</label>
                      <textarea
                        defaultValue={col.notes || ''}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors min-h-[80px]"
                        id="edit_notes"
                      />
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={async () => {
                          const client = (document.getElementById('edit_client') as HTMLInputElement).value;
                          const address = (document.getElementById('edit_address') as HTMLInputElement).value;
                          const city = (document.getElementById('edit_city') as HTMLInputElement).value;
                          const state = (document.getElementById('edit_state') as HTMLInputElement).value;
                          const neighborhood = (document.getElementById('edit_neighborhood') as HTMLInputElement).value;
                          const complement = (document.getElementById('edit_complement') as HTMLInputElement).value;
                          const equipment = (document.getElementById('edit_equipment') as HTMLInputElement).value;
                          const notes = (document.getElementById('edit_notes') as HTMLTextAreaElement).value;

                          if (updateCollection) {
                            await updateCollection(editCollectionId, {
                              client,
                              address,
                              city,
                              state,
                              neighborhood,
                              complement,
                              equipment_code: equipment,
                              notes
                            });
                            setEditCollectionId(null);
                          } else {
                            alert("Função de atualização não disponível no momento.");
                          }
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition-colors"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TechListItem = ({ name, route, status, statusColor, img, battery, onClick, active }: any) => (
  <tr
    onClick={onClick}
    className={`cursor-pointer transition-colors group ${active ? 'bg-blue-500/20' : 'hover:bg-[#1f2d3d]'}`}
  >
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`relative size-8 rounded-full overflow-hidden ${active ? 'ring-2 ring-blue-500' : 'bg-slate-700'}`}>
          <img alt={name} className="w-full h-full object-cover" src={img} />
        </div>
        <div>
          <p className="text-white text-sm font-medium">{name}</p>
          <p className="text-slate-400 text-xs">{route}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-3 text-right">
      <div className="flex flex-col items-end gap-1">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ring-opacity-20 ${statusColor}`}>
          {status}
        </span>
        {battery !== undefined && battery !== -1 && (
          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[10px]">battery_std</span>
            {battery}%
          </span>
        )}
      </div>
    </td>
  </tr>
);
