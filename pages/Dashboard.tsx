
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { NavLink, useNavigate } from 'react-router-dom';
import * as L from 'leaflet';

export const Dashboard = () => {
  const { user } = useAuth();
  const { technicians, collections, stockItems } = useData();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  // Initialize Mini Map
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true, // Enable dragging for better view
        scrollWheelZoom: true, // Enable zoom
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false
      }).setView([-25.4297, -49.2719], 11);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstance.current = map;
    }

    // Update Markers & Routes Realtime
    if (mapInstance.current) {
      // Clear existing layers
      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
          mapInstance.current?.removeLayer(layer);
        }
      });

      const bounds = L.latLngBounds([]);
      let hasPoints = false;

      // 1. Draw Technicians
      technicians.forEach((t, index) => {
        if (t.status === 'Online' || t.status === 'Em Rota') {
          const lat = t.lat || -25.4297;
          const lng = t.lng || -49.2719;

          // Unique color per tech for routes
          const techColor = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5];

          // Tech Marker
          const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `
                      <div class="relative flex items-center justify-center">
                        <div class="absolute w-8 h-8 bg-${t.status === 'Em Rota' ? 'green' : 'blue'}-500/20 rounded-full animate-ping"></div>
                        <div class="relative w-6 h-6 rounded-full border-2 border-white shadow-lg overflow-hidden">
                            <img src="${t.avatar}" class="w-full h-full object-cover" />
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-${t.status === 'Online' ? 'emerald' : 'amber'}-500 rounded-full border border-white"></div>
                      </div>
                    `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          L.marker([lat, lng], { icon: customIcon }).addTo(mapInstance.current!)
            .bindTooltip(t.name, { direction: 'top', offset: [0, -10], className: 'bg-slate-800 text-white border-0 px-2 py-1 rounded text-xs' });

          bounds.extend([lat, lng]);
          hasPoints = true;

          // 2. Draw Routes (Flight Path - Round Trip)
          // Using Active Collections logic
          const techRoute = collections
            .filter(c => c.driverId === t.id && (c.status === 'Pendente' || c.status === 'Em Rota') && (c.date === new Date().toISOString().split('T')[0] || c.status !== 'Coletado'))
            .sort((a, b) => (a.sequence_order || 999) - (b.sequence_order || 999));

          if (techRoute.length > 0) {
            const startLat = t.start_lat || t.lat || -25.4297;
            const startLng = t.start_lng || t.lng || -49.2719;
            const endLat = t.end_lat || startLat;
            const endLng = t.end_lng || startLng;

            const routePoints: L.LatLngExpression[] = [[startLat, startLng]];

            techRoute.forEach(c => {
              if (c.lat && c.lng) {
                routePoints.push([c.lat, c.lng]);
                bounds.extend([c.lat, c.lng]);
              }
            });

            // Return to end location (Home or specific end base)
            routePoints.push([endLat, endLng]);
            bounds.extend([startLat, startLng]);
            bounds.extend([endLat, endLng]);

            // Draw Line
            if (routePoints.length > 1) {
              L.polyline(routePoints, {
                color: techColor,
                weight: 2,
                opacity: 0.6,
                dashArray: '5, 10'
              }).addTo(mapInstance.current!);
            }
          }
        }
      });

      // 3. Draw Collections (All for Today)
      const today = new Date().toISOString().split('T')[0];
      const todaysCollections = collections.filter(c => c.date === today);

      todaysCollections.forEach(c => {
        if (c.lat && c.lng) {
          const color = c.status === 'Coletado' ? '#10b981' : c.status === 'Falha' ? '#ef4444' : c.status === 'Em Rota' ? '#3b82f6' : '#f59e0b';

          L.circleMarker([c.lat, c.lng], {
            radius: 4,
            fillColor: color,
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(mapInstance.current!)
            .bindPopup(`
                    <div class="text-xs font-bold text-slate-800">${c.client}</div>
                    <div class="text-[10px] text-slate-500">${c.status}</div>
                 `);

          bounds.extend([c.lat, c.lng]);
          hasPoints = true;
        }
      });

      if (hasPoints) {
        mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [technicians, collections]);

  // Calculations for Real Data
  const onlineTechs = technicians.filter(t => t.status === 'Online' || t.status === 'Em Rota').length;
  const totalTechs = technicians.length;
  const today = new Date().toISOString().split('T')[0];
  const collectionsToday = collections.filter(c => c.date === today).length;
  const pendingCollections = collections.filter(c => c.status === 'Pendente').length;
  const stockCount = stockItems.length;
  const stockCritical = stockItems.filter(i => i.status === 'Novo').length < 5;
  const firstName = String(user?.user_metadata?.name || user?.email || 'Usuário').split(' ')[0].split('@')[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 md:px-8 md:py-6 bg-surface-light dark:bg-[#111822]/50 sticky top-0 z-10 backdrop-blur-md border-b border-border-dark">
        <div className="flex flex-col">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-[#111418] dark:text-white">
            Bom dia, {firstName}
          </h2>
          <p className="text-text-secondary text-sm font-medium">Operação ativa em Curitiba (PR)</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <NavLink to="/coletas" className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">add</span> Nova Coleta
          </NavLink>
        </div>
      </header>

      <div className="p-6 md:px-8 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="TÉCNICOS ONLINE" value={`${onlineTechs} / ${totalTechs}`} icon="badge" color="text-primary" bg="bg-primary/10" footer="Equipe em Curitiba" footerColor="text-[#0bda5e]" onClick={() => navigate('/mapa')} />
          <KpiCard title="COLETAS HOJE" value={collectionsToday.toString()} icon="check_circle" color="text-green-500" bg="bg-green-500/10" footer={`${pendingCollections} pendentes`} footerColor="text-orange-400" onClick={() => navigate('/coletas')} />
          <KpiCard title="ESTOQUE TOTAL" value={stockCount.toString()} icon="router" color="text-orange-500" bg="bg-orange-500/10" footer={stockCritical ? "Estoque Baixo!" : "Operacional"} footerColor={stockCritical ? "text-red-500" : "text-[#0bda5e]"} onClick={() => navigate('/estoque')} />
          <KpiCard title="PENDÊNCIAS" value={pendingCollections.toString()} icon="pending_actions" color="text-purple-500" bg="bg-purple-500/10" footer="Aguardando ação" footerColor="text-text-secondary" onClick={() => navigate('/coletas')} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark border border-border-dark overflow-hidden shadow-sm h-[400px]">
            <div className="flex items-center justify-between p-4 border-b border-border-dark">
              <h3 className="text-lg font-bold text-[#111418] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">location_on</span> Visão Curitiba (PR)
              </h3>
            </div>
            <div className="flex-1 relative bg-[#18212d] w-full h-full group">
              <div ref={mapRef} className="w-full h-full z-0"></div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark border border-border-dark shadow-sm flex-1">
              <div className="p-4 border-b border-border-dark flex justify-between items-center">
                <h3 className="text-lg font-bold text-[#111418] dark:text-white">Alertas Operacionais</h3>
              </div>
              <div className="flex flex-col p-2 overflow-y-auto">
                <AlertItem icon="cloud_sync" color="text-emerald-500" title="GPS Estável" desc="Conexão CWB-1 via Supabase OK." />
                <AlertItem icon="router" color="text-orange-500" title="Estoque Carro #04" desc="Técnico solicitou reposição." />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon, color, bg, footer, footerColor, onClick }: any) => (
  <div onClick={onClick} className="flex flex-col justify-between gap-4 p-5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-dark shadow-sm hover:shadow-md transition-all cursor-pointer hover:bg-[#233348]/50">
    <div className="flex justify-between items-start">
      <div className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-bold text-[#111418] dark:text-white">{value}</h3>
      </div>
      <div className={`p-2 ${bg} rounded-lg ${color}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <p className={`${footerColor} text-xs font-bold`}>{footer}</p>
    </div>
  </div>
);

const AlertItem = ({ icon, color, title, desc }: any) => (
  <div className="flex gap-3 p-3 hover:bg-[#f0f2f5] dark:hover:bg-[#233348] rounded-lg cursor-pointer transition-colors group">
    <div className={`flex-shrink-0 mt-1 ${color}`}>
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <div className="flex flex-col">
      <p className="text-sm font-semibold text-[#111418] dark:text-white group-hover:text-primary transition-colors">{title}</p>
      <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
    </div>
  </div>
);
