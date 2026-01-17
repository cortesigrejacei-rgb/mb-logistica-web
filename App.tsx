
import React, { useState, useEffect } from 'react';
import { Routes, Route, HashRouter, Navigate, NavLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Tecnicos } from './pages/Tecnicos';
import { Estoque } from './pages/Estoque';
import { Mapa } from './pages/Mapa';
import { Ponto } from './pages/Ponto';
import { Financeiro } from './pages/Financeiro';
import { Importacao } from './pages/Importacao';
import { Combustivel } from './pages/Combustivel';
import { Configuracoes } from './pages/Configuracoes';
import { ApiConfig } from './pages/ApiConfig';
import { Relatorios } from './pages/Relatorios';
import { Coletas } from './pages/Coletas';
import { Clientes } from './pages/Clientes';
import { TechnicianForm } from './pages/TechnicianForm';
import { Notificacoes } from './pages/Notificacoes';

// Mobile Pages
import { MobileRoteiro } from './pages/mobile/MobileRoteiro';
import { MobileColetaDetalhe } from './pages/mobile/MobileColetaDetalhe';
import { MobilePerfil } from './pages/mobile/MobilePerfil';
import { MobilePonto } from './pages/mobile/MobilePonto';
import { MobileNotificacoes } from './pages/mobile/MobileNotificacoes';
import { MobileFinanceiro } from './pages/mobile/MobileFinanceiro';
import { MobileHome } from './pages/mobile/MobileHome';

const MobileLayout: React.FC = () => {
  const location = useLocation();
  const { showToast, currentTechnician, updateTechnician } = useData();
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'error'>('searching');

  // GPS Tracking Realtime - Otimizado
  useEffect(() => {
    let watchId: number;

    const techId = currentTechnician?.id;
    const techStatus = currentTechnician?.status;

    if (techId && (techStatus === 'Online' || techStatus === 'Em Rota')) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setGpsStatus('active');
            updateTechnician(techId, {
              lat: latitude,
              lng: longitude,
              last_seen: new Date().toISOString()
            }).catch(e => console.error("Falha ao sincronizar posição:", e));
          },
          (error) => {
            setGpsStatus('error');
            console.error(`GPS Error (${error.code}): ${error.message}`);
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 10000
          }
        );
      }
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentTechnician?.id, currentTechnician?.status]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#080c14] overflow-hidden">
      {/* GPS Status Indicator */}
      <div className={`h-1 w-full transition-colors duration-500 ${gpsStatus === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : gpsStatus === 'error' ? 'bg-red-500' : 'bg-primary animate-pulse'}`}></div>

      <div className="flex-1 overflow-hidden relative">
        <Routes>
          <Route path="/" element={<MobileRoteiro />} />
          <Route path="/mobile/ponto" element={<MobilePonto />} />
          <Route path="/mobile/notificacoes" element={<MobileNotificacoes />} />
          <Route path="/mobile/coleta/:id" element={<MobileColetaDetalhe />} />
          <Route path="/mobile/perfil" element={<MobilePerfil />} />
          <Route path="/mobile/financeiro" element={<MobileFinanceiro />} />
          <Route path="/mobile/historico" element={<MobileHome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <nav className="h-[85px] bg-[#080c14] border-t border-white/5 flex items-center justify-around px-2 z-50 relative pb-4">
        <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-primary' : 'text-slate-500'}`}>
          <span className={`material-symbols-outlined text-[26px] ${location.pathname === '/' ? 'fill' : ''}`}>assignment</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Roteiro</span>
        </NavLink>

        <button className="flex flex-col items-center gap-1 text-slate-500 opacity-30">
          <span className="material-symbols-outlined text-[26px]">map</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Mapa</span>
        </button>

        <div className="relative -top-5">
          <button
            onClick={() => showToast('Iniciando Scanner MB...', 'info')}
            className="size-14 bg-primary rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(19,109,236,0.5)] active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[28px]">qr_code_scanner</span>
          </button>
        </div>

        <NavLink to="/mobile/historico" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-primary' : 'text-slate-500'}`}>
          <span className={`material-symbols-outlined text-[26px] ${location.pathname.includes('historico') ? 'fill' : ''}`}>history</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Histórico</span>
        </NavLink>

        <NavLink to="/mobile/perfil" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-primary' : 'text-slate-500'}`}>
          <span className={`material-symbols-outlined text-[26px] ${location.pathname.includes('perfil') ? 'fill' : ''}`}>person</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Ajustes</span>
        </NavLink>
      </nav>
    </div>
  );
};

const AdminLayout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { toasts } = useData();

  return (
    <div className="flex h-screen w-full bg-background-dark text-white font-display overflow-hidden relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <div className="md:hidden flex items-center justify-between p-4 bg-[#111822] border-b border-[#233348] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
              <span className="material-symbols-outlined">local_shipping</span>
            </div>
            <span className="font-bold text-white uppercase tracking-widest text-xs">MB ADMIN</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-white hover:bg-[#233348] rounded-lg transition-colors">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tecnicos/novo" element={<TechnicianForm />} />
            <Route path="/tecnicos/editar/:id" element={<TechnicianForm />} />
            <Route path="/tecnicos" element={<Tecnicos />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/ponto" element={<Ponto />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/importacao" element={<Importacao />} />
            <Route path="/combustivel" element={<Combustivel />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/api-config" element={<ApiConfig />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/coletas" element={<Coletas />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/notificacoes" element={<Notificacoes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`min-w-[300px] p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fadeIn transition-all transform ${toast.type === 'success' ? 'bg-[#1e293b] border-green-500/30 text-green-400' : toast.type === 'error' ? 'bg-[#1e293b] border-red-500/30 text-red-400' : 'bg-[#1e293b] border-blue-500/30 text-blue-400'}`}>
            <span className="material-symbols-outlined">{toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}</span>
            <p className="text-white text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { currentTechnician, loading } = useData();
  if (loading) return <div className="flex h-screen w-full items-center justify-center bg-[#080c14] text-white">
    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
  </div>;
  if (!isAuthenticated) return <Routes><Route path="*" element={<Login />} /></Routes>;
  if (currentTechnician) return <MobileLayout />;
  return <AdminLayout />;
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <HashRouter>
          <AppLayout />
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  );
}
export default App;
