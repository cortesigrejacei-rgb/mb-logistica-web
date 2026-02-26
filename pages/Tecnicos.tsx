import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import type { Technician } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';

export const Tecnicos = () => {
  const { technicians, deleteTechnician, updateTechnician, collections, showToast } = useData();
  const navigate = useNavigate();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Goal State
  const [editingGoal, setEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState<number>(0);

  // Schedule State - Moved to top level
  // Structure: { sun: bool, ..., exceptions: ['YYYY-MM-DD'] }
  const [workSchedule, setWorkSchedule] = useState<any>({ sun: false, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, exceptions: [] });

  const openDetailModal = (tech: Technician) => {
    setSelectedTech(tech);
    setNewGoal(tech.monthly_goal || 100);
    setWorkSchedule(tech.work_schedule || { sun: false, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, exceptions: [] });
    setIsDetailModalOpen(true);
  };

  const handleToggleDay = async (day: string) => {
    if (!selectedTech) return;
    const newSchedule = { ...workSchedule, [day]: !workSchedule[day] };
    setWorkSchedule(newSchedule);

    // Auto-save schedule
    updateSchedule(newSchedule);
  };

  const handleToggleException = (dateStr: string) => {
    if (!selectedTech) return;
    const currentExceptions = workSchedule.exceptions || [];
    let newExceptions;

    if (currentExceptions.includes(dateStr)) {
      newExceptions = currentExceptions.filter((d: string) => d !== dateStr);
    } else {
      newExceptions = [...currentExceptions, dateStr];
    }

    const newSchedule = { ...workSchedule, exceptions: newExceptions };
    setWorkSchedule(newSchedule);
    updateSchedule(newSchedule);
  }

  const updateSchedule = async (newSchedule: any) => {
    if (!selectedTech) return;
    try {
      const updatedTech = { ...selectedTech, work_schedule: newSchedule };
      setSelectedTech(updatedTech);
      await updateTechnician(selectedTech.id, { work_schedule: newSchedule });
    } catch (error) {
      console.error("Failed to save schedule", error);
      showToast("Erro ao salvar jornada", "error");
    }
  }

  const handleUpdateGoal = async () => {
    if (!selectedTech) return;
    try {
      await updateTechnician(selectedTech.id, { monthly_goal: newGoal });
      setSelectedTech({ ...selectedTech, monthly_goal: newGoal });
      setEditingGoal(false);
    } catch (error) {
      console.error(error);
      showToast("Erro ao atualizar meta", "error");
    }
  };

  // Helper to get days in month
  const getDaysInMonth = (month: number, year: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  // KPI Calculations
  const getTechStats = (techId: string) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter collections for this tech in current month
    const monthlyCollections = collections.filter(c => {
      const d = new Date(c.date);
      return c.driverId === techId &&
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear &&
        c.status === 'Coletado';
    });

    const totalCollected = monthlyCollections.length;
    const goal = selectedTech?.monthly_goal || 100;

    // Daily Calculation
    const today = new Date();
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // Count remaining working days
    let remainingDays = 0;
    const schedule = selectedTech?.work_schedule || workSchedule;
    const exceptions = schedule.exceptions || [];
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // Iterate through remaining days of the month
    for (let d = new Date(today); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dayIndex = d.getDay();
      const dayKey = dayMap[dayIndex];
      const dateStr = d.toISOString().split('T')[0];

      const isBaseWorkingDay = (schedule as any)[dayKey];
      const isException = exceptions.includes(dateStr);

      // XOR Logic: If Exception, flip the base rule
      // Base=True, Except=False -> Working
      // Base=True, Except=True -> OFF
      // Base=False, Except=True -> Working
      // Base=False, Except=False -> OFF
      // Simplified: Working if (Base AND !Except) OR (!Base AND Except) -> Base !== Except

      const isWorkingDay = isBaseWorkingDay ? !isException : isException;

      if (isWorkingDay) remainingDays++;
    }

    const remainingToGoal = Math.max(0, goal - totalCollected);
    const dailyTarget = remainingDays > 0 ? Math.ceil(remainingToGoal / remainingDays) : 0;

    // Success Rate (Collected / (Em Rota + Pendente + Coletado + Falha))
    const allTasksThisMonth = collections.filter(c => {
      const d = new Date(c.date);
      return c.driverId === techId && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const successRate = allTasksThisMonth > 0 ? Math.round((totalCollected / allTasksThisMonth) * 100) : 0;

    return { totalCollected, dailyTarget, remainingDays, successRate, goal };
  };

  const filteredTechnicians = technicians.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    if (!(window as any).XLSX) return alert("Biblioteca de exportação não carregada.");
    const data = filteredTechnicians.map(t => ({
      ID: t.id, Nome: t.name, Email: t.email, Função: t.role, Status: t.status, Meta: t.monthly_goal
    }));
    const ws = (window as any).XLSX.utils.json_to_sheet(data);
    const wb = (window as any).XLSX.utils.book_new();
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Técnicos");
    (window as any).XLSX.writeFile(wb, `tecnicos_mb_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const today = new Date().toISOString().split('T')[0];
  const collectionsToday = collections.filter(c => c.date === today).length;
  const onlineTechs = technicians.filter(t => t.status === 'Online' || t.status === 'Em Rota').length;

  // Derived stats for Modal
  const stats = selectedTech ? getTechStats(selectedTech.id) : { totalCollected: 0, dailyTarget: 0, remainingDays: 0, successRate: 0, goal: 100 };
  const calendarDays = getDaysInMonth(new Date().getMonth(), new Date().getFullYear());
  const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];


  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-dark font-display">
      <header className="flex-shrink-0 px-6 py-6 md:px-10 border-b border-border-dark bg-background-dark/95 backdrop-blur z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Equipe MB Logística</h2>
            <p className="text-slate-400 mt-1">Gestão de ativos humanos e monitoramento operacional.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl border border-border-dark bg-surface-dark text-slate-300 text-sm font-bold hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">download</span> Exportar
            </button>
            <button
              onClick={() => navigate('/tecnicos/novo')}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white text-sm font-black shadow-lg shadow-primary/30 transition-all flex items-center gap-2 uppercase tracking-widest"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span> Adicionar
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatBox title="Total" value={technicians.length} change="Técnicos" icon="groups" color="blue" />
          <StatBox title="Ativos" value={onlineTechs} change="Em Campo" icon="sensors" color="emerald" />
          <StatBox title="Hoje" value={collectionsToday} change="Demandas" icon="fact_check" color="orange" />
        </div>

        <div className="bg-surface-dark rounded-t-2xl border border-border-dark border-b-0 p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input
              className="block w-full pl-10 pr-3 py-3 bg-background-dark border border-border-dark rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
              placeholder="Buscar técnico..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full overflow-hidden rounded-b-2xl border border-border-dark bg-surface-dark">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-background-dark border-b border-border-dark">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[2px]">Técnico</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[2px] text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[2px] text-center">Meta (Mês)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[2px] text-center">Bateria</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[2px] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark">
                {filteredTechnicians.map((tech) => (
                  <tr key={tech.id}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => openDetailModal(tech)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-border-dark shadow-lg">
                          <img src={tech.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white">{tech.name}</div>
                          <div className="text-xs text-slate-500 font-medium">{tech.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${tech.status === 'Online' || tech.status === 'Em Rota' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tech.status === 'Online' || tech.status === 'Em Rota' ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                        {tech.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-xs font-bold text-slate-300 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                        {tech.monthly_goal || 100}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center items-center gap-1">
                        {(tech.battery_level !== undefined && tech.battery_level !== -1) ? (
                          <div className="flex items-center gap-1 text-xs text-slate-400 font-bold">
                            <span className="material-symbols-outlined text-[16px] text-slate-500">battery_std</span>
                            {tech.battery_level}%
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={(e) => {
                          e.stopPropagation();
                          console.log("Navigating to:", tech.id);
                          navigate(`/tecnicos/editar/${encodeURIComponent(tech.id)}`);
                        }} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[22px]">edit</span>
                        </button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          deleteTechnician(tech.id);
                        }} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                          <span className="material-symbols-outlined text-[22px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Detalhes do Técnico */}
      {isDetailModalOpen && selectedTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)}></div>
          <div className="relative bg-[#0f172a] h-full w-full max-w-2xl border-l border-[#233348] shadow-2xl animate-slideLeft flex flex-col">

            {/* Header */}
            <div className="p-6 border-b border-[#233348] flex justify-between items-start bg-[#1a232e]">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-full overflow-hidden border-2 border-primary shadow-xl">
                  <img src={selectedTech.avatar} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedTech.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${selectedTech.status === 'Online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                      {selectedTech.status}
                    </span>
                    <span className="text-xs text-slate-500">{selectedTech.email}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">

              {/* Metas e KPIs */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500">flag</span>
                    Desempenho & Metas
                  </h3>
                  {!editingGoal && (
                    <button onClick={() => setEditingGoal(true)} className="text-xs font-bold text-primary hover:text-blue-400">
                      Ajustar Meta Mensal
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Meta Mensal Card */}
                  <div className="bg-[#1a232e] p-5 rounded-2xl border border-[#233348] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-6xl text-purple-500">target</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Meta Mensal</p>

                    {editingGoal ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-24 bg-[#080c14] border border-primary rounded-lg px-2 py-1 text-white font-mono font-bold outline-none"
                          value={newGoal}
                          onChange={e => setNewGoal(parseInt(e.target.value) || 0)}
                          autoFocus
                        />
                        <button onClick={handleUpdateGoal} className="p-1.5 bg-primary rounded-lg text-white hover:bg-blue-600">
                          <span className="material-symbols-outlined text-sm">check</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-3xl font-black text-white">{stats.goal}</div>
                    )}
                    <div className="mt-2 w-full bg-[#080c14] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-1000"
                        style={{ width: `${Math.min(100, (stats.totalCollected / stats.goal) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-right text-slate-500 mt-1 font-mono">
                      {Math.round((stats.totalCollected / stats.goal) * 100)}% Concluído
                    </p>
                  </div>

                  {/* Executado Card */}
                  <div className="bg-[#1a232e] p-5 rounded-2xl border border-[#233348]">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Coletas Realizadas</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-emerald-400">{stats.totalCollected}</span>
                      <span className="text-xs text-slate-500 font-bold">de {stats.goal}</span>
                    </div>
                    <p className="text-[10px] mt-2 text-slate-400">
                      Média diária atual: <span className="text-white font-bold">{stats.totalCollected > 0 ? (stats.totalCollected / (new Date().getDate())).toFixed(1) : 0}</span>
                    </p>
                  </div>
                </div>
              </section>

              {/* Cálculo Dinâmico */}
              <section className="bg-gradient-to-br from-blue-900/20 to-[#1a232e] p-6 rounded-3xl border border-blue-500/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1">Ritmo Necessário</h4>
                    <p className="text-sm text-slate-300">
                      Para atingir a meta de <strong className="text-white">{stats.goal}</strong> até o fim do mês:
                    </p>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Faltam</span>
                        <span className="text-xl font-black text-white">{Math.max(0, stats.goal - stats.totalCollected)}</span>
                      </div>
                      <div className="w-px h-8 bg-white/10"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dias Úteis</span>
                        <span className="text-xl font-black text-white">{stats.remainingDays}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#233348] text-center min-w-[140px] shadow-xl">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Meta Diária Dinâmica</p>
                    <div className="text-4xl font-black text-white tracking-tighter">{stats.dailyTarget}</div>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">Coletas / Dia</p>
                  </div>
                </div>
              </section>

              {/* Jornada de Trabalho */}
              <section>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-orange-500">calendar_month</span>
                  Jornada de Trabalho (Cálculo de Meta)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'sun', label: 'Dom' }, { id: 'mon', label: 'Seg' }, { id: 'tue', label: 'Ter' },
                    { id: 'wed', label: 'Qua' }, { id: 'thu', label: 'Qui' }, { id: 'fri', label: 'Sex' },
                    { id: 'sat', label: 'Sab' }
                  ].map(day => (
                    <button
                      key={day.id}
                      onClick={() => handleToggleDay(day.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${workSchedule[day.id as keyof typeof workSchedule]
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-[#1a232e] border-[#233348] text-slate-500 hover:border-slate-500'
                        }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Outras Infos */}
              <section>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-slate-500">info</span>
                  Dados Operacionais
                </h3>
                <div className="bg-[#1a232e] rounded-xl border border-[#233348] divide-y divide-[#233348]">
                  <div className="p-4 flex justify-between">
                    <span className="text-sm text-slate-300">Taxa de Sucesso</span>
                    <span className="text-sm font-bold text-emerald-400">{stats.successRate}%</span>
                  </div>
                  <div className="p-4 flex justify-between">
                    <span className="text-sm text-slate-300">Nível de Bateria Atual</span>
                    <span className="text-sm font-bold text-white">{selectedTech.battery_level || 0}%</span>
                  </div>
                  <div className="p-4 flex justify-between">
                    <span className="text-sm text-slate-300">Última Sincronização</span>
                    <span className="text-sm font-mono text-slate-500">
                      {selectedTech.last_seen ? new Date(selectedTech.last_seen).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </section>

              <div className="pt-8 border-t border-[#233348] flex justify-end">
                <button onClick={() => {
                  navigate(`/tecnicos/editar/${encodeURIComponent(selectedTech.id)}`);
                }} className="px-6 py-3 bg-[#233348] hover:bg-[#324867] text-white font-bold rounded-xl transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">edit</span> Editar Dados Cadastrais
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const StatBox = ({ title, value, change, icon, color }: any) => (
  <div className="p-6 rounded-2xl border border-border-dark bg-surface-dark/50 flex flex-col gap-1 shadow-sm hover:border-primary/20 transition-all">
    <div className="flex items-center justify-between mb-2">
      <span className="text-slate-500 font-black text-[10px] uppercase tracking-widest">{title}</span>
      <div className={`p-2.5 bg-${color}-500/10 rounded-xl`}>
        <span className={`material-symbols-outlined text-${color}-500 text-[20px] fill`}>{icon}</span>
      </div>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-black text-white tracking-tighter">{value}</span>
      <span className="text-slate-400 text-xs font-bold">{change}</span>
    </div>
  </div>
);
