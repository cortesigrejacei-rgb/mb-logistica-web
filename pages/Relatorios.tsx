import React from 'react';
import { useData } from '../context/DataContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export const Relatorios = () => {
  const { collections, technicians, settings } = useData();

  const [dateRange, setDateRange] = React.useState<'today' | 'week' | 'month' | 'all'>('week');

  // Filter collections based on date range
  const filteredCollections = collections.filter(c => {
    if (dateRange === 'all') return true;
    const date = new Date(c.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === 'today') {
      const cDate = new Date(date);
      cDate.setHours(0, 0, 0, 0);
      return cDate.getTime() === today.getTime();
    }
    if (dateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }
    if (dateRange === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return date >= monthAgo;
    }
    return true;
  });

  // Calculate General Stats
  const totalCollections = filteredCollections.length;
  const completed = filteredCollections.filter(c => c.status === 'Coletado').length;
  const failed = filteredCollections.filter(c => c.status === 'Falha').length;
  const pending = filteredCollections.filter(c => c.status === 'Pendente').length;
  const inRoute = filteredCollections.filter(c => c.status === 'Em Rota').length;

  // Success Rate
  const finishedTotal = completed + failed;
  const successRate = finishedTotal > 0 ? ((completed / finishedTotal) * 100).toFixed(1) : '0';

  // Revenue
  const revenuePending = pending * (settings.pricePerCollection || 35);
  const revenueRealized = completed * (settings.pricePerCollection || 35);

  // --- CHART DATA PREPARATION ---

  // 1. Trend Data (Area Chart)
  // Group by date (DD/MM)
  const trendMap = filteredCollections.reduce((acc: any, curr) => {
    const dateKey = new Date(curr.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (!acc[dateKey]) acc[dateKey] = { name: dateKey, total: 0, completed: 0 };
    acc[dateKey].total += 1;
    if (curr.status === 'Coletado') acc[dateKey].completed += 1;
    return acc;
  }, {});

  const trendData = Object.values(trendMap).sort((a: any, b: any) => {
    // Basic sort by date string (DD/MM) - simplistic for same year
    const [da, ma] = a.name.split('/');
    const [db, mb] = b.name.split('/');
    return new Date(2024, ma - 1, da).getTime() - new Date(2024, mb - 1, db).getTime();
  });

  // 2. Status Distribution (Pie Chart)
  const pieData = [
    { name: 'Coletado', value: completed, color: '#0bda5e' },
    { name: 'Em Rota', value: inRoute, color: '#136dec' },
    { name: 'Pendente', value: pending, color: '#fbbf24' },
    { name: 'Falha', value: failed, color: '#fa6238' },
  ].filter(d => d.value > 0);

  // Top Technicians
  const techStats = technicians.map(tech => {
    const techCollections = filteredCollections.filter(c => c.driverId === tech.id);
    const techCompleted = techCollections.filter(c => c.status === 'Coletado').length;
    const techTotal = techCollections.length;
    const techSuccess = techTotal > 0 ? Math.round((techCompleted / techTotal) * 100) : 0;
    return { ...tech, score: techSuccess, completed: techCompleted };
  }).sort((a, b) => b.completed - a.completed).slice(0, 5); // Increased to 5

  const handleExport = () => {
    // ... existing export logic ...
    const headers = ["ID", "Cliente", "Endereço", "Status", "Data", "Técnico", "Equipamento", "Serial"];
    const rows = filteredCollections.map(c => [
      c.id, `"${c.client}"`, `"${c.address}"`, c.status, c.date,
      technicians.find(t => t.id === c.driverId)?.name || 'N/A', `"${c.notes || ''}"`, c.serialNumber || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `relatorio_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark relative scrollbar-thin">
      <div className="px-6 md:px-10 lg:px-16 flex flex-1 justify-center py-8">
        <div className="flex flex-col max-w-[1200px] flex-1 gap-8">

          {/* Header */}
          <div className="flex flex-wrap justify-between items-end gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">Relatórios</h2>
              <p className="text-[#92a9c9]">Análise detalhada da operação.</p>
            </div>
            <div className="flex gap-3">
              <select
                className="h-10 rounded-lg bg-[#233348] px-4 text-white text-sm font-bold border-none focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
              >
                <option value="today">Hoje</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mês</option>
                <option value="all">Tudo</option>
              </select>
              <button onClick={handleExport} className="h-10 px-4 rounded-lg bg-primary text-white font-bold hover:bg-blue-600 transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">download</span> CSV
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportCard title="Total" value={totalCollections} icon="list_alt" color="text-white" trend="Volumes" />
            <ReportCard title="Coletados" value={completed} icon="check_circle" color="text-emerald-400" trend={`${successRate}% Success`} trendColor={Number(successRate) > 80 ? "text-emerald-500" : "text-orange-500"} />
            <ReportCard title="Pendentes" value={pending} icon="pending" color="text-amber-400" trend="Aguardando" />
            <ReportCard title="Receita (Est.)" value={`R$ ${revenueRealized}`} icon="payments" color="text-blue-400" trend={`+ R$ ${revenuePending} pend.`} trendColor="text-slate-400" />
          </div>

          {/* CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
            {/* Area Chart: Trend */}
            <div className="lg:col-span-2 bg-[#1a232e] rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col">
              <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">ssid_chart</span>
                Evolução das Coletas
              </h3>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0bda5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0bda5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" name="Total" strokeWidth={2} />
                    <Area type="monotone" dataKey="completed" stroke="#0bda5e" fillOpacity={1} fill="url(#colorCompleted)" name="Coletados" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart: Status */}
            <div className="lg:col-span-1 bg-[#1a232e] rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col">
              <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-white">pie_chart</span>
                Distribuição
              </h3>
              <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centered Total */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                  <div className="text-center">
                    <span className="text-2xl font-black text-white block">{totalCollections}</span>
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Total</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Technicians List */}
          <div className="bg-[#1a232e] rounded-2xl p-6 border border-slate-800">
            <h3 className="text-white font-bold mb-4">Top Performance (Volume)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {techStats.map(tech => (
                <TechItem key={tech.id} {...tech} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const ReportCard = ({ title, value, icon, color, trend, trendColor = 'text-slate-500' }: any) => (
  <div className="bg-[#1a232e] p-5 rounded-2xl border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-colors">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
      <span className="material-symbols-outlined text-6xl">{icon}</span>
    </div>
    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{title}</p>
    <div className={`text-3xl font-black ${color} tracking-tight`}>{value}</div>
    <p className={`text-xs font-bold mt-1 ${trendColor}`}>{trend}</p>
  </div>
);

const TechItem = ({ name, role, score, completed, avatar }: any) => (
  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0f172a] border border-slate-800 hover:border-slate-700 transition-colors">
    <div className="size-10 rounded-full bg-slate-700 overflow-hidden">
      <img src={avatar} alt="" className="w-full h-full object-cover" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white font-bold text-sm truncate">{name}</p>
      <p className="text-slate-500 text-xs truncate">{role || 'Técnico'}</p>
    </div>
    <div className="text-right">
      <div className="text-white font-black text-sm">{completed}</div>
      <div className={`text-xs font-bold ${score >= 80 ? 'text-emerald-400' : 'text-orange-400'}`}>{score}%</div>
    </div>
  </div>
);