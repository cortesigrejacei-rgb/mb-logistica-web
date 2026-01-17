
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { MobileSidebar } from '../../components/MobileSidebar';
import * as L from 'leaflet';

export const MobileRoteiro = () => {
  const { currentTechnician, collections, loading, showToast } = useData();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista');
  const [tasks, setTasks] = useState(collections);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  // Filtra tarefas pendentes deste técnico
  const myTasks = tasks.filter(c => 
    c.driverId === currentTechnician?.id && 
    (c.status === 'Pendente' || c.status === 'Em Rota')
  );

  useEffect(() => {
    setTasks(collections);
  }, [collections]);

  // Inicializa o mapa Dinâmico
  useEffect(() => {
    if (viewMode === 'mapa' && mapRef.current && !mapInstance.current) {
      // Começa com zoom global, o fitBounds cuidará do resto
      const map = L.map(mapRef.current, { zoomControl: false }).setView([-15.7797, -47.9297], 4);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
      mapInstance.current = map;

      const bounds = L.latLngBounds([]);
      let markersAdded = 0;

      myTasks.forEach((task, idx) => {
        if (task.lat && task.lng) {
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="size-8 bg-primary text-white rounded-full flex items-center justify-center font-bold border-2 border-white shadow-lg">${idx + 1}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          L.marker([task.lat, task.lng], { icon }).addTo(map).bindPopup(`<b>${task.client}</b><br>${task.address}`);
          bounds.extend([task.lat, task.lng]);
          markersAdded++;
        }
      });

      // Inclui a posição atual do técnico no mapa se existir
      if (currentTechnician?.lat && currentTechnician?.lng) {
          const userIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="size-4 bg-emerald-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          L.marker([currentTechnician.lat, currentTechnician.lng], { icon: userIcon }).addTo(map);
          bounds.extend([currentTechnician.lat, currentTechnician.lng]);
          markersAdded++;
      }

      if (markersAdded > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [viewMode, myTasks.length, currentTechnician?.lat, currentTechnician?.lng]);

  const handleOptimize = () => {
    showToast('Otimizando rota por proximidade...', 'info');
    const optimized = [...myTasks].sort((a, b) => a.client.localeCompare(b.client));
    setTimeout(() => {
      setTasks(prev => [...optimized, ...prev.filter(p => !optimized.find(o => o.id === p.id))]);
      showToast('Rota otimizada com sucesso!', 'success');
    }, 1000);
  };

  const nextTask = myTasks[0];
  const remainingTasks = myTasks.slice(1);

  if (loading || !currentTechnician) return (
    <div className="flex h-screen items-center justify-center bg-[#111822]">
       <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#111822] text-white font-display overflow-hidden">
      <MobileSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-[#111822] z-30">
        <button onClick={() => setIsMenuOpen(true)}>
          <span className="material-symbols-outlined text-white">menu</span>
        </button>
        <h1 className="text-base font-black uppercase tracking-[2px]">Roteiro de Coleta</h1>
        <div className="size-8 rounded-full overflow-hidden border border-slate-700">
           <img src={currentTechnician.avatar} alt="User" className="w-full h-full object-cover" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-32 scrollbar-hide space-y-6">
        
        {/* Toggle Lista / Mapa */}
        <div className="bg-[#192433] p-1 rounded-xl flex">
           <button 
             onClick={() => setViewMode('lista')}
             className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'lista' ? 'bg-[#233348] text-white shadow-lg' : 'text-slate-500'}`}
           >
              <span className="material-symbols-outlined text-sm">list</span> Lista
           </button>
           <button 
             onClick={() => setViewMode('mapa')}
             className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'mapa' ? 'bg-[#233348] text-white shadow-lg' : 'text-slate-500'}`}
           >
              <span className="material-symbols-outlined text-sm">map</span> Mapa
           </button>
        </div>

        {viewMode === 'mapa' ? (
          <div className="h-[60vh] rounded-[32px] overflow-hidden border border-[#233348] relative">
            <div ref={mapRef} className="w-full h-full z-0"></div>
            <div className="absolute bottom-4 left-4 right-4 bg-[#192433]/90 backdrop-blur-md p-4 rounded-2xl border border-[#233348] z-10">
               <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Status da Operação</p>
               <p className="text-white text-xs font-bold">Mapa dinâmico baseado na sua rota atual.</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-[#192433] rounded-2xl p-4 border border-[#233348] flex flex-col items-center justify-center shadow-lg">
                  <p className="text-2xl font-black text-white">{myTasks.length}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                     <span className="material-symbols-outlined text-[16px] text-primary">shopping_bag</span>
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pendentes</span>
                  </div>
               </div>
               <div className="bg-[#192433] rounded-2xl p-4 border border-[#233348] flex flex-col items-center justify-center shadow-lg">
                  <p className="text-2xl font-black text-white">Ativa</p>
                  <div className="flex items-center gap-1.5 mt-1">
                     <span className="material-symbols-outlined text-[16px] text-emerald-500">near_me</span>
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Localização</span>
                  </div>
               </div>
            </div>

            <button 
               onClick={handleOptimize}
               className="w-full bg-primary h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest shadow-[0_10px_25px_rgba(19,109,236,0.3)] active:scale-[0.98] transition-all"
            >
               <span className="material-symbols-outlined">magic_button</span>
               Otimizar Rota
            </button>

            {/* Próxima Parada */}
            <div className="space-y-3">
               <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[2px] px-1">Próxima Parada</h3>
               {nextTask ? (
                  <div className="bg-[#1e293b] rounded-[32px] border-l-[6px] border-primary p-6 shadow-2xl space-y-5 animate-slideUp">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                           <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-lg shadow-inner">1</div>
                           <div>
                              <h4 className="text-xl font-black text-white tracking-tight">{nextTask.client}</h4>
                              <div className="bg-[#233348] rounded-full px-3 py-1 mt-1 inline-flex items-center gap-2">
                                 <span className="material-symbols-outlined text-[14px] text-primary fill">router</span>
                                 <span className="text-[10px] font-black text-slate-300">Equipamento Pendente</span>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-slate-500 text-[18px]">location_on</span>
                        <p className="text-slate-400 text-xs font-bold leading-tight">
                           {nextTask.address}
                        </p>
                     </div>

                     <div className="flex gap-3">
                        <button 
                          onClick={() => navigate(`/mobile/coleta/${nextTask.id}`)}
                          className="flex-1 h-12 bg-[#2d3a4e] rounded-xl flex items-center justify-center gap-2 text-white font-black text-xs uppercase tracking-widest active:bg-slate-700"
                        >
                           <span className="material-symbols-outlined text-[18px]">check_circle</span> Coletar
                        </button>
                        <button 
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextTask.address)}`)}
                          className="flex-1 h-12 bg-primary rounded-xl flex items-center justify-center gap-2 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                           <span className="material-symbols-outlined text-[18px] fill">near_me</span> Navegar
                        </button>
                     </div>
                  </div>
               ) : (
                  <div className="text-center py-10 opacity-30 font-bold uppercase text-xs tracking-widest">Nenhuma tarefa pendente</div>
               )}
            </div>

            {/* Na Sequência */}
            <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[2px]">Na Sequência</h3>
               </div>
               
               <div className="space-y-3">
                  {remainingTasks.map((task, idx) => (
                     <div key={task.id} className="bg-[#1e293b] rounded-[24px] p-4 border border-[#233348] flex items-center gap-4 relative active:bg-[#233348]">
                        <div className="size-10 rounded-full bg-[#111822] flex items-center justify-center text-slate-500 font-black text-sm border border-[#233348]">{idx + 2}</div>
                        <div className="flex-1 min-w-0">
                           <h5 className="font-black text-white truncate text-sm">{task.client}</h5>
                           <p className="text-[10px] text-slate-400 mt-1 truncate">{task.address}</p>
                        </div>
                        <div className="flex flex-col gap-3 items-end">
                           <span className="material-symbols-outlined text-slate-600 text-[20px]">drag_handle</span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
