
import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const MobilePerfil = () => {
  const { logout } = useAuth();
  const { currentTechnician, collections, stockItems, updateTechnician, uploadFile, showToast } = useData();
  const [notificacoes, setNotificacoes] = useState(true);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calcula itens no carro do técnico
  const myStock = stockItems.filter(item => 
    item.location.toLowerCase().includes(currentTechnician?.name.toLowerCase() || '---')
  );

  const today = new Date().toISOString().split('T')[0];
  const myCollectionsToday = collections.filter(c => c.driverId === currentTechnician?.id && c.date === today);
  const collectedCount = myCollectionsToday.filter(c => c.status === 'Coletado').length;
  const metaDiaria = 20;
  const progressPercent = Math.min((collectedCount / metaDiaria) * 100, 100);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentTechnician) {
      setIsUploading(true);
      try {
        const url = await uploadFile(file, 'avatars', 'mobile_perfil');
        if (url) {
          await updateTechnician(currentTechnician.id, { avatar: url });
          showToast('Foto atualizada!');
        }
      } catch (err) {
        showToast('Erro ao atualizar foto.', 'error');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111822] text-white overflow-y-auto pb-24">
       <div className="px-5 py-4 flex items-center justify-between sticky top-0 bg-[#111822] z-10 border-b border-[#233348]/50">
          <h1 className="text-lg font-black uppercase tracking-widest">Configurações</h1>
       </div>

       <div className="px-5 pb-6">
          {/* Profile Header */}
          <div className="flex flex-col items-center mt-6 mb-8">
             <div className="relative mb-3 group" onClick={() => fileInputRef.current?.click()}>
                <div className="w-[110px] h-[110px] rounded-full bg-gradient-to-tr from-primary to-cyan-400 p-[3px] shadow-[0_0_20px_rgba(19,109,236,0.3)]">
                   <div className="w-full h-full rounded-full bg-[#111822] p-[3px] overflow-hidden relative">
                      <img 
                        src={currentTechnician?.avatar} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover" 
                      />
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                           <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        </div>
                      )}
                   </div>
                </div>
                <div className="absolute bottom-1 right-1 w-7 h-7 bg-primary border-4 border-[#111822] rounded-full flex items-center justify-center text-white">
                   <span className="material-symbols-outlined text-[16px]">edit</span>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
             </div>
             
             <h2 className="text-2xl font-black text-white">{currentTechnician?.name}</h2>
             <span className="text-primary text-[10px] font-black uppercase tracking-[2px] mt-1">{currentTechnician?.role}</span>
          </div>

          {/* Performance Quick Look */}
          <div className="grid grid-cols-2 gap-3 mb-6">
             <div 
               onClick={() => setIsStockModalOpen(true)}
               className="bg-[#1e293b] p-4 rounded-2xl border border-[#233348] active:scale-95 transition-all cursor-pointer relative overflow-hidden"
             >
                <div className="flex justify-between items-start mb-1">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meu Estoque</span>
                   <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                </div>
                <p className="text-2xl font-black text-white">{myStock.length}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">ITENS NO CARRO</p>
             </div>
             <div className="bg-[#1e293b] p-4 rounded-2xl border border-[#233348]">
                <div className="flex justify-between items-start mb-1">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sucesso</span>
                   <span className="material-symbols-outlined text-emerald-500 text-[20px]">verified</span>
                </div>
                <p className="text-2xl font-black text-white">{collectedCount}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">COLETAS HOJE</p>
             </div>
          </div>

          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Informações</h3>
          <div className="bg-[#1e293b] rounded-2xl border border-[#233348] divide-y divide-[#233348] mb-6 shadow-xl">
             <ListItem icon="mail" label="E-mail" value={currentTechnician?.email || ''} />
             <ListItem icon="badge" label="ID Sistema" value={currentTechnician?.id || ''} />
          </div>

          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Preferências</h3>
          <div className="bg-[#1e293b] rounded-2xl border border-[#233348] divide-y divide-[#233348] mb-8 shadow-xl">
             <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl bg-[#111822] flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">notifications</span>
                   </div>
                   <span className="text-sm font-bold text-white">Notificações Push</span>
                </div>
                <div 
                   onClick={() => setNotificacoes(!notificacoes)}
                   className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors ${notificacoes ? 'bg-primary' : 'bg-[#111822]'}`}
                >
                   <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${notificacoes ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
             </div>
             <button onClick={() => logout()} className="w-full p-4 flex items-center gap-4 text-left text-red-500">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                   <span className="material-symbols-outlined">logout</span>
                </div>
                <span className="text-sm font-bold">Sair do Aplicativo</span>
             </button>
          </div>

          <p className="text-center text-[10px] font-black text-slate-600 uppercase tracking-[3px]">Vupty v2.4.0</p>
       </div>

       {/* Trunk Stock Modal */}
       {isStockModalOpen && (
         <div className="fixed inset-0 z-50 flex items-end justify-center">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsStockModalOpen(false)}></div>
           <div className="relative bg-[#1e293b] w-full max-h-[80%] rounded-t-[40px] border-t border-[#233348] shadow-2xl overflow-hidden flex flex-col animate-slideUp">
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-4 shrink-0"></div>
              
              <div className="px-8 pb-6 border-b border-[#233348] shrink-0">
                 <h3 className="text-2xl font-black text-white">Inventário do Carro</h3>
                 <p className="text-slate-400 text-sm">Equipamentos em posse de: {currentTechnician?.name}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-hide">
                 {myStock.length > 0 ? (
                    <div className="space-y-4 pb-8">
                       {myStock.map(item => (
                          <div key={item.id} className="bg-[#111822] p-4 rounded-2xl border border-[#233348] flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.status === 'Novo' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-500'}`}>
                                <span className="material-symbols-outlined text-[24px]">router</span>
                             </div>
                             <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">{item.model}</h4>
                                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{item.serial}</p>
                             </div>
                             <span className={`text-[10px] font-black uppercase px-2 py-1 rounded bg-[#192433] border border-[#233348] ${item.status === 'Novo' ? 'text-primary' : 'text-orange-500'}`}>
                                {item.status}
                             </span>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                       <span className="material-symbols-outlined text-6xl mb-4">inventory</span>
                       <p className="font-black uppercase text-xs tracking-widest">Veículo Vazio</p>
                       <p className="text-[10px] mt-1">Nenhum equipamento vinculado.</p>
                    </div>
                 )}
              </div>
           </div>
         </div>
       )}
    </div>
  );
};

const ListItem = ({ icon, label, value }: { icon: string, label: string, value: string }) => (
  <div className="p-4 flex items-center gap-4">
     <div className="w-10 h-10 rounded-xl bg-[#111822] flex items-center justify-center text-slate-500">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
     </div>
     <div className="flex-1">
        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-white mt-0.5">{value}</p>
     </div>
  </div>
);
