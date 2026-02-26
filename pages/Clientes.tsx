import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useData } from '../context/DataContext';

export const Clientes = () => {
    const { technicians } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [selectedClient, setSelectedClient] = useState<any>(null); // For Modal
    const [clientHistory, setClientHistory] = useState<any[]>([]); // For Timeline
    const [historyLoading, setHistoryLoading] = useState(false);

    // Action States
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});

    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [newCollectionForm, setNewCollectionForm] = useState<any>({
        service_type: 'COLETA',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const PAGE_SIZE = 50;

    useEffect(() => {
        fetchClients();
    }, [page]);

    // Fetch Client List
    const fetchClients = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('clients')
                .select('*', { count: 'exact' })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
                .order('name', { ascending: true });

            if (searchTerm) {
                query = query.ilike('name', `%${searchTerm}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setClients(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Full History for a specific Client
    const fetchClientHistory = async (clientId: string) => {
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('collections')
                .select('*')
                .eq('client_id', clientId)
                .order('occurrence_date', { ascending: false }) // Most recent first
                .order('date', { ascending: false });

            if (error) throw error;
            setClientHistory(data || []);
        } catch (err) {
            console.error("Error fetching history", err);
            setClientHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(0);
            fetchClients();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Open Modal
    const handleOpenClient = (client: any) => {
        setSelectedClient(client);
        setEditForm(client); // Init edit form
        setIsEditing(false);
        setIsCreatingCollection(false);
        fetchClientHistory(client.id);
    };

    // Handlers
    const handleSaveClient = async () => {
        try {
            const { error } = await supabase
                .from('clients')
                .update({
                    name: editForm.name,
                    phone: editForm.phone,
                    address: editForm.address,
                    number: editForm.number,
                    neighborhood: editForm.neighborhood,
                    city: editForm.city,
                    segment: editForm.segment
                })
                .eq('id', selectedClient.id);

            if (error) throw error;

            setSelectedClient({ ...selectedClient, ...editForm });
            setIsEditing(false);
            fetchClients(); // Refresh list
        } catch (error) {
            console.error("Error updating client", error);
            alert("Erro ao atualizar cliente.");
        }
    };

    const handleCreateCollection = async () => {
        try {
            const { error } = await supabase
                .from('collections')
                .insert({
                    client_id: selectedClient.id,
                    client: selectedClient.name,
                    address: selectedClient.address,
                    number: selectedClient.number,
                    city: selectedClient.city,
                    neighborhood: selectedClient.neighborhood,
                    phone: selectedClient.phone,
                    service_type: newCollectionForm.service_type,
                    date: newCollectionForm.date,
                    notes: newCollectionForm.notes,

                    driver_id: newCollectionForm.driver_id || null, // Add driver assignment
                    status: 'Pendente'
                });

            if (error) throw error;

            setIsCreatingCollection(false);
            fetchClientHistory(selectedClient.id); // Refresh history
            alert("Solicitação criada com sucesso!");
        } catch (error) {
            console.error("Error creating collection", error);
            alert("Erro ao criar solicitação.");
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background-light dark:bg-background-dark relative">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">Clientes</h1>
                            <p className="text-[#92a9c9]">Base de clientes unificada. Clique para ver histórico.</p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar Cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#1a232e] border border-[#233348] rounded-xl pl-10 pr-4 py-3 text-white focus:border-primary outline-none transition-all shadow-lg placeholder:text-slate-500"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-[#1a232e] rounded-xl border border-[#233348] shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#111822] text-xs uppercase text-[#92a9c9] font-bold sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 border-b border-[#233348]">Nome</th>
                                        <th className="px-6 py-4 border-b border-[#233348]">Cidade/Bairro</th>
                                        <th className="px-6 py-4 border-b border-[#233348]">Endereço</th>
                                        <th className="px-6 py-4 border-b border-[#233348]">Telefone</th>
                                        <th className="px-6 py-4 border-b border-[#233348]">Segmento</th>
                                        <th className="px-6 py-4 border-b border-[#233348] text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#233348]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                <div className="flex justify-center items-center gap-2">
                                                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                                                    Carregando...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : clients.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                                                Nenhum cliente encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        clients.map((client) => (
                                            <tr
                                                key={client.id}
                                                className="hover:bg-[#233348]/40 transition-colors group cursor-pointer"
                                                onClick={() => handleOpenClient(client)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-white text-sm group-hover:text-primary transition-colors">{client.name}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-300">{client.city}</div>
                                                    <div className="text-xs text-slate-500">{client.neighborhood}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-300 truncate max-w-[200px]" title={client.address}>
                                                        {client.address}, {client.number}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-emerald-400 font-mono">{client.phone || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        {client.segment || 'Geral'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenClient(client); }}
                                                        className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors border border-slate-700 hover:border-slate-500"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        <div className="p-4 border-t border-[#233348] flex justify-between items-center bg-[#111822]">
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                className="px-4 py-2 rounded-lg border border-[#324867] text-slate-400 hover:text-white disabled:opacity-50 text-sm font-bold transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="text-xs text-slate-500">Página {page + 1}</span>
                            <button
                                disabled={clients.length < PAGE_SIZE}
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 rounded-lg border border-[#324867] text-slate-400 hover:text-white disabled:opacity-50 text-sm font-bold transition-colors"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Client Details Modal */}
            {selectedClient && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end" onClick={() => setSelectedClient(null)}>
                    <div
                        className="w-full max-w-2xl bg-[#0f172a] h-full border-l border-[#233348] flex flex-col shadow-2xl animate-fade-in-right"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-[#233348] flex justify-between items-start bg-[#1a232e]">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">{selectedClient.name}</h2>
                                <div className="flex items-center gap-2 text-[#92a9c9] text-sm">
                                    <span className="material-symbols-outlined text-sm">location_on</span>
                                    {selectedClient.address}, {selectedClient.number} - {selectedClient.neighborhood}, {selectedClient.city}
                                </div>
                                {selectedClient.phone && (
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm mt-1 font-mono font-bold">
                                        <span className="material-symbols-outlined text-sm">call</span>
                                        {selectedClient.phone}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedClient(null)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Stats Bar */}
                        <div className="grid grid-cols-3 border-b border-[#233348] bg-[#111822]">
                            <div className="p-4 border-r border-[#233348] text-center">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Visitas</div>
                                <div className="text-xl font-mono text-white">{clientHistory.length}</div>
                            </div>
                            <div className="p-4 border-r border-[#233348] text-center">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Última Atividade</div>
                                <div className="text-sm font-bold text-white">
                                    {clientHistory[0]?.occurrence_date
                                        ? new Date(clientHistory[0].occurrence_date).toLocaleDateString('pt-BR')
                                        : '-'}
                                </div>
                            </div>
                            <div className="p-4 text-center">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Segmento</div>
                                <div className="text-sm font-bold text-blue-400">{selectedClient.segment || 'N/A'}</div>
                            </div>
                        </div>

                        {/* VIEW MODE */}
                        {!isEditing && !isCreatingCollection && (
                            <>
                                {/* Scrollable Content (Timeline) */}
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0f172a]">
                                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">history</span>
                                        Histórico de Atendimentos
                                    </h3>

                                    {historyLoading ? (
                                        <div className="flex justify-center py-10">
                                            <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                                        </div>
                                    ) : clientHistory.length === 0 ? (
                                        <div className="p-8 text-center border-2 border-dashed border-[#233348] rounded-xl text-slate-500">
                                            Nenhum histórico encontrado para este cliente.
                                        </div>
                                    ) : (
                                        <div className="relative border-l-2 border-[#233348] ml-4 space-y-8 pb-8">
                                            {clientHistory.map((item, idx) => (
                                                <div key={item.id || idx} className="relative pl-8">
                                                    {/* Timeline Dot */}
                                                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-[#1a232e] border-2 border-primary rounded-full"></div>

                                                    <div className="flex flex-col gap-2">
                                                        {/* Header Line */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-bold text-white">
                                                                {item.occurrence_date
                                                                    ? new Date(item.occurrence_date).toLocaleDateString('pt-BR')
                                                                    : new Date(item.date).toLocaleDateString('pt-BR')}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                                        ${item.contract_status === 'Aguardando Execução' ? 'bg-yellow-500/10 text-yellow-500' :
                                                                    item.contract_status?.includes('REALIZADO') ? 'bg-green-500/10 text-green-500' :
                                                                        'bg-slate-700 text-slate-300'}
                                                    `}>
                                                                {item.contract_status || item.status || 'Indefinido'}
                                                            </span>
                                                        </div>

                                                        {/* Tech Info */}
                                                        <div className="text-xs text-[#92a9c9] flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[14px]">person</span>
                                                            {item.original_tech_name || 'Técnico Não Identificado'}
                                                        </div>

                                                        {/* Card Content */}
                                                        <div className="bg-[#1a232e] p-4 rounded-lg border border-[#233348] mt-1 space-y-3">
                                                            {item.tech_notes && (
                                                                <div>
                                                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Observações do Técnico</div>
                                                                    <p className="text-sm text-slate-300 italic">"{item.tech_notes}"</p>
                                                                </div>
                                                            )}

                                                            {item.notes && (
                                                                <div>
                                                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Observações Gerais</div>
                                                                    <p className="text-sm text-slate-400">{item.notes}</p>
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#233348]/50">
                                                                <div>
                                                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Equipamento</div>
                                                                    <div className="text-xs text-white font-mono">{item.equipment_code || 'N/A'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Contrato</div>
                                                                    <div className="text-xs text-white font-mono">{item.contract_id || 'N/A'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>


                                {/* Footer Actions */}
                                <div className="p-4 border-t border-[#233348] bg-[#1a232e] flex justify-end gap-3">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 text-slate-300 hover:text-white font-bold text-sm bg-[#233348] hover:bg-[#324867] rounded-lg transition-colors"
                                    >
                                        Editar Cadastro
                                    </button>
                                    <button
                                        onClick={() => setIsCreatingCollection(true)}
                                        className="px-4 py-2 text-white font-bold text-sm bg-primary hover:bg-blue-600 rounded-lg transition-colors"
                                    >
                                        Nova Solicitação
                                    </button>
                                </div>
                            </>
                        )}

                        {/* EDIT MODE */}
                        {isEditing && (
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b border-[#233348] flex justify-between items-center bg-[#1a232e]">
                                    <h2 className="text-xl font-bold text-white">Editar Cliente</h2>
                                    <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white">Cancelar</button>
                                </div>
                                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Nome</label>
                                        <input className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                            value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 block mb-1">Telefone</label>
                                            <input className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                                value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 block mb-1">Segmento</label>
                                            <input className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                                value={editForm.segment} onChange={e => setEditForm({ ...editForm, segment: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Endereço</label>
                                        <input className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                            value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 block mb-1">Número</label>
                                            <input className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                                value={editForm.number} onChange={e => setEditForm({ ...editForm, number: e.target.value })} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-slate-400 block mb-1">Cidade</label>
                                            <input className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                                value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Bairro</label>
                                        <input className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                            value={editForm.neighborhood} onChange={e => setEditForm({ ...editForm, neighborhood: e.target.value })} />
                                    </div>
                                </div>
                                <div className="p-4 border-t border-[#233348] flex justify-end gap-3">
                                    <button onClick={handleSaveClient} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded">Salvar Alterações</button>
                                </div>
                            </div>
                        )}

                        {/* NEW COLLECTION MODE */}
                        {isCreatingCollection && (
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b border-[#233348] flex justify-between items-center bg-[#1a232e]">
                                    <h2 className="text-xl font-bold text-white">Nova Solicitação</h2>
                                    <button onClick={() => setIsCreatingCollection(false)} className="text-slate-400 hover:text-white">Cancelar</button>
                                </div>
                                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Tipo de Serviço</label>
                                        <select className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                            value={newCollectionForm.service_type}
                                            onChange={e => setNewCollectionForm({ ...newCollectionForm, service_type: e.target.value })}
                                        >
                                            <option value="COLETA">Coleta</option>
                                            <option value="ENTREGA">Entrega</option>
                                            <option value="VISITA TECNICA">Visita Técnica</option>
                                        </select>

                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Técnico Responsável</label>
                                        <select className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                            value={newCollectionForm.driver_id || ''}
                                            onChange={e => setNewCollectionForm({ ...newCollectionForm, driver_id: e.target.value })}
                                        >
                                            <option value="">-- Selecionar (Opcional) --</option>
                                            {technicians.filter(t => t.status !== 'Inativo').map(tech => (
                                                <option key={tech.id} value={tech.id}>
                                                    {tech.name} ({tech.status})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Data Agendada</label>
                                        <input type="date" className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white"
                                            value={newCollectionForm.date}
                                            onChange={e => setNewCollectionForm({ ...newCollectionForm, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Observações</label>
                                        <textarea className="w-full bg-[#080c14] border border-[#233348] rounded p-2 text-white h-32"
                                            placeholder="Descreva a solicitação..."
                                            value={newCollectionForm.notes}
                                            onChange={e => setNewCollectionForm({ ...newCollectionForm, notes: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="p-4 border-t border-[#233348] flex justify-end gap-3">
                                    <button onClick={handleCreateCollection} className="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-bold rounded">Criar Solicitação</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
            }
        </div >
    );
};
