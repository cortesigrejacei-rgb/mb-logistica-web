import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import type { StockItem } from '../context/DataContext';

export const Estoque = () => {
  const { stockItems, addStockItem, updateStockItem, deleteStockItem, technicians } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newModel, setNewModel] = useState('Nokia G-240W-A');
  const [newSerial, setNewSerial] = useState('');
  const [newStatus, setNewStatus] = useState('Usado');
  const [newLocation, setNewLocation] = useState('Estoque Central');

  const openModal = (item?: StockItem) => {
    if (item) {
      setEditingId(item.id);
      setNewModel(item.model);
      setNewSerial(item.serial);
      setNewStatus(item.status);
      setNewLocation(item.location);
    } else {
      setEditingId(null);
      setNewModel('Nokia G-240W-A');
      setNewSerial('');
      setNewStatus('Usado');
      setNewLocation('Estoque Central');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateStockItem(editingId, {
        model: newModel,
        serial: newSerial,
        status: newStatus as any,
        location: newLocation
      });
    } else {
      addStockItem({
        model: newModel,
        serial: newSerial,
        status: newStatus as any,
        location: newLocation
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este item do estoque?')) {
      deleteStockItem(id);
    }
  };

  const filteredStock = stockItems.filter(item =>
    item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.serial.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background-light dark:bg-background-dark h-full">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Visão Geral de Estoque</h1>
            <p className="text-text-secondary mt-1">Monitoramento em tempo real de equipamentos.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500">search</span>
              <input
                type="text"
                placeholder="Buscar Serial/Modelo..."
                className="bg-[#111822] border border-[#233348] text-white pl-10 pr-4 py-2 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary w-64"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Nova Entrada
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StockCard label="Total em Estoque" value={stockItems.length} trend="items" trendUp={true} icon="inventory_2" />
          <StockCard label="Novos" value={stockItems.filter(i => i.status === 'Novo').length} trend="reserva" trendUp={true} icon="new_releases" />
          <StockCard label="Em Manutenção" value={stockItems.filter(i => i.status === 'Defeito').length} trend="trocas" trendUp={false} icon="build" />
          <StockCard label="Em Trânsito" value={stockItems.filter(i => i.status === 'Em Trânsito').length} trend="rotas" trendUp={true} icon="local_shipping" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card-dark rounded-xl border border-border-dark flex flex-col h-[500px]">
            <div className="p-5 border-b border-border-dark flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Itens Recentes</h3>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="text-text-secondary sticky top-0 bg-card-dark z-10">
                  <tr>
                    <th className="p-5 border-b border-border-dark">Foto</th>
                    <th className="p-5 border-b border-border-dark">Serial</th>
                    <th className="p-5 border-b border-border-dark">Modelo</th>
                    <th className="p-5 border-b border-border-dark">Localização</th>
                    <th className="p-5 border-b border-border-dark">Status</th>
                    <th className="p-5 border-b border-border-dark">Notas</th>
                    <th className="p-5 border-b border-border-dark">Data</th>
                    <th className="p-5 border-b border-border-dark text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {console.log("Rendering Stock Items:", filteredStock)}
                  {filteredStock.map((item) => (
                    <tr key={item.id} className="border-b border-border-dark hover:bg-[#2c4059]/50 group">
                      <td className="p-5">
                        {item.proofUrl ? (
                          <div className="w-10 h-10 rounded overflow-hidden border border-border-dark cursor-pointer hover:scale-150 transition-transform bg-black" onClick={() => window.open(item.proofUrl, '_blank')}>
                            <img src={item.proofUrl} alt="Proof" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded bg-[#111822] flex items-center justify-center border border-border-dark">
                            <span className="material-symbols-outlined text-slate-600 text-xs">image_not_supported</span>
                          </div>
                        )}
                      </td>
                      <td className="p-5 font-mono text-xs">{item.serial}</td>
                      <td className="p-5 text-text-secondary">{item.model}</td>
                      <td className="p-5">{item.location}</td>
                      <td className="p-5">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="p-5 text-xs text-text-secondary max-w-[200px] truncate" title={item.notes}>
                        {item.notes || '-'}
                      </td>
                      <td className="p-5 text-xs text-text-secondary">{item.updatedAt}</td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(item)} className="p-1 hover:text-white text-slate-400" title="Editar">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 hover:text-red-500 text-slate-400" title="Excluir">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">Nenhum item encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card-dark rounded-xl border border-border-dark flex flex-col h-[500px]">
            <div className="p-5 border-b border-border-dark">
              <h3 className="text-white font-bold text-lg">Distribuição</h3>
            </div>
            <div className="p-5 flex flex-col gap-6 justify-center flex-1">
              <div className="flex flex-col items-center justify-center relative">
                {/* Simple CSS Donut Chart representation */}
                <div className="w-32 h-32 rounded-full border-[12px] border-[#233348] border-t-primary border-r-emerald-500 flex items-center justify-center">
                  <div className="text-center">
                    <span className="block text-2xl font-bold text-white">{stockItems.length}</span>
                    <span className="text-xs text-slate-400">Total</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <InventoryLegend color="bg-primary" label="Novos" value={stockItems.filter(i => i.status === 'Novo').length} />
                <InventoryLegend color="bg-emerald-500" label="Usados" value={stockItems.filter(i => i.status === 'Usado').length} />
                <InventoryLegend color="bg-yellow-500" label="Em Trânsito" value={stockItems.filter(i => i.status === 'Em Trânsito').length} />
                <InventoryLegend color="bg-red-500" label="Defeito" value={stockItems.filter(i => i.status === 'Defeito').length} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Add/Edit Item */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-[#1e293b] rounded-2xl border border-[#233348] w-full max-w-md shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">{editingId ? 'Editar Item' : 'Novo Item de Estoque'}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modelo</label>
                <select
                  className="w-full mt-1 bg-[#111822] border border-[#233348] text-white rounded-lg p-2.5"
                  value={newModel}
                  onChange={e => setNewModel(e.target.value)}
                >
                  <option>Nokia G-240W-A</option>
                  <option>FiberHome HG6145</option>
                  <option>Huawei HG8145</option>
                  <option>ZTE F670L</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Serial Number (S/N)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ALCL..."
                  className="w-full mt-1 bg-[#111822] border border-[#233348] text-white rounded-lg p-2.5 focus:ring-primary focus:border-primary"
                  value={newSerial}
                  onChange={e => setNewSerial(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                  <select
                    className="w-full mt-1 bg-[#111822] border border-[#233348] text-white rounded-lg p-2.5"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                  >
                    <option value="Novo">Novo</option>
                    <option value="Usado">Usado</option>
                    <option value="Defeito">Defeito</option>
                    <option value="Em Trânsito">Em Trânsito</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Local</label>
                  <select
                    className="w-full mt-1 bg-[#111822] border border-[#233348] text-white rounded-lg p-2.5"
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                  >
                    <option>Estoque Central</option>
                    <option>Laboratório</option>
                    <option>Descarte</option>
                    {technicians.map(t => <option key={t.id} value={`Carro: ${t.name}`}>Carro: {t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-lg bg-[#233348] text-white">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-lg bg-primary text-white font-bold">{editingId ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StockCard = ({ label, value, trend, trendUp, icon }: any) => (
  <div className="bg-card-dark rounded-xl p-5 border border-border-dark hover:border-[#344a66] transition-colors">
    <div className="flex justify-between items-start mb-2">
      <span className="text-text-secondary text-sm font-medium">{label}</span>
      <span className="p-1 rounded bg-[#111822] text-primary material-symbols-outlined text-[20px]">{icon}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-bold text-white">{value}</span>
      <span className={`text-sm font-medium flex items-center ${trendUp ? 'text-emerald-500' : 'text-orange-500'}`}>
        {trend}
      </span>
    </div>
  </div>
);

const InventoryLegend = ({ color, label, value }: any) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <span className="text-slate-300 text-sm">{label}</span>
    </div>
    <span className="text-white font-bold text-sm">{value}</span>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors: any = {
    'Novo': 'bg-blue-500/10 text-blue-400',
    'Usado': 'bg-emerald-500/10 text-emerald-400',
    'Defeito': 'bg-red-500/10 text-red-400',
    'Em Trânsito': 'bg-yellow-500/10 text-yellow-400'
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${colors[status] || 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  );
}