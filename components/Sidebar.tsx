
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const links = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/coletas', label: 'Coletas', icon: 'local_shipping' },
  { to: '/clientes', label: 'Clientes', icon: 'group' },
  { to: '/tecnicos', label: 'Técnicos', icon: 'engineering' },
  { to: '/estoque', label: 'Estoque', icon: 'inventory_2' },
  { to: '/mapa', label: 'Mapa Tempo Real', icon: 'map' },
  { to: '/financeiro', label: 'Financeiro', icon: 'payments' },
  { to: '/relatorios', label: 'Relatórios', icon: 'bar_chart' },
  { to: '/ponto', label: 'Ponto Eletrônico', icon: 'schedule' },
  { to: '/combustivel', label: 'Combustível', icon: 'local_gas_station' },
  { to: '/importacao', label: 'Importar Rotas', icon: 'upload_file' },
  { to: '/notificacoes', label: 'Notificações', icon: 'notifications' },
  { to: '/api-config', label: 'Integrações API', icon: 'api' },
  { to: '/configuracoes', label: 'Configurações', icon: 'settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { settings } = useData();
  const [imgError, setImgError] = useState(false);

  // Handle Supabase User Metadata safely
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin';
  // Use fallback if imgError is true
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${userName}&background=random&color=fff`;
  const userAvatar = !imgError ? (user?.user_metadata?.avatar || fallbackAvatar) : fallbackAvatar;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed md:relative z-30 inset-y-0 left-0 
          flex flex-col w-64 bg-[#080c14] border-r border-white/5 h-full flex-shrink-0 
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full justify-between">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Brand */}
            <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-primary size-8 rounded-lg flex items-center justify-center font-black text-white text-xs">MB</div>
                <div className="flex flex-col">
                  <h1 className="text-sm font-black leading-tight text-white uppercase tracking-widest">{settings?.systemName || 'MB ADMIN'}</h1>
                  <p className="text-slate-500 text-[10px] font-bold truncate w-32" title={userName}>{userName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="md:hidden text-text-secondary hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-1 p-3 overflow-y-auto custom-scrollbar">
              {links.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => {
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 flex-shrink-0 ${isActive
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-slate-500 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>
                      {link.icon}
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest">{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* User Info & Bottom */}
          <div className="p-4 border-t border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl mb-2">
              <div className="size-8 rounded-full overflow-hidden border border-white/10">
                <img src={userAvatar} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[10px] font-black text-white truncate">{userName}</span>
                <span className="text-[9px] font-bold text-primary uppercase">Online</span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="text-xs font-black uppercase tracking-widest">Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
