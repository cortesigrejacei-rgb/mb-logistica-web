
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';

export const MobileNotificacoes = () => {
  const navigate = useNavigate();
  const { collections, currentTechnician } = useData();

  // Gera notificações baseadas no roteiro atual
  const myPendingTasks = collections.filter(c => 
    c.driverId === currentTechnician?.id && 
    (c.status === 'Pendente' || c.status === 'Em Rota')
  );

  const notifications = myPendingTasks.map(task => ({
    id: task.id,
    title: 'Nova Rota Atribuída',
    description: `Coleta para o cliente ${task.client} em ${task.address.split(',')[0]}.`,
    time: 'Agora',
    type: 'route',
    category: 'Roteiros'
  }));

  // Adiciona algumas notificações de sistema se não houver tarefas
  if (notifications.length === 0) {
    notifications.push({
      id: 'sys-1',
      title: 'Sistema Operacional',
      description: 'Vupty Admin está rodando e sincronizado.',
      time: '08:00',
      type: 'system',
      category: 'Geral'
    });
  }

  const getIcon = (type: string) => {
    switch(type) {
      case 'route': return 'map';
      case 'system': return 'dns';
      case 'alert': return 'warning';
      default: return 'notifications';
    }
  };

  const getColors = (type: string) => {
    switch(type) {
      case 'route': return 'bg-primary/20 text-primary';
      case 'system': return 'bg-slate-500/20 text-slate-400';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111822] text-white">
      <header className="px-5 pt-6 pb-4 bg-[#111822] sticky top-0 z-10 border-b border-[#233348]/50">
         <h1 className="text-2xl font-black text-white uppercase tracking-widest">Alertas</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-5 pt-4 scrollbar-hide">
        <div className="flex flex-col gap-1">
          {notifications.map(item => (
            <div 
              key={item.id} 
              onClick={() => item.type === 'route' && navigate(`/mobile/coleta/${item.id}`)}
              className="py-5 border-b border-[#233348]/50 last:border-0 flex gap-4 animate-fadeIn cursor-pointer active:bg-[#1e293b]"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${getColors(item.type)}`}>
                <span className="material-symbols-outlined text-[24px]">{getIcon(item.type)}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-black text-sm uppercase text-white tracking-wider">
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap ml-2">{item.time}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed truncate-2">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {notifications.length === 0 && (
           <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <span className="material-symbols-outlined text-6xl mb-4">notifications_off</span>
              <p className="font-black uppercase tracking-widest text-xs">Sem novas mensagens</p>
           </div>
        )}
      </div>
    </div>
  );
};
