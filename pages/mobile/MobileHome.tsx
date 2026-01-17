
import React, { useState } from 'react';
import { useData, Collection } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';

export const MobileHome = () => {
  const { currentTechnician, collections, refreshData } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Tudo');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  if (!currentTechnician) return <div className="p-8 text-center text-white font-bold">Iniciando histórico...</div>;

  // Filtro base: tarefas deste técnico
  let myTasks = [...collections]
    .filter(c => c.driverId === currentTechnician.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filtro por busca
  const filteredTasks = myTasks.filter(c => 
    c.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'Coletado':
        return { label: 'Coletado', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' };
      case 'Em Rota':
      case 'Pendente':
        return { label: 'Em Análise', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' };
      case 'Falha':
        return { label: 'Não Coletado', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' };
      default:
        return { label: 'Em Análise', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' };
    }
  };

  const formatCardDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  return (
    <div className="flex flex-col h-full bg-[#111822] text-white font-display overflow-hidden relative">
      
      {/* Header Fiel à Imagem */}
      <header className="px-6 py-5 flex items-center justify-between sticky top-0 bg-[#111822] z-30">
        <button onClick={() => navigate(-1)} className="text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold">Histórico de Coletas</h1>
        <button className="text-white">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      {/* Busca e Filtros */}
      <div className="px-6 py-2 space-y-5">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">search</span>
          <input 
            type="text"
            placeholder="Buscar por cliente, OS ou endereço"
            className="w-full bg-[#1e293b] text-sm text-white placeholder:text-slate-500 rounded-2xl py-4 pl-12 pr-12 border border-[#233348] focus:outline-none focus:border-primary/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20">
            Tudo <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
          <button className="bg-[#1e293b] text-slate-300 border border-[#233348] px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2">
            Esta Semana <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          </button>
          <button className="bg-[#1e293b] text-slate-300 border border-[#233348] px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2">
            Status <span className="material-symbols-outlined text-[18px]">expand_more</span>
          </button>
        </div>
      </div>

      {/* Lista de Recentes */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 scrollbar-hide">
        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[2px] mb-4">Recentes</h3>
        
        <div className="flex flex-col gap-4">
          {filteredTasks.map((task, index) => {
            const config = getStatusConfig(task.status);
            const initials = task.client.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const modemType = task.notes?.includes('Modem') ? task.notes : 'Modem GPON';

            return (
              <div 
                key={task.id}
                onClick={() => navigate(`/mobile/coleta/${task.id}`)}
                className="bg-[#192433] rounded-[28px] p-5 border border-[#233348] shadow-md active:scale-[0.98] transition-all animate-fadeIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    {index === 0 ? (
                       <div className="size-12 rounded-full overflow-hidden border-2 border-slate-700 shadow-lg">
                          <img src={`https://ui-avatars.com/api/?name=${task.client}&background=random&color=fff`} alt="" className="w-full h-full object-cover" />
                       </div>
                    ) : (
                       <div className="size-12 rounded-full bg-[#233348] flex items-center justify-center text-primary font-black text-sm border border-primary/20">
                          {initials}
                       </div>
                    )}
                    <div>
                      <h4 className="font-black text-white text-base leading-tight">{task.client}</h4>
                      <p className="text-slate-500 text-[10px] font-bold mt-0.5">OS: #{task.id.replace(/\D/g, '')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-black text-xs">14:30</p>
                    <p className="text-slate-500 text-[10px] font-bold">{formatCardDate(task.date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 mb-6">
                  <span className="material-symbols-outlined text-slate-500 text-[18px]">location_on</span>
                  <p className="text-slate-400 text-xs font-bold leading-tight">{task.address}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#233348]/50">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="material-symbols-outlined text-[18px]">router</span>
                    <span className="text-xs font-bold">{modemType}</span>
                  </div>
                  
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.border} ${config.bg}`}>
                    <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action Button Fiel à Imagem */}
      <button className="absolute bottom-24 right-6 size-16 bg-primary rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_rgba(19,109,236,0.4)] active:scale-90 transition-transform z-40">
        <span className="material-symbols-outlined text-[32px] font-bold">add</span>
      </button>

    </div>
  );
};
