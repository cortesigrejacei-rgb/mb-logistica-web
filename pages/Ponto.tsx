import React from 'react';
import { useData } from '../context/DataContext';
import type { Technician } from '../context/DataContext';

export const Ponto = () => {
  const { technicians, timeEntries } = useData();

  // Helper to determine "Ponto" status based on Time Entries
  const getPontoData = (tech: Technician) => {
    const techEntries = timeEntries.filter(e => e.technician_id === tech.id).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const firstEntry = techEntries.find(e => e.type === 'entry');
    const lastEntry = techEntries[techEntries.length - 1];

    let statusLabel = 'Ausente';
    let statusColor = 'bg-slate-500/10 text-slate-400 border-slate-500/20';

    if (lastEntry) {
      if (lastEntry.type === 'entry' || lastEntry.type === 'lunch_end' || lastEntry.type === 'maintenance_end') {
        statusLabel = 'Trabalhando';
        statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      } else if (lastEntry.type === 'lunch_start') {
        statusLabel = 'Almoço';
        statusColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      } else if (lastEntry.type === 'maintenance_start') {
        statusLabel = 'Manutenção';
        statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      } else if (lastEntry.type === 'exit') {
        statusLabel = 'Encerrado';
        statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
      }
    }

    // Format timestamp
    const formatTime = (isoString?: string) => {
      if (!isoString) return '--:--';
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return {
      statusLabel,
      statusColor,
      inTime: firstEntry ? formatTime(firstEntry.timestamp) : '--:--',
      outTime: lastEntry && lastEntry.type === 'exit' ? formatTime(lastEntry.timestamp) : '--:--',
      lastActivity: lastEntry ? formatTime(lastEntry.timestamp) : '--:--',
      lat: lastEntry?.lat || tech.lat,
      lng: lastEntry?.lng || tech.lng
    };
  };

  const activeCount = technicians.filter(t => t.status === 'Online' || t.status === 'Em Rota').length;
  const totalCount = technicians.length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scrollbar-thin h-full bg-background-light dark:bg-background-dark">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-white text-3xl md:text-4xl font-extrabold tracking-tight">Controle de Jornada</h2>
            <p className="text-slate-400 text-base font-normal">
              Gestão de entrada, saída e status dos técnicos em tempo real.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center justify-center gap-2 h-10 px-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg border border-slate-700 transition-colors">
              <span className="material-symbols-outlined text-[20px]">print</span>
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button className="flex items-center justify-center gap-2 h-10 px-4 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/25 transition-colors">
              <span className="material-symbols-outlined text-[20px]">download</span>
              <span>Exportar Relatório</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PontoCard
            title="Técnicos Ativos"
            value={`${activeCount} / ${totalCount}`}
            change="Hoje"
            icon="group"
            color="text-primary"
            barColor="bg-primary"
            percentage={(activeCount / totalCount) * 100}
          />
          <PontoCard title="Atrasos" value="0" change="Hoje" icon="warning" color="text-orange-500" barColor="bg-orange-500" percentage={0} />
          <PontoCard title="Horas Extras" value="0h" change="Acumulado" icon="timer" color="text-blue-400" barColor="bg-blue-400" percentage={0} />
          <PontoCard title="Ausências" value={(totalCount - activeCount).toString()} change="Justificadas" icon="person_off" color="text-rose-500" barColor="bg-rose-500" percentage={((totalCount - activeCount) / totalCount) * 100} />
        </div>

        <div className="flex flex-col rounded-xl border border-slate-700/50 bg-surface-dark overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800/50 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-semibold w-16">Avatar</th>
                  <th className="px-6 py-4 font-semibold">Técnico</th>
                  <th className="px-6 py-4 font-semibold">Status Ponto</th>
                  <th className="px-6 py-4 font-semibold">Entrada</th>
                  <th className="px-6 py-4 font-semibold">Saída</th>
                  <th className="px-6 py-4 font-semibold">Última Ativ.</th>
                  <th className="px-6 py-4 font-semibold text-right">Localização</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-700/50">
                {technicians.map(tech => {
                  const data = getPontoData(tech);
                  return (
                    <PontoRow
                      key={tech.id}
                      name={tech.name}
                      id={tech.id}
                      status={data.statusLabel}
                      statusColor={data.statusColor}
                      inTime={data.inTime}
                      outTime={data.outTime}
                      lastActivity={data.lastActivity}
                      img={tech.avatar}
                      lat={data.lat}
                      lng={data.lng}
                    />
                  );
                })}
                {technicians.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">Nenhum técnico cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const PontoCard = ({ title, value, change, icon, color, barColor, percentage }: any) => (
  <div className="flex flex-col gap-3 rounded-xl p-5 bg-surface-dark border border-slate-700/50 hover:border-slate-600 transition-colors relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <span className={`material-symbols-outlined text-6xl ${color}`}>{icon}</span>
    </div>
    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
    <div className="flex items-end gap-3">
      <p className="text-white text-3xl font-bold leading-none">{value}</p>
      <span className={`text-sm font-bold flex items-center ${color.replace('text-', 'text-')}`}>
        {change}
      </span>
    </div>
    <div className="w-full bg-slate-700/50 h-1 rounded-full mt-1">
      <div className={`${barColor} h-1 rounded-full`} style={{ width: `${percentage || 0}%` }}></div>
    </div>
  </div>
);

const PontoRow = ({ name, id, status, statusColor, inTime, outTime, lastActivity, img, lat, lng }: any) => (
  <tr className="hover:bg-slate-800/30 transition-colors group">
    <td className="px-6 py-4">
      <div className="size-10 rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-700">
        <img
          src={img}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://ui-avatars.com/api/?name=${name}&background=1e293b&color=fff`;
          }}
        />
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="flex flex-col">
        <span className="text-white font-semibold">{name}</span>
        <span className="text-slate-500 text-xs">ID: {id}</span>
      </div>
    </td>
    <td className="px-6 py-4">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
        {status}
      </span>
    </td>
    <td className="px-6 py-4 text-white font-medium">{inTime}</td>
    <td className="px-6 py-4 text-slate-600">{outTime}</td>
    <td className="px-6 py-4 text-slate-400">{lastActivity}</td>
    <td className="px-6 py-4 text-right">
      <div className="flex justify-end gap-2">
        {lat && lng ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-bold transition-colors border border-slate-700"
          >
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            Ver no Mapa
          </a>
        ) : (
          <span className="text-slate-600 text-xs italic">Sem localização</span>
        )}
      </div>
    </td>
  </tr>
);