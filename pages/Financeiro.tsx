import React from 'react';
import { useData } from '../context/DataContext';

export const Financeiro = () => {
  const { collections, technicians, settings } = useData();

  // Settings for calculation
  const RATE_PER_COLLECTION = settings.pricePerCollection || 35.00;

  // Calculate Financial Data per Technician
  const techFinancials = technicians.map(tech => {
    const completed = collections.filter(c => c.driverId === tech.id && c.status === 'Coletado');
    const pending = collections.filter(c => c.driverId === tech.id && c.status === 'Pendente');
    
    const totalToReceive = completed.length * RATE_PER_COLLECTION;
    
    return {
      ...tech,
      completedCount: completed.length,
      pendingCount: pending.length,
      totalToReceive
    };
  }).sort((a, b) => b.totalToReceive - a.totalToReceive);

  // KPIs
  const totalPaid = techFinancials.reduce((acc, curr) => acc + curr.totalToReceive, 0);
  const totalCollections = collections.filter(c => c.status === 'Coletado').length;
  const avgCost = totalCollections > 0 ? totalPaid / totalCollections : 0;
  const totalPendingPayouts = techFinancials.filter(t => t.totalToReceive > 0).length;

  const handleExport = () => {
    if (!window.XLSX) return alert("Biblioteca de exportação não carregada.");
    
    const data = techFinancials.map(t => ({
      ID: t.id,
      Técnico: t.name,
      Função: t.role,
      'Coletas Realizadas': t.completedCount,
      'Valor por Coleta': `R$ ${RATE_PER_COLLECTION.toFixed(2)}`,
      'Total a Receber': `R$ ${t.totalToReceive.toFixed(2)}`,
      Status: t.totalToReceive > 0 ? "A Pagar" : "Em Dia"
    }));

    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Folha de Pagamento");
    window.XLSX.writeFile(wb, `financeiro_vupty_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-y-auto bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-[1440px] mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#92a9c9] hover:text-white text-sm font-medium transition-colors">Home</span>
          <span className="material-symbols-outlined text-[#92a9c9] text-sm">chevron_right</span>
          <span className="text-white text-sm font-medium">Financeiro</span>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Gestão Financeira</h1>
            <p className="text-[#92a9c9] text-base font-normal">Controle de pagamentos baseado nas coletas realizadas.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 border border-[#324867] bg-[#1e293b] text-white text-sm font-bold hover:bg-[#233348] transition-all"
            >
              <span className="material-symbols-outlined text-lg">download</span> Exportar Folha
            </button>
            <button className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-lg">payments</span> Processar Pagamentos
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FinanceCard
            label="Total a Pagar (Acumulado)"
            value={`R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon="attach_money"
            trend="Baseado em coletas"
            trendUp={true}
          />
          <FinanceCard
            label="Técnicos com Saldo"
            value={totalPendingPayouts.toString()}
            icon="pending_actions"
            trend="Aguardando baixa"
            trendColor="text-[#faad14] bg-[#faad14]/10"
          />
          <FinanceCard
            label="Coletas Realizadas"
            value={totalCollections.toString()}
            icon="router"
            trend="+5% hoje"
            trendUp={true}
          />
          <FinanceCard
            label="Custo Médio / Coleta"
            value={`R$ ${avgCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon="analytics"
            trend="Fixo"
            trendColor="text-[#92a9c9] bg-[#92a9c9]/10"
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-4 rounded-xl border border-[#324867] bg-[#1e293b] p-5 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg font-bold">Resumo por Cargo</h3>
            </div>
            <div className="flex flex-col gap-4 mt-2">
              {['Coletor', 'Coletor Sênior', 'Supervisor'].map(role => {
                const roleTotal = techFinancials
                  .filter(t => t.role === role)
                  .reduce((acc, curr) => acc + curr.totalToReceive, 0);
                
                return (
                  <div key={role} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#92a9c9]">{role}</span>
                      <span className="text-white font-bold">R$ {roleTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#111822] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${totalPaid > 0 ? (roleTotal / totalPaid) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col rounded-xl border border-[#324867] bg-[#1e293b] overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 gap-3 border-b border-[#324867]">
              <div className="flex items-center gap-2">
                 <h3 className="text-white font-bold px-2">Detalhamento por Técnico</h3>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#92a9c9] text-lg">search</span>
                <input
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#111822] border border-[#324867] text-white placeholder-[#92a9c9] focus:outline-none focus:border-primary text-sm"
                  placeholder="Buscar técnico..."
                  type="text"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#111822] border-b border-[#324867]">
                  <tr>
                    <th className="p-4 text-[#92a9c9] text-xs font-semibold uppercase w-10">
                      <input className="rounded border-[#324867] bg-[#1e293b] text-primary focus:ring-0" type="checkbox" />
                    </th>
                    <th className="p-4 text-[#92a9c9] text-xs font-semibold uppercase">Técnico</th>
                    <th className="p-4 text-[#92a9c9] text-xs font-semibold uppercase text-center">Coletas</th>
                    <th className="p-4 text-[#92a9c9] text-xs font-semibold uppercase text-right">A Receber</th>
                    <th className="p-4 text-[#92a9c9] text-xs font-semibold uppercase text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#324867]">
                  {techFinancials.map((tech) => (
                    <FinanceRow
                      key={tech.id}
                      name={tech.name}
                      id={tech.id}
                      val={`R$ ${tech.totalToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      coletas={tech.completedCount}
                      status={tech.totalToReceive > 0 ? "A Pagar" : "Em Dia"}
                      statusColor={tech.totalToReceive > 0 ? "bg-[#faad14]/10 text-[#faad14] border-[#faad14]/20" : "bg-[#0bda5e]/10 text-[#0bda5e] border-[#0bda5e]/20"}
                      dotColor={tech.totalToReceive > 0 ? "bg-[#faad14]" : "bg-[#0bda5e]"} // Safe explicit color
                      img={tech.avatar}
                    />
                  ))}
                  {techFinancials.length === 0 && (
                     <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">Nenhum dado financeiro disponível.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FinanceCard = ({ label, value, icon, trend, trendUp, trendColor }: any) => {
  let tc = trendUp ? 'text-[#0bda5e] bg-[#0bda5e]/10' : trendUp === false ? 'text-[#fa6238] bg-[#fa6238]/10' : trendColor;
  let ti = trendUp ? 'trending_up' : trendUp === false ? 'trending_down' : '';

  return (
    <div className="flex flex-col gap-1 rounded-xl p-5 bg-[#1e293b] border border-[#324867] relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <span className="material-symbols-outlined text-5xl text-white">{icon}</span>
      </div>
      <p className="text-[#92a9c9] text-xs font-semibold uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="text-white text-2xl font-bold leading-tight">{value}</p>
        <span className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded mb-1 ${tc}`}>
          {ti && <span className="material-symbols-outlined text-xs mr-0.5">{ti}</span>}
          {trend}
        </span>
      </div>
    </div>
  );
};

const FinanceRow = ({ name, id, val, status, statusColor, dotColor, img, coletas }: any) => (
  <tr className="group hover:bg-[#233348]/40 transition-colors">
    <td className="p-4">
      <input className="rounded border-[#324867] bg-[#1e293b] text-primary focus:ring-0 cursor-pointer" type="checkbox" />
    </td>
    <td className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full overflow-hidden bg-slate-700 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
          <img 
            src={img} 
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${name}&background=1e293b&color=fff`;
            }}
          />
        </div>
        <div className="flex flex-col">
          <p className="text-white text-sm font-semibold">{name}</p>
          <p className="text-[#92a9c9] text-xs">ID: {id}</p>
        </div>
      </div>
    </td>
    <td className="p-4 text-center">
       <span className="text-white font-mono bg-[#111822] px-2 py-1 rounded border border-[#324867]">{coletas}</span>
    </td>
    <td className="p-4 text-white text-sm font-bold text-right">{val}</td>
    <td className="p-4 text-center">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span> {status}
      </span>
    </td>
  </tr>
);