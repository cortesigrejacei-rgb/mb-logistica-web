
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const { login, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (mode === 'login') {
        const { error } = await login(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setSuccessMsg('Conta criada! Você já pode fazer login.');
        setMode('login');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes("Invalid login")) {
        setError("Email ou senha incorretos.");
      } else {
        setError(err.message || "Ocorreu um erro ao conectar.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#080c14] relative overflow-hidden font-display">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md p-6 relative z-10">
        <div className="flex flex-col items-center mb-10 animate-slideDown">
           {/* Modern MB Logo */}
           <div className="relative mb-6">
              <div className="size-20 bg-gradient-to-br from-primary to-blue-700 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl shadow-primary/40 relative overflow-hidden">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                 <span className="text-white font-black text-3xl -rotate-12 tracking-tighter">MB</span>
              </div>
              <div className="absolute -bottom-2 -right-2 size-8 bg-[#080c14] rounded-full flex items-center justify-center border border-white/10">
                 <span className="material-symbols-outlined text-primary text-sm fill">verified</span>
              </div>
           </div>
           
           <h1 className="text-4xl font-black text-white tracking-tight text-center">
              MB <span className="text-primary font-light">Logística</span>
           </h1>
           <p className="text-slate-400 mt-3 text-center text-sm font-medium max-w-[280px]">
              {mode === 'login' 
                ? 'Acesse a inteligência operacional da sua frota.' 
                : 'Cadastre suas credenciais para acesso técnico.'}
           </p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle line decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

          {/* Mode Switcher */}
          <div className="flex p-1.5 bg-black/40 rounded-2xl mb-8 border border-white/5">
             <button 
               type="button"
               onClick={() => { setMode('login'); setError(''); }}
               className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${mode === 'login' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
             >
               Entrar
             </button>
             <button 
               type="button"
               onClick={() => { setMode('signup'); setError(''); }}
               className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${mode === 'signup' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
             >
               Novo Técnico
             </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[2px] ml-1">Usuário</label>
              <div className="group relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none block pl-12 p-4 transition-all placeholder:text-slate-700"
                  placeholder="exemplo@mb.com.br"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[2px] ml-1">Senha</label>
              <div className="group relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none block pl-12 p-4 transition-all placeholder:text-slate-700"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-3 animate-shake">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-3 animate-fadeIn">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {successMsg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary hover:bg-blue-600 active:scale-[0.98] text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed mt-4 uppercase tracking-[2px] text-xs"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Iniciar Sessão' : 'Concluir Cadastro'}</span>
                  <span className="material-symbols-outlined font-bold">keyboard_double_arrow_right</span>
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="flex flex-col items-center mt-10 gap-2">
           <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[4px]">Powered by MB Tech</p>
           <div className="flex gap-4 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="material-symbols-outlined text-white text-xl">shield</span>
              <span className="material-symbols-outlined text-white text-xl">database</span>
              <span className="material-symbols-outlined text-white text-xl">rocket_launch</span>
           </div>
        </div>
      </div>
    </div>
  );
};
