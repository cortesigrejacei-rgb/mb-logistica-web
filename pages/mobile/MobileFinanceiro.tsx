
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';

export const MobileFinanceiro = () => {
  const navigate = useNavigate();
  const { collections, currentTechnician, settings, showToast } = useData();
  const [saldoVisivel, setSaldoVisivel] = useState(true);

  if (!currentTechnician) return (
    <div className="flex h-screen items-center justify-center bg-[#111822] text-white">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  // Parâmetros de cálculo
  const pricePerUnit = settings.pricePerCollection || 35.00;
  const salarioFixo = 1500.00; // Valor base contratual

  // Filtra coletas CONCLUÍDAS deste técnico
  const myCompletedCollections = useMemo(() => {
    return collections.filter(c => 
      c.driverId === currentTechnician.id && c.status === 'Coletado'
    );
  }, [collections, currentTechnician.id]);

  const totalModemsColetados = myCompletedCollections.length;
  const produtividadeTotal = totalModemsColetados * pricePerUnit;
  const totalEstimado = salarioFixo + produtividadeTotal;
  
  // Meta Mensal (Exemplo: R$ 4.600,00)
  const metaMensalValue = 4600.00;
  const progress = Math.min((totalEstimado / metaMensalValue) * 100, 100);
  const faltaParaBonus = Math.max(metaMensalValue - totalEstimado, 0);

  // Agrupar histórico por data para simular "Rotas" (ex: Rota Centro, Rota Norte)
  const routesHistory = useMemo(() => {
    const groups: Record<string, { date: string, units: number, amount: number, name: string, timestamp: number }> = {};
    
    myCompletedCollections.forEach(c => {
      const dateKey = c.date; // Esperado YYYY-MM-DD
      if (!groups[dateKey]) {
        // Pega uma parte do endereço para dar nome à rota ou usa um padrão
        const region = c.address.split(',')[0].split(' ').pop() || 'Centro';
        groups[dateKey] = {
          date: new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          units: 0,
          amount: 0,
          name: `Rota ${region}`,
          timestamp: new Date(c.date).getTime()
        };
      }
      groups[dateKey].units += 1;
      groups[dateKey].amount += pricePerUnit;
    });

    return Object.values(groups)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10); // Mostra as últimas 10 rotas
  }, [myCompletedCollections, pricePerUnit]);

  return (
    <div className="flex flex-col h-full bg-[#111822] text-white relative font-display overflow-hidden">
      
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between sticky top-0 bg-[#111822]/90 backdrop-blur-md z-30 border-b border-[#233348]/50">
        <button onClick={() => navigate(-1)} className="text-white active:scale-90 transition-transform p-1">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold">Ganhos Financeiros</h1>
        <button className="text-white active:scale-90 transition-transform p-1">
          <span className="material-symbols-outlined">calendar_month</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide space-y-6 pt-4">
        
        {/* Seletor de Mês */}
        <div className="flex justify-center">
           <button className="bg-[#1e293b] px-4 py-1.5 rounded-full border border-[#233348] flex items-center gap-2 text-xs font-bold text-slate-300 active:bg-[#233348]">
              Junho 2024 <span className="material-symbols-outlined text-sm">expand_more</span>
           </button>
        </div>

        {/* Card Principal Azul com Gradiente e Visibilidade */}
        <div className="bg-primary rounded-[32px] p-8 shadow-[0_20px_40px_rgba(19,109,236,0.3)] relative overflow-hidden group">
           <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-[60px] pointer-events-none"></div>
           
           <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-blue-100 text-sm font-medium">Saldo Total Estimado</span>
              <button 
                onClick={() => setSaldoVisivel(!saldoVisivel)} 
                className="text-white/80 hover:text-white transition-colors p-1"
              >
                 <span className="material-symbols-outlined text-[22px]">{saldoVisivel ? 'visibility' : 'visibility_off'}</span>
              </button>
           </div>
           
           <div className="mb-8 relative z-10">
              <h2 className="text-5xl font-black tracking-tighter">
                 {saldoVisivel ? `R$ ${totalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••••'}
              </h2>
           </div>

           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2 text-blue-100 text-sm font-bold">
                 <span className="material-symbols-outlined text-[18px]">trending_up</span>
                 +12% vs mês anterior
              </div>
              <button 
                onClick={() => showToast('Acessando extrato detalhado...', 'info')}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors active:scale-95"
              >
                 Ver Extrato
              </button>
           </div>
        </div>

        {/* Grid Salário e Produtividade Reais */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-[#192433] rounded-[24px] p-5 border border-[#233348] shadow-lg">
              <div className="size-10 bg-[#111822] rounded-xl flex items-center justify-center text-primary mb-4 border border-[#233348]">
                 <span className="material-symbols-outlined fill text-[20px]">account_balance_wallet</span>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Salário<br/>Fixo</p>
              <p className="text-xl font-black text-white mt-2">R$ {salarioFixo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-slate-500 font-bold mt-1">Base Contratual</p>
           </div>
           
           <div className="bg-[#192433] rounded-[24px] p-5 border border-[#233348] shadow-lg">
              <div className="size-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-4 border border-emerald-500/10">
                 <span className="material-symbols-outlined fill text-[20px]">router</span>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Produtividade</p>
              <p className="text-xl font-black text-white mt-2">R$ {produtividadeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-emerald-500 font-bold mt-1">{totalModemsColetados} modems coletados</p>
           </div>
        </div>

        {/* Meta Mensal Dinâmica */}
        <div className="bg-[#192433] rounded-[24px] p-6 border border-[#233348] shadow-lg">
           <div className="flex justify-between items-start mb-1">
              <h3 className="text-lg font-black text-white">Meta Mensal</h3>
              <span className="text-primary font-black text-lg">{Math.round(progress)}%</span>
           </div>
           <p className="text-slate-500 text-xs font-bold mb-5">
              {faltaParaBonus > 0 
                ? `Falta R$ ${faltaParaBonus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para o bônus extra` 
                : 'Meta de bônus atingida! Parabéns!'}
           </p>
           
           <div className="w-full h-3 bg-[#111822] rounded-full overflow-hidden mb-3 border border-[#233348]">
              <div 
                className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(19,109,236,0.6)] transition-all duration-1000 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
           </div>
           
           <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span>R$ 0</span>
              <span>Meta: R$ {metaMensalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
           </div>
        </div>

        {/* Histórico de Recolhimento Agrupado por Rota */}
        <div className="space-y-4 pb-10">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-lg font-black text-white tracking-tight">Histórico de Recolhimento</h3>
              <button 
                onClick={() => showToast('Carregando histórico completo...', 'info')}
                className="text-sm font-bold text-primary active:opacity-50"
              >
                Ver tudo
              </button>
           </div>
           
           <div className="space-y-3">
              {routesHistory.length > 0 ? routesHistory.map((item, idx) => (
                 <div key={idx} className="bg-[#192433] rounded-[24px] p-5 border border-[#233348] flex items-center gap-4 active:bg-[#233348] transition-colors group">
                    <div className="size-12 bg-[#111822] rounded-2xl flex items-center justify-center text-slate-500 border border-[#233348] group-active:text-primary transition-colors">
                       <span className="material-symbols-outlined">calendar_today</span>
                    </div>
                    <div className="flex-1 min-w-0">
                       <h4 className="font-black text-white text-base leading-tight truncate">{item.name}</h4>
                       <p className="text-xs text-slate-500 font-bold mt-1">{item.date} • {item.units} unidades</p>
                    </div>
                    <div className="text-right">
                       <p className="text-emerald-500 font-black text-base tracking-tight">+ R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                       <span className="text-[9px] font-black text-slate-400 bg-[#111822] px-2 py-0.5 rounded border border-[#233348] mt-1 inline-block uppercase tracking-wider">
                          CONFIRMADO
                       </span>
                    </div>
                 </div>
              )) : (
                <div className="py-12 px-6 text-center bg-[#192433] rounded-[24px] border border-dashed border-[#233348] flex flex-col items-center gap-3">
                   <div className="size-16 bg-[#111822] rounded-full flex items-center justify-center text-slate-700">
                      <span className="material-symbols-outlined text-4xl">payments</span>
                   </div>
                   <div>
                      <p className="text-white font-black uppercase text-xs tracking-widest">Sem ganhos recentes</p>
                      <p className="text-slate-500 text-[10px] mt-1">Conclua coletas no seu roteiro para gerar produtividade.</p>
                   </div>
                </div>
              )}
           </div>
        </div>

      </div>

      {/* Botão Flutuante (FAB) de Download */}
      <button 
        onClick={() => showToast('Exportando relatório financeiro (PDF)...', 'success')}
        className="fixed bottom-24 right-6 size-16 bg-primary rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_rgba(19,109,236,0.5)] active:scale-90 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-[32px]">download</span>
      </button>

    </div>
  );
};
