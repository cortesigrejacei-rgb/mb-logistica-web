
import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { MobileSidebar } from '../../components/MobileSidebar';

export const MobilePonto = () => {
  const { currentTechnician, updateTechnician, showToast } = useData();
  
  const [time, setTime] = useState(new Date());
  const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  const isWorking = currentTechnician?.status === 'Online' || currentTechnician?.status === 'Em Rota';

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);

      if (isWorking && currentTechnician?.last_seen) {
        const startTime = new Date(currentTechnician.last_seen);
        const diff = now.getTime() - startTime.getTime();
        const safeDiff = Math.max(0, diff);
        
        const h = Math.floor(safeDiff / (1000 * 60 * 60));
        const m = Math.floor((safeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((safeDiff % (1000 * 60)) / 1000);
        setElapsed({ h, m, s });
      } else {
        setElapsed({ h: 0, m: 0, s: 0 });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isWorking, currentTechnician?.last_seen]);

  const toggleWorkStatus = async () => {
    setIsConfirmModalOpen(false);
    try {
      const newStatus = isWorking ? 'Offline' : 'Online';
      await updateTechnician(currentTechnician!.id, { status: newStatus });
      showToast(isWorking ? 'Expediente encerrado!' : 'Expediente iniciado!');
    } catch (e) {
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
      .format(date)
      .toUpperCase()
      .replace('.', '');
  };

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  // URL do mapa baseada na lat/lng atual do técnico ou fallback para Brasil
  const mapUrl = currentTechnician?.lat && currentTechnician?.lng 
    ? `https://maps.google.com/maps?q=${currentTechnician.lat},${currentTechnician.lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`
    : `https://maps.google.com/maps?q=-15.7797,-47.9297&t=&z=4&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="flex flex-col h-full bg-[#111822] text-white overflow-y-auto pb-24 relative">
      <MobileSidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <header className="px-5 py-4 flex items-center justify-between sticky top-0 bg-[#111822] z-20 border-b border-[#233348]/50">
        <button onClick={() => setIsMenuOpen(true)} className="text-white p-1">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-lg font-bold">Registro de Ponto</h1>
        <div className="size-8 rounded-full overflow-hidden border border-slate-600">
           <img 
             src={currentTechnician?.avatar} 
             alt="User" 
             className="w-full h-full object-cover" 
           />
        </div>
      </header>

      <div className="flex flex-col items-center mt-6 px-6">
         <span className="text-[10px] font-black text-primary tracking-widest mb-2 uppercase">
            {formatDate(time)}
         </span>
         
         <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-8 border transition-colors ${
            isWorking 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
              : 'bg-red-500/10 text-red-500 border-red-500/20'
         }`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 mb-0.5 ${isWorking ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            {isWorking ? 'Em Expediente' : 'Fora de Expediente'}
         </div>

         <div className="w-full bg-[#1e293b] rounded-3xl p-8 border border-[#233348] mb-6 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-center gap-2">
               <TimerBlock value={formatNumber(elapsed.h)} label="Horas" />
               <span className="text-2xl font-bold text-slate-700 -mt-6">:</span>
               <TimerBlock value={formatNumber(elapsed.m)} label="Minutos" />
               <span className="text-2xl font-bold text-slate-700 -mt-6">:</span>
               <TimerBlock value={formatNumber(elapsed.s)} label="Segundos" isAccent />
            </div>
         </div>

         {/* Map Location - Dinâmico */}
         <div className="w-full bg-[#1e293b] rounded-2xl border border-[#233348] overflow-hidden mb-8 shadow-xl">
            <div className="h-32 bg-[#111822] relative overflow-hidden grayscale">
               <iframe
                 title="Mini Map"
                 width="100%"
                 height="100%"
                 frameBorder="0"
                 scrolling="no"
                 src={mapUrl}
                 className="opacity-40"
               />
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center animate-ping"></div>
                  <div className="w-3 h-3 bg-primary border border-white rounded-full relative z-10"></div>
               </div>
            </div>
            <div className="p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">my_location</span>
                <p className="text-xs font-bold text-slate-300">Localização capturada via GPS</p>
            </div>
         </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#192433] border-t border-[#233348] p-5 pb-24 z-40">
         <button 
            onClick={() => setIsConfirmModalOpen(true)}
            className={`w-full h-16 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 ${
               isWorking 
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                  : 'bg-primary text-white shadow-primary/30'
            }`}
         >
            <span className="material-symbols-outlined text-[24px]">
               {isWorking ? 'logout' : 'login'}
            </span>
            {isWorking ? 'Encerrar Expediente' : 'Iniciar Expediente'}
         </button>
      </div>

      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsConfirmModalOpen(false)}></div>
          <div className="relative bg-[#1e293b] rounded-3xl border border-[#233348] w-full max-sm p-8 text-center animate-fadeIn shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-2">{isWorking ? 'Encerrar Dia?' : 'Iniciar Dia?'}</h3>
            <p className="text-slate-400 text-sm mb-8">Sua localização atual será registrada no ponto.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-4 bg-[#111822] text-white font-bold rounded-2xl">Voltar</button>
              <button onClick={toggleWorkStatus} className={`flex-1 py-4 font-black rounded-2xl text-white ${isWorking ? 'bg-red-500' : 'bg-primary'}`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TimerBlock = ({ value, label, isAccent }: any) => (
  <div className="flex flex-col items-center gap-2">
    <div className="bg-[#111822] w-16 h-20 rounded-2xl flex items-center justify-center border border-[#233348] shadow-inner">
       <span className={`text-4xl font-mono font-black ${isAccent ? 'text-primary' : 'text-white'}`}>{value}</span>
    </div>
    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{label}</span>
  </div>
);
