import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
  const { logout } = useAuth();
  const { currentTechnician } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div 
        className={`
          fixed top-0 bottom-0 left-0 w-[280px] bg-[#111822] border-r border-[#233348] z-[70]
          transform transition-transform duration-300 ease-out shadow-2xl flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#233348] flex flex-col gap-4 bg-[#192433]">
           <div className="flex items-center gap-3">
              <div className="size-12 rounded-full overflow-hidden border-2 border-[#136dec] p-0.5">
                 <img 
                    src={currentTechnician?.avatar} 
                    alt="User" 
                    className="w-full h-full rounded-full object-cover" 
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${currentTechnician?.name || 'User'}&background=1e293b&color=fff`;
                    }}
                 />
              </div>
              <div className="flex flex-col">
                 <h2 className="text-white font-bold text-lg leading-tight">{currentTechnician?.name}</h2>
                 <p className="text-slate-400 text-xs">{currentTechnician?.role}</p>
              </div>
           </div>
           <div className="flex gap-2">
              <div className="flex items-center gap-1.5 bg-[#111822] px-2 py-1 rounded text-[10px] font-bold text-emerald-500 border border-[#233348]">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
              </div>
              <div className="flex items-center gap-1.5 bg-[#111822] px-2 py-1 rounded text-[10px] font-bold text-primary border border-[#233348]">
                 <span className="material-symbols-outlined text-[12px]">star</span> 4.9
              </div>
           </div>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto py-4">
           <div className="px-4 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Menu Principal</div>
           <nav className="flex flex-col gap-1 px-2">
              <MenuItem 
                icon="alt_route" 
                label="Roteiro de Coleta" 
                onClick={() => handleNavigation('/')} 
                active={isActive('/')} 
              />
              <MenuItem 
                icon="schedule" 
                label="Registro de Ponto" 
                onClick={() => handleNavigation('/mobile/ponto')} 
                active={isActive('/mobile/ponto')} 
              />
              <MenuItem 
                icon="notifications" 
                label="Notificações" 
                onClick={() => handleNavigation('/mobile/notificacoes')} 
                active={isActive('/mobile/notificacoes')} 
              />
              <MenuItem 
                icon="attach_money" 
                label="Meus Ganhos" 
                onClick={() => handleNavigation('/mobile/financeiro')} 
                active={isActive('/mobile/financeiro')} 
              />
              <MenuItem 
                icon="person" 
                label="Meu Perfil" 
                onClick={() => handleNavigation('/mobile/perfil')} 
                active={isActive('/mobile/perfil')} 
              />
           </nav>
           
           <div className="h-px bg-[#233348] my-4 mx-4"></div>
           
           <div className="px-4 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suporte</div>
           <nav className="flex flex-col gap-1 px-2">
              <MenuItem icon="help" label="Ajuda e FAQ" onClick={() => {}} active={false} />
              <MenuItem icon="chat" label="Falar com Supervisor" onClick={() => {}} active={false} />
              <MenuItem icon="settings" label="Configurações" onClick={() => {}} active={false} />
           </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#233348] bg-[#192433]">
           <button 
             onClick={handleLogout}
             className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#233348] hover:bg-red-500/10 text-slate-400 hover:text-red-500 font-bold transition-colors"
           >
              <span className="material-symbols-outlined">logout</span>
              Sair da Conta
           </button>
           <p className="text-center text-[10px] text-slate-600 mt-3">Versão 2.4.0</p>
        </div>
      </div>
    </>
  );
};

const MenuItem = ({ icon, label, onClick, active }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-[#233348] hover:text-white'}`}
  >
     <span className={`material-symbols-outlined ${active ? 'fill' : ''}`}>{icon}</span>
     <span className="font-bold text-sm">{label}</span>
  </button>
);
