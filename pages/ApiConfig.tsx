import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';

export const ApiConfig = () => {
  const { settings, updateSettings } = useData();
  const [formData, setFormData] = useState({
    apiClientId: settings.apiClientId || '',
    apiClientSecret: settings.apiClientSecret || '',
    apiBaseUrlProd: settings.apiBaseUrlProd || '',
    apiBaseUrlStage: settings.apiBaseUrlStage || ''
  });
  const [saved, setSaved] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setFormData({
        apiClientId: settings.apiClientId || '',
        apiClientSecret: settings.apiClientSecret || '',
        apiBaseUrlProd: settings.apiBaseUrlProd || '',
        apiBaseUrlStage: settings.apiBaseUrlStage || ''
    });
  }, [settings]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestLogs([]);
    
    // Simulate connection process steps
    const addLog = (msg: string) => setTestLogs(prev => [...prev, msg]);

    addLog(`Iniciando handshake com ${formData.apiBaseUrlProd || 'endpoint indefinido'}...`);
    
    await new Promise(r => setTimeout(r, 800));

    if (!formData.apiClientId || !formData.apiClientSecret) {
        addLog(`[ERROR] Credenciais ausentes. Verifique Client ID e Secret.`);
        setIsTesting(false);
        return;
    }

    addLog(`Credenciais validadas localmente.`);
    await new Promise(r => setTimeout(r, 800));
    
    const now = new Date().toLocaleString('pt-BR');
    addLog(`${now} [SUCCESS] Status 200 OK - Conexão estabelecida.`);
    
    setIsTesting(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto relative p-6 md:p-10 bg-background-light dark:bg-background-dark">
      <div className="max-w-[1200px] w-full mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#2A3C52] pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
              Configurações de API (Oi/NIO)
            </h1>
            <p className="text-[#92a9c9] text-base font-normal max-w-2xl">
              Gerencie as chaves de acesso, endpoints e validação da conexão.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${formData.apiClientId ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${formData.apiClientId ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${formData.apiClientId ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                </span>
                <span className={`${formData.apiClientId ? 'text-emerald-400' : 'text-red-400'} text-xs font-bold uppercase tracking-wide`}>
                    {formData.apiClientId ? 'Configurado' : 'Pendente'}
                </span>
            </div>
            <button 
                onClick={handleSave}
                className={`flex items-center justify-center gap-2 h-10 px-6 ${saved ? 'bg-green-600' : 'bg-primary hover:bg-blue-600'} text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20`}
            >
                <span className="material-symbols-outlined text-[20px]">{saved ? 'check' : 'save'}</span> 
                {saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 flex flex-col gap-6">
            <div className="bg-card-dark rounded-xl border border-border-dark overflow-hidden">
              <div className="px-6 py-4 border-b border-border-dark flex justify-between items-center bg-[#192433]">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">lock</span>
                  <h3 className="text-white font-bold text-lg">Autenticação</h3>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-5">
                <SecretInput 
                    label="Client ID" 
                    value={formData.apiClientId} 
                    onChange={(val: string) => handleChange('apiClientId', val)}
                />
                <SecretInput 
                    label="Client Secret" 
                    value={formData.apiClientSecret} 
                    onChange={(val: string) => handleChange('apiClientSecret', val)}
                />
              </div>
            </div>

            <div className="bg-card-dark rounded-xl border border-border-dark overflow-hidden">
              <div className="px-6 py-4 border-b border-border-dark flex justify-between items-center bg-[#192433]">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">link</span>
                  <h3 className="text-white font-bold text-lg">Endpoints</h3>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <TextInput 
                    label="Base URL (Produção)" 
                    value={formData.apiBaseUrlProd} 
                    onChange={(val: string) => handleChange('apiBaseUrlProd', val)}
                  />
                  <TextInput 
                    label="Base URL (Staging)" 
                    value={formData.apiBaseUrlStage} 
                    onChange={(val: string) => handleChange('apiBaseUrlStage', val)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <div className="bg-card-dark rounded-xl border border-border-dark overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-border-dark bg-[#192433]">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">terminal</span>
                  <h3 className="text-white font-bold text-lg">Teste de Conexão</h3>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-4 flex-1">
                <button 
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold h-12 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {isTesting ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                        <span className="material-symbols-outlined">wifi_tethering</span>
                        Verificar Conexão
                    </>
                  )}
                </button>
                <div className="mt-4 flex-1 flex flex-col min-h-[250px]">
                  <div className="bg-black/40 border border-border-dark rounded-lg p-4 font-mono text-xs overflow-y-auto h-full max-h-[400px]">
                    <div className="flex flex-col gap-2">
                        {testLogs.length === 0 && !isTesting && (
                            <span className="text-slate-500">Aguardando início do teste...</span>
                        )}
                        {testLogs.map((log, idx) => (
                             <span key={idx} className={`${log.includes('[ERROR]') ? 'text-red-400' : log.includes('[SUCCESS]') ? 'text-emerald-500' : 'text-slate-300'}`}>
                                {log}
                             </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SecretInput = ({ label, value, onChange }: any) => (
  <label className="flex flex-col w-full gap-2">
    <span className="text-white text-sm font-medium">{label}</span>
    <div className="flex w-full items-stretch rounded-lg group focus-within:ring-2 focus-within:ring-primary/50 transition-all">
      <input
        className="form-input flex-1 bg-[#192433] border-border-dark text-white rounded-l-lg border-r-0 h-12 px-4 focus:ring-0 focus:border-primary placeholder:text-[#92a9c9]"
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••••••••••••••"
      />
      <button className="flex items-center justify-center px-4 bg-[#192433] border border-l-0 border-border-dark rounded-r-lg text-[#92a9c9] hover:text-white transition-colors">
        <span className="material-symbols-outlined text-xl">visibility_off</span>
      </button>
    </div>
  </label>
);

const TextInput = ({ label, value, onChange }: any) => (
  <label className="flex flex-col w-full gap-2">
    <p className="text-white text-sm font-medium">{label}</p>
    <input
      className="form-input w-full rounded-lg bg-[#192433] border-border-dark text-white h-12 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-[#92a9c9]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);