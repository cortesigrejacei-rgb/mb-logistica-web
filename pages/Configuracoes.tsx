import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabaseClient';

export const Configuracoes = () => {
  const { settings, updateSettings, resetData } = useData();

  // Local state for form handling before save
  const [formData, setFormData] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-[1200px] mx-auto p-4 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-white text-3xl font-bold tracking-tight">Configurações do Sistema</h2>
            <p className="text-text-secondary">Gerencie parâmetros globais da aplicação.</p>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center justify-center gap-2 h-10 px-6 ${saved ? 'bg-green-600' : 'bg-primary hover:bg-blue-600'} text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20`}
          >
            <span className="material-symbols-outlined text-[20px]">{saved ? 'check' : 'save'}</span>
            {saved ? 'Salvo!' : 'Salvar Alterações'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border border-[#233348]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                  <span className="material-symbols-outlined">tune</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Preferências Gerais</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup
                  label="Nome do Sistema"
                  value={formData.systemName}
                  onChange={(v: string) => handleChange('systemName', v)}
                />
                <SelectGroup
                  label="Fuso Horário"
                  value={formData.timezone}
                  options={['Brasília (GMT-3)', 'Manaus (GMT-4)', 'Lisboa (GMT+1)']}
                  onChange={(v: string) => handleChange('timezone', v)}
                />
                <SelectGroup
                  label="Idioma Padrão"
                  value={formData.language}
                  options={['Português (Brasil)', 'English', 'Español']}
                  onChange={(v: string) => handleChange('language', v)}
                />
                <InputGroup
                  label="E-mail de Suporte"
                  value={formData.supportEmail}
                  type="email"
                  onChange={(v: string) => handleChange('supportEmail', v)}
                />
                <InputGroup
                  label="Valor por Coleta (R$)"
                  value={formData.pricePerCollection}
                  type="number"
                  onChange={(v: string) => handleChange('pricePerCollection', parseFloat(v) || 0)}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-[#233348] overflow-hidden">
              <div className="p-6 border-b border-[#233348] flex justify-between items-center">
                <h3 className="text-lg font-bold text-red-400">Zona de Perigo</h3>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <p className="text-sm text-text-secondary">Se você deseja reiniciar todo o banco de dados de demonstração (Técnicos, Coletas, Estoque), clique abaixo.</p>
                <button
                  onClick={() => { if (window.confirm('Tem certeza? Isso apagará todos os dados criados.')) resetData(); }}
                  className="self-start px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-bold transition-colors"
                >
                  Resetar Dados de Fábrica
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border border-[#233348]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Automação & Alertas</h3>
              <div className="flex flex-col gap-4">
                <Toggle
                  label="Despacho Automático"
                  sub="Atribuir rotas disponíveis"
                  checked={formData.autoDispatch}
                  onChange={(v: boolean) => handleChange('autoDispatch', v)}
                />
                <Toggle label="Notificações SMS" sub="Alertas para motoristas" checked={true} onChange={() => { }} />
                <Toggle label="Modo Manutenção" sub="Suspende acesso externo" checked={false} onChange={() => { }} />
              </div>
            </div>

            <AdminAccountSettings />
          </div>
        </div>
      </div>
    </div>
  );
};

const InputGroup = ({ label, value, type = 'text', onChange }: any) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-medium text-text-secondary">{label}</label>
    <input
      className="bg-[#111822] border border-[#324867] text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const SelectGroup = ({ label, options, value, onChange }: any) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-medium text-text-secondary">{label}</label>
    <select
      className="bg-[#111822] border border-[#324867] text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o: string) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

const Toggle = ({ label, sub, checked, onChange }: any) => (
  <label className="flex items-center justify-between cursor-pointer group">
    <div className="flex flex-col">
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="text-xs text-text-secondary">{sub}</span>
    </div>
    <div className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </div>
  </label>
);
const AdminAccountSettings = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            setMessage({ text: 'A senha deve ter pelo menos 6 caracteres.', type: 'error' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ text: 'As senhas não conferem.', type: 'error' });
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setLoading(false);

        if (error) {
            setMessage({ text: `Erro: ${error.message}`, type: 'error' });
        } else {
            setMessage({ text: 'Senha atualizada com sucesso!', type: 'success' });
            setNewPassword('');
            setConfirmPassword('');
        }
    };

    const handleUpdateEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            setMessage({ text: 'Email inválido.', type: 'error' });
            return;
        }

        setLoading(true);
        const { data, error } = await supabase.auth.updateUser({ email: newEmail });
        setLoading(false);

        if (error) {
            setMessage({ text: `Erro: ${error.message}`, type: 'error' });
        } else {
            // Supabase sends a confirmation email to both old and new addresses usually
            setMessage({ text: 'Verifique seu email (antigo e novo) para confirmar a alteração.', type: 'success' });
            setNewEmail('');
        }
    };

    return (
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border border-[#233348]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
                    <span className="material-symbols-outlined">manage_accounts</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Conta do Administrador</h3>
            </div>

            {message && (
                <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${message.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {message.text}
                </div>
            )}

            <div className="flex flex-col gap-6">
                {/* Change Password */}
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-text-secondary">Alterar Senha</label>
                    <div className="flex flex-col gap-2">
                        <input
                            type="password"
                            placeholder="Nova Senha"
                            className="bg-[#111822] border border-[#324867] text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Confirmar Nova Senha"
                            className="bg-[#111822] border border-[#324867] text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                            onClick={handleUpdatePassword}
                            disabled={loading}
                            className="mt-1 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Atualizando...' : 'Atualizar Senha'}
                        </button>
                    </div>
                </div>

                <div className="h-[1px] bg-[#233348]"></div>

                {/* Change Email */}
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-text-secondary">Alterar Email</label>
                    <div className="flex flex-col gap-2">
                        <input
                            type="email"
                            placeholder="Novo Email"
                            className="bg-[#111822] border border-[#324867] text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                        <button
                            onClick={handleUpdateEmail}
                            disabled={loading}
                            className="mt-1 px-4 py-2 bg-[#233348] hover:bg-[#324867] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Atualizando...' : 'Solicitar Troca de Email'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
