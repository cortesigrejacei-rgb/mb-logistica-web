
import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import type { Collection } from '../context/DataContext';
import { smartDistribute, TechAssignment } from '../utils/distributionLogic';
import { parseAddress, normalizeCity } from '../utils/addressParser';
import { sendPushNotification } from '../utils/notificationUtils';

export const Coletas = () => {
  const {
    collections,
    technicians,
    getTechnicianById,
    addCollection,
    updateCollectionStatus,
    deleteCollection,
    updateTechnician,
    addStockItem,
    uploadFile,
    showToast,
    refreshData,
    optimizeRouteForTechnician,
    deleteCollections,
    unassignCollections
  } = useData();

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState('');

  const filteredCollections = collections.filter(c =>
    c.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCollections.length && filteredCollections.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCollections.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Tem certeza que deseja EXCLUIR ${selectedIds.size} coletas? Esta ação não pode ser desfeita.`)) {
      await deleteCollections(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDispatchConfigOpen, setIsDispatchConfigOpen] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  const [techAssignments, setTechAssignments] = useState<Record<string, string>>({});
  const [pendingCities, setPendingCities] = useState<string[]>([]);

  const handleBulkUnassign = async () => {
    if (confirm(`Deseja desvincular técnicos de ${selectedIds.size} coletas? Elas voltarão para 'Pendente'.`)) {
      await unassignCollections(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Proof Upload State
  const [proofPreview, setProofPreview] = useState('');
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State for New Collection
  const [newClient, setNewClient] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newComplement, setNewComplement] = useState('');
  const [newEquipmentCode, setNewEquipmentCode] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Form State for Proof/Stock Entry
  const [addToStock, setAddToStock] = useState(true);
  const [collectedModel, setCollectedModel] = useState('Nokia G-240W-A');
  const [collectedSerial, setCollectedSerial] = useState('');

  const formatPhone = (value: string) => {
    const numeric = value.replace(/\D/g, '');
    if (numeric.length <= 11) {
      return numeric
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) return;

    addCollection({
      client: newClient,
      address: newAddress,
      complement: newComplement,
      equipment_code: newEquipmentCode,
      phone: newPhone,
      driverId: selectedDriverId,
      notes: 'Nova solicitação MB via painel'
    });

    setIsModalOpen(false);
    setNewClient('');
    setNewAddress('');
    setNewComplement('');
    setNewEquipmentCode('');
    setNewPhone('');
    setSelectedDriverId('');
  };

  const handleOpenAutoDispatch = () => {
    const pending = collections.filter(c => c.status === 'Pendente');
    const cities = new Set<string>();

    pending.forEach(c => {
      const parsed = parseAddress(c.address);
      cities.add(normalizeCity(parsed.city));
    });

    const uniqueCities = Array.from(cities).sort();
    setPendingCities(uniqueCities);

    const initialAssignments: Record<string, string> = {};
    technicians.filter(t => t.status !== 'Inativo').forEach(t => {
      if (t.zone) {
        const normalizedZone = normalizeCity(t.zone);
        if (uniqueCities.includes(normalizedZone)) {
          initialAssignments[t.id] = normalizedZone;
        }
      }
    });

    setTechAssignments(initialAssignments);
    setIsDispatchConfigOpen(true);
  };

  const executeAutoDispatch = async () => {
    setIsDispatchConfigOpen(false);

    const assignmentsList: TechAssignment[] = Object.keys(techAssignments).map(techId => ({
      technicianId: techId,
      city: techAssignments[techId]
    }));

    // NEW SMART DISTRIBUTION LOGIC
    const distributionPlan = smartDistribute(collections, technicians, assignmentsList);

    if (distributionPlan.length === 0) {
      showToast("Nada para distribuir ou sem técnicos.", "alert");
      return;
    }

    setIsUploading(true);
    try {
      const affectedTechs = new Set<string>();

      let count = 0;
      // Map to track count per technician
      const techCounts: Record<string, number> = {};

      for (const assignment of distributionPlan) {
        const { collectionId, technicianId } = assignment;

        await updateCollectionStatus(collectionId, 'Em Rota', undefined, technicianId);

        // Update tech status if needed
        const tech = technicians.find(t => t.id === technicianId);
        if (tech && tech.status !== 'Em Rota') {
          await updateTechnician(tech.id, { status: 'Em Rota' });
        }

        affectedTechs.add(technicianId);
        techCounts[technicianId] = (techCounts[technicianId] || 0) + 1;
        count++;
      }

      // Identify Date
      const today = new Date().toISOString().split('T')[0];

      // Optimize Routes & Notify Techs
      for (const techId of Array.from(affectedTechs)) {
        await optimizeRouteForTechnician(techId, today);

        // Send Notification
        const taskCount = techCounts[techId] || 0;
        if (taskCount > 0) {
          // Dynamically import or we need to add import at top. 
          // Since we cannot easily add import at top in this step without breaking file if not careful,
          // we will use the same strategy as DataContext: Add import at top in next step.
          // But here let's assume the function is available (I will add import).
          sendPushNotification(techId, 'Nova Rota Definida', `Você recebeu ${taskCount} novas coletas para hoje. Sua rota foi otimizada.`);
        }
      }

      await refreshData();
      showToast(`Sucesso! ${count} coletas distribuídas e rotas otimizadas.`);
    } catch (e) {
      console.error(e);
      showToast("Falha ao processar distribuição.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCompleteCollection = async () => {
    if (selectedCollection) {
      setIsUploading(true);
      try {
        let finalProofUrl = proofUrlInput || proofPreview;
        if (proofFile) {
          const uploadedUrl = await uploadFile(proofFile, 'evidences', 'comprovantes');
          if (uploadedUrl) finalProofUrl = uploadedUrl;
        }

        await updateCollectionStatus(selectedCollection.id, 'Coletado', finalProofUrl || undefined);

        if (addToStock && collectedSerial) {
          await addStockItem({
            model: collectedModel,
            serial: collectedSerial.toUpperCase(),
            status: 'Usado',
            location: `Coletado por: ${getTechnicianById(selectedCollection.driverId)?.name || 'Técnico MB'}`
          });
        }

        setIsProofModalOpen(false);
        setProofPreview('');
        setProofUrlInput('');
        setProofFile(null);
        setCollectedSerial('');
        setSelectedCollection(null);
        showToast("Coleta finalizada!");
      } catch (e) {
        showToast("Erro ao finalizar coleta.", "error");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      setProofUrlInput(''); // Limpa URL se escolheu arquivo
      const reader = new FileReader();
      reader.onloadend = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Coletado': return 'bg-[#0bda5e]/20 text-[#0bda5e]';
      case 'Pendente': return 'bg-[#fbbf24]/20 text-[#fbbf24]';
      case 'Em Rota': return 'bg-[#136dec]/20 text-[#136dec]';
      case 'Falha': return 'bg-[#fa6238]/20 text-[#fa6238]';
      default: return 'bg-slate-500/20 text-slate-500';
    }
  };

  return (
    <div className="flex h-full w-full bg-background-dark overflow-hidden font-display">
      <main className="flex flex-1 flex-col overflow-hidden border-r border-border-dark relative z-0">
        <div className="flex-none p-8 pb-0">
          <div className="flex flex-wrap justify-between gap-4 mb-8">
            <h1 className="text-white tracking-tighter text-4xl font-black uppercase">Fluxo de Coletas MB</h1>
            <div className="flex gap-3">
              <button onClick={handleOpenAutoDispatch} className="flex items-center justify-center rounded-2xl h-12 px-6 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-400 text-sm font-black gap-2 transition-all uppercase tracking-widest">
                <span className="material-symbols-outlined text-[20px]">magic_button</span> Auto Distribuir
              </button>
              <button onClick={() => refreshData()} className="flex items-center justify-center rounded-2xl h-12 w-12 bg-surface-dark border border-border-dark text-slate-400 hover:text-white transition-all shadow-sm">
                <span className="material-symbols-outlined">refresh</span>
              </button>
              <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center rounded-2xl h-12 px-6 bg-primary hover:bg-blue-600 text-white text-sm font-black gap-2 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest">
                <span className="material-symbols-outlined text-[20px]">add_task</span> Nova OS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MiniStat title="Total" value={collections.length} change="MB Log" color="bg-slate-500/10 text-slate-400" />
            <MiniStat title="Aguardando" value={collections.filter(c => c.status === 'Pendente').length} change="Pendente" color="bg-[#fbbf24]/10 text-[#fbbf24]" />
            <MiniStat title="Em Trânsito" value={collections.filter(c => c.status === 'Em Rota').length} change="Ativo" color="bg-[#136dec]/10 text-[#136dec]" />
            <MiniStat title="Finalizadas" value={collections.filter(c => c.status === 'Coletado').length} change="Sucesso" color="bg-[#0bda5e]/10 text-[#0bda5e]" />
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-surface-dark p-3 rounded-2xl border border-border-dark mb-6">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[22px]">search</span>
              <input
                className="w-full bg-transparent border-none text-white text-sm placeholder:text-slate-600 focus:ring-0 pl-11 py-2"
                placeholder="Filtrar ordens de serviço..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 pb-8 scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-background-dark z-10">
              <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] border-b border-border-dark">
                <th className="py-4 pl-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600 bg-surface-dark text-primary focus:ring-primary/50"
                    checked={selectedIds.size === filteredCollections.length && filteredCollections.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-4 pl-4">Cliente / ID</th>
                <th className="py-4 text-center">Ordem</th>
                <th className="py-4">Endereço</th>
                <th className="py-4">Status</th>
                <th className="py-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredCollections.map((col) => {
                const driver = getTechnicianById(col.driverId);
                return (
                  <ColetaRow
                    key={col.id}
                    onClick={() => setSelectedCollection(col)}
                    active={selectedCollection?.id === col.id}
                    client={col.client}
                    id={col.id}
                    address={col.address}
                    status={col.status}
                    statusColor={getStatusColor(col.status)}
                    driver={driver ? driver.name : 'Pendente'}
                    initials={col.client[0].toUpperCase()}
                    initialsColor="bg-border-dark text-slate-400"
                    sequenceOrder={col.sequence_order}
                    selected={selectedIds.has(col.id)}
                    onSelect={(e: any) => {
                      e.stopPropagation();
                      toggleSelection(col.id);
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-surface-dark border border-border-dark rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 animate-scaleIn z-30">
            <span className="text-white font-bold text-xs uppercase tracking-wider">{selectedIds.size} Selecionados</span>
            <div className="h-4 w-px bg-white/10"></div>

            <button
              onClick={handleBulkUnassign}
              className="flex items-center gap-2 text-amber-500 hover:text-amber-400 text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">link_off</span>
              Desvincular
            </button>

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 text-red-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Excluir
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}
      </main>

      {/* Sidebar de Detalhes com Hotlink */}
      {selectedCollection && (
        <aside className="w-full md:w-[450px] flex-none flex flex-col bg-surface-dark border-l border-border-dark overflow-y-auto shadow-2xl z-20 animate-slideLeft">
          <div className="p-8 border-b border-border-dark">
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-1">
                <span className="text-primary text-[10px] font-black uppercase tracking-[2px]">Detalhamento OS</span>
                <h2 className="text-2xl font-black text-white">{selectedCollection.client}</h2>
                <span className="text-slate-500 text-xs font-mono">{selectedCollection.id}</span>
              </div>
              <button onClick={() => setSelectedCollection(null)} className="p-2 text-slate-500 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(selectedCollection.status)}`}>
                {selectedCollection.status}
              </span>
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest bg-background-dark px-3 py-1.5 rounded-lg border border-border-dark">
                <span className="material-symbols-outlined text-[14px]">event</span> {selectedCollection.date}
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <section>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Logradouro do Cliente</h3>
              <div className="w-full h-48 rounded-[32px] bg-background-dark mb-4 overflow-hidden relative border border-border-dark shadow-inner">
                <iframe
                  title="Map Preview"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedCollection.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  className="opacity-40 hover:opacity-100 transition-opacity grayscale"
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-slate-300 text-sm font-bold flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0">location_on</span>
                  {selectedCollection.address}
                </p>
                {selectedCollection.complement && (
                  <p className="text-slate-400 text-xs font-medium flex items-center gap-3 pl-8">
                    <span className="material-symbols-outlined text-slate-600 text-[16px]">apartment</span>
                    {selectedCollection.complement}
                  </p>
                )}
              </div>
            </section>

            {selectedCollection.equipment_code && (
              <section>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Detalhes do Equipamento</h3>
                <div className="bg-background-dark p-4 rounded-2xl border border-border-dark flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Código Esperado (Modem)</span>
                  <p className="text-white text-sm font-mono font-bold tracking-wider">{selectedCollection.equipment_code}</p>
                </div>
              </section>
            )}

            {selectedCollection.proofUrl && (
              <section>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Evidência de Coleta (Hotlink)</h3>
                <div className="rounded-[32px] overflow-hidden border-2 border-border-dark shadow-2xl bg-background-dark">
                  <img src={selectedCollection.proofUrl} alt="Comprovante" className="w-full h-auto object-cover max-h-64" />
                </div>
              </section>
            )}

            <section>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Técnico MB Designado</h3>
              {getTechnicianById(selectedCollection.driverId) ? (
                <div className="flex items-center gap-4 bg-background-dark p-4 rounded-2xl border border-border-dark">
                  <div className="size-12 rounded-full overflow-hidden border-2 border-primary shadow-lg">
                    <img src={getTechnicianById(selectedCollection.driverId)?.avatar} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-black">{getTechnicianById(selectedCollection.driverId)?.name}</p>
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest">{getTechnicianById(selectedCollection.driverId)?.role}</p>
                  </div>
                </div>
              ) : (
                <p className="text-amber-500 text-xs font-bold uppercase tracking-widest bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-center">Aguardando Distribuição</p>
              )}
            </section>
          </div>

          <div className="p-8 border-t border-border-dark bg-background-dark/50 mt-auto flex flex-col gap-3">
            {selectedCollection.status !== 'Coletado' && (
              <button onClick={() => setIsProofModalOpen(true)} className="w-full h-16 rounded-2xl bg-primary hover:bg-blue-600 text-white font-black text-sm uppercase tracking-[3px] shadow-2xl shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">verified</span> Finalizar OS
              </button>
            )}
            <button onClick={() => deleteCollection(selectedCollection.id)} className="w-full h-12 rounded-2xl border border-red-500/20 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest transition-all">Excluir Registro</button>
          </div>
        </aside>
      )}

      {/* Modal Finalizar com suporte a Hotlink */}
      {isProofModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsProofModalOpen(false)}></div>
          <div className="relative bg-surface-dark rounded-[40px] border border-white/10 w-full max-w-md shadow-2xl p-10 animate-scaleIn">
            <h3 className="text-2xl font-black text-white mb-8 text-center uppercase tracking-tighter">Concluir Coleta MB</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Upload da Foto</label>
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-border-dark bg-background-dark text-primary rounded-2xl font-black text-xs flex items-center justify-center gap-3 uppercase tracking-widest hover:border-primary/40 transition-all">
                  <span className="material-symbols-outlined">add_a_photo</span>
                  {proofFile ? 'Foto Selecionada' : 'Capturar Evidência'}
                </button>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hotlink: URL do Comprovante</label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/comprovante.png"
                  className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                  value={proofUrlInput}
                  onChange={e => {
                    setProofUrlInput(e.target.value);
                    if (e.target.value) setProofFile(null);
                  }}
                />
              </div>

              <div className="bg-background-dark p-6 rounded-[32px] border border-border-dark space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={addToStock} onChange={e => setAddToStock(e.target.checked)} className="rounded bg-surface-dark text-primary border-border-dark" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Retornar ao Estoque</span>
                </label>
                {addToStock && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">S/N do Equipamento</label>
                    <input type="text" placeholder="EX: ALCLB123" className="w-full bg-surface-dark border border-border-dark text-white rounded-xl p-3 text-xs font-mono uppercase focus:ring-1 focus:ring-primary outline-none" value={collectedSerial} onChange={e => setCollectedSerial(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setIsProofModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-border-dark text-white font-bold text-sm">Voltar</button>
              <button onClick={handleCompleteCollection} disabled={isUploading || (!proofFile && !proofUrlInput && addToStock && !collectedSerial)} className="flex-1 py-4 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20">
                {isUploading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo com Hotlink embutido no processo de criação se necessário (opcional aqui) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-surface-dark rounded-[40px] border border-white/10 w-full max-w-lg shadow-2xl p-10 animate-scaleIn">
            <h3 className="text-2xl font-black text-white mb-8 uppercase tracking-tighter">Gerar OS Manual</h3>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Cliente</label>
                <input type="text" required className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={newClient} onChange={e => setNewClient(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Endereço Completo</label>
                <input type="text" required className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Complemento</label>
                  <input type="text" className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={newComplement} onChange={e => setNewComplement(e.target.value)} placeholder="Apto, Bloco, etc" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cód. Modem (Conf.)</label>
                  <input type="text" className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={newEquipmentCode} onChange={e => setNewEquipmentCode(e.target.value)} placeholder="Ex: S/N..." />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contato</label>
                  <input type="text" required maxLength={15} className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={newPhone} onChange={e => setNewPhone(formatPhone(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Técnico Designado</label>
                  <select required className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
                    <option value="">Escolher...</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-border-dark text-white font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20">Criar OS</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Dispatch Configuration */}
      {isDispatchConfigOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDispatchConfigOpen(false)}></div>
          <div className="relative bg-surface-dark rounded-[40px] border border-white/10 w-full max-w-2xl shadow-2xl p-10 animate-scaleIn">
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Configuração de Despacho</h3>
            <p className="text-slate-400 text-sm mb-8">Defina a cidade de atuação para cada técnico hoje. Os bairros serão agrupados inteligentemente.</p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 mb-8">
              {technicians.filter(t => t.status !== 'Inativo').map(tech => (
                <div key={tech.id} className="flex items-center justify-between p-4 bg-background-dark rounded-2xl border border-border-dark">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-slate-700 overflow-hidden">
                      <img src={tech.avatar} alt={tech.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{tech.name}</p>
                      <p className="text-slate-500 text-[10px] uppercase font-bold">{tech.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Cidade/Rota:</label>
                    <select
                      className="bg-surface-dark border border-border-dark text-white text-xs font-bold rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary"
                      value={techAssignments[tech.id] || ''}
                      onChange={(e) => setTechAssignments(prev => ({ ...prev, [tech.id]: e.target.value }))}
                    >
                      <option value="">Automático / Global</option>
                      {pendingCities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {technicians.filter(t => t.status !== 'Inativo').length === 0 && (
                <p className="text-center text-amber-500 py-4 font-bold">Nenhum técnico disponível Online.</p>
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setIsDispatchConfigOpen(false)} className="flex-1 py-4 rounded-2xl bg-border-dark text-white font-bold text-sm">Cancelar</button>
              <button onClick={executeAutoDispatch} className="flex-1 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-purple-600/20">
                Confirmar e Distribuir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStat = ({ title, value, change, color }: any) => (
  <div className="flex flex-col gap-1 rounded-2xl p-5 bg-surface-dark border border-border-dark shadow-sm">
    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{title}</p>
    <div className="flex items-end justify-between">
      <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${color}`}>{change}</span>
    </div>
  </div>
);

const ColetaRow = ({ onClick, active, client, id, address, status, statusColor, driver, initials, initialsColor, sequenceOrder, selected, onSelect }: any) => (
  <tr
    onClick={onClick}
    className={`group border-b border-border-dark cursor-pointer transition-all relative ${active ? 'bg-primary/10' : 'hover:bg-white/5'} ${selected ? 'bg-blue-500/5' : ''}`}
  >
    <td className="py-5 pl-4 w-10">
      <input
        type="checkbox"
        checked={selected || false}
        onChange={onSelect}
        onClick={(e) => e.stopPropagation()}
        className="rounded border-slate-600 bg-surface-dark text-primary focus:ring-primary/50 cursor-pointer"
      />
    </td>
    <td className="py-5 pl-4">
      <div className="flex items-center gap-4">
        <div className={`size-10 rounded-xl flex items-center justify-center text-xs font-black shadow-lg ${initialsColor}`}>{initials}</div>
        <div className="flex flex-col">
          <span className="text-white font-black text-sm">{client}</span>
          <span className="text-slate-500 text-[10px] font-mono">{id}</span>
        </div>
      </div>
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
    </td>
    <td className="py-5 text-center">
      {sequenceOrder ? (
        <span className="inline-flex items-center justify-center size-6 rounded-full bg-surface-dark border border-border-dark text-xs font-bold text-white shadow-sm">
          {sequenceOrder}
        </span>
      ) : (
        <span className="text-slate-600 text-[10px]">-</span>
      )}
    </td>
    <td className="py-5 text-slate-400 font-medium">
      <div className="truncate max-w-[250px]" title={address}>{address}</div>
    </td>
    <td className="py-5">
      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${statusColor}`}>
        {status}
      </span>
    </td>
    <td className="py-5 text-slate-400 text-xs font-bold uppercase tracking-wider">
      {driver}
    </td>
  </tr>
);
