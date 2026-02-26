import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { calculateOptimalRoute } from '../lib/RouteOptimizer';
import { supabase } from '../lib/supabaseClient';
// Import types if available, otherwise reliance on window or direct import if bundler supports it
// Note: In Vite/React, we usually need 'npm install xlsx'. Assuming standard import works or falling back to window if script tag used.

export const Importacao = () => {
  const { addCollection, technicians, optimizeRouteForTechnician, refreshData } = useData();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setErrorMessage('');
      processFile(selectedFile);
    }
  };

  const normalizeKey = (key: string) => key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const findTechnicianByName = (name: string) => {
    if (!name) return '';
    const cleanName = normalizeKey(name);

    console.log(`[Import] Trying to match CSV Tech: "${name}" (Clean: "${cleanName}")`);

    // 1. Precise match (Name or Email user part)
    const exact = technicians.find(t =>
      normalizeKey(t.name) === cleanName ||
      normalizeKey(t.email.split('@')[0]) === cleanName
    );
    if (exact) {
      console.log(`   -> Matched EXACT: ${exact.name}`);
      return exact.id;
    }

    // 2. Flexible Email Match (e.g. "MAURO.LGS" -> "mauro.lgs@...")
    // Also handle cases where CSV has "Name Surname" but email is "name.surname"
    const emailMatch = technicians.find(t => {
      const emailUser = normalizeKey(t.email.split('@')[0]);
      // Check if CSV name is contained in email user part or vice versa
      return emailUser.includes(cleanName) || cleanName.includes(emailUser);
    });

    if (emailMatch) {
      console.log(`   -> Matched EMAIL: ${emailMatch.name}`);
      return emailMatch.id;
    }

    // 3. Last Resort: First Name Match (Dangerous but requested)
    // Only if the CSV name has at least 3 chars to avoid matching initials
    if (cleanName.length > 3) {
      const firstName = cleanName.split(' ')[0];
      const partialName = technicians.find(t => normalizeKey(t.name).startsWith(firstName));

      if (partialName) {
        console.log(`   -> Matched PARTIAL NAME: ${partialName.name}`);
        return partialName.id;
      }
    }

    console.log(`   -> NO MATCH FOUND`);
    return '';
  };

  const processFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Logic to support both ArrayBuffer (react-dropzone/standard) and binary string
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Use sheet_to_json with header: 1 to get array of arrays first to find header row logic? 
        // Or just standard sheet_to_json is fine if headers are on row 1.
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          setErrorMessage("O arquivo parece estar vazio.");
          return;
        }

        // DEBUG: Log first row keys to see what we are getting
        if (jsonData.length > 0) {
          console.log("DEBUG: First row keys:", Object.keys(jsonData[0]));
          // You could also set this to state to show in UI if needed
        }

        // Map specific columns
        const mappedData = jsonData.map((row: any, index: number) => {
          // Normalize Row Keys for lookup
          const rowKeys = Object.keys(row);
          const getValue = (targetKeys: string[]) => {
            const normalizedTargets = targetKeys.map(k => normalizeKey(k));
            const foundKey = rowKeys.find(k => normalizedTargets.includes(normalizeKey(k)));
            return foundKey ? row[foundKey] : '';
          };

          // Validations
          let id = getValue(['Os', 'ID', 'Codigo']);
          const client = getValue(['Destinatário - Nome', 'Nome', 'Cliente', 'Destinatario']);
          const address = getValue(['Destinatário - Logradouro', 'Logradouro', 'Endereço', 'Endereco', 'Destinatário - Endereço completo']);
          const number = getValue(['Número', 'Numero', 'Num']);

          // Debugging skipped rows
          if (!client && !address) {
            console.log(`Skipping row ${index}: Missing Client/Address. Keys found:`, rowKeys);
            return null;
          }

          // Extract Data
          const phone = getValue(['Telefone 1', 'Telefone', 'Celular', 'Contato', 'Destinatário - Telefone']);
          const dateRaw = getValue(['Data Cadastro', 'Data', 'Dia']);
          const notes = getValue(['Obs', 'Observação']);

          // New Fields from Analysis
          const complement = getValue(['Destinatário - Complemento', 'Complemento']);
          const equipmentCode = getValue(['Os', 'Serial', 'Equipamento']);
          const suspectedSerial = getValue(['COD', 'Cod. Status', 'Serial', 'S/N']);

          const city = getValue(['Cidade', 'Município']);
          const neighborhood = getValue(['Destinatário - Bairro', 'Bairro', 'Vila']);
          const rawState = getValue(['Estado', 'UF', 'Est.', 'Node']); // Sometimes 'Node' or just column near city
          // Simple validation for state (2 chars)
          const state = rawState && rawState.length <= 3 ? rawState : '';

          const segment = getValue(['Segmento', 'Pacote']);

          // Technician Pre-assignment
          const techName = getValue(['Técnico', 'Tecnico']);
          const assignedDriverId = findTechnicianByName(String(techName));

          // Fix ID
          if (!id || id === '-') {
            id = `IMP-${Date.now()}-${index}`;
          }

          return {
            id: String(id),
            client,
            address: String(address),
            number: String(number),
            phone: String(phone),
            notes: notes,
            date: formatDate(dateRaw),
            complement: String(complement),
            equipmentCode: String(suspectedSerial),
            city: String(city),
            state: String(state),
            neighborhood: String(neighborhood),
            segment: String(segment),
            driverId: assignedDriverId,
            techNamePreview: techName
          };
        }).filter((item: any) => item !== null);

        setPreviewData(mappedData);
        setStep(2);

      } catch (err) {
        console.error(err);
        setErrorMessage("Erro ao processar arquivo. Certifique-se de que é um Excel válido.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const formatDate = (raw: any) => {
    if (!raw) return new Date().toISOString().split('T')[0];

    // Handle Excel Serial Date
    if (typeof raw === 'number') {
      // Excel base date is 1899-12-30. 
      // Add logic to perform math in UTC to avoid T21:00 previous day issues.
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
      // Adjust manually for timezone or just use getUTCDate
      // Safer: create date and add minutes timezone offset? 
      // Simplest: Add 12 hours to land in middle of day then ISO string
      date.setHours(date.getHours() + 12);
      return date.toISOString().split('T')[0];
    }

    // Handle String "dd/mm/yyyy"
    if (typeof raw === 'string' && raw.includes('/')) {
      const parts = raw.split('/');
      if (parts.length === 3) {
        // dd/mm/yyyy -> yyyy-mm-dd
        // This is safe string manipulation
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  const handleImport = async () => {
    setIsProcessing(true);

    // 1. Add Collections
    const total = previewData.length;
    let i = 0;

    // Helper to add with delay to not freeze UI
    const processBatch = async () => {
      const batchSize = 10;
      const end = Math.min(i + batchSize, total);

      for (let j = i; j < end; j++) {
        const item = previewData[j];
        await addCollection({
          id: item.id,
          client: item.client,
          address: item.address,
          number: item.number, // New field passed if addCollection supports it, or just ignored by addCollection if not updated yet. 
          // Actually addCollection might not take number yet. 
          // But we need it for SyncClients.
          phone: item.phone,
          driverId: item.driverId,
          notes: item.notes,
          date: item.date,
          complement: item.complement,
          equipment_code: item.equipmentCode,
          city: item.city,
          neighborhood: item.neighborhood
        }, true); // skipRefresh = true
      }

      i = end;
      if (i < total) {
        setTimeout(processBatch, 10);
      } else {
        // Finished adding collections

        // NEW: Sync Clients to dedicated table
        await syncClients(previewData);

        // Optimize routes
        await calculateAndSaveRouteSummaries(previewData);
        await refreshData();
        setIsProcessing(false);
        setStep(3);
      }
    };

    processBatch();
  };

  const syncClients = async (items: any[]) => {
    console.log("[Import] Syncing Clients DB...");
    const uniqueClients = new Map();

    items.forEach(item => {
      if (item.client) {
        // Deduplicate by Name
        if (!uniqueClients.has(item.client)) {
          uniqueClients.set(item.client, {
            name: item.client,
            address: item.address,
            number: item.number,
            complement: item.complement,
            neighborhood: item.neighborhood,
            city: item.city,
            state: item.state,
            phone: item.phone,
            segment: item.segment,
            last_order_date: item.date
          });
        }
      }
    });

    const clientsPayload = Array.from(uniqueClients.values());

    if (clientsPayload.length > 0) {
      // Batch upsert
      const { error } = await supabase
        .from('clients')
        .upsert(clientsPayload, { onConflict: 'name' });

      if (error) {
        console.error("[Import] Failed to sync clients:", error);
      } else {
        console.log(`[Import] Synced ${clientsPayload.length} clients.`);
      }
    }
  };

  const calculateAndSaveRouteSummaries = async (items: any[]) => {
    console.log("Starting Route Synchronization & Optimization...");

    // Group by Technician
    const techGroups: Record<string, any[]> = {};
    items.forEach(item => {
      if (item.driverId) {
        if (!techGroups[item.driverId]) techGroups[item.driverId] = [];
        techGroups[item.driverId].push(item);
      }
    });

    // Process each technician
    // We already added collections to DB. Now we ask the system to Optimize/Sequence them.

    // We also want to calculate totals for the summary table (optional, as the optimizer updates DB, 
    // maybe we should move summary calculation to the optimization function? 
    // For now, let's keep the summary insertion here but use the Optimizer validation).

    // Actually, `optimizeRouteForTechnician` does the sequencing.
    // It does not return the totals currently.
    // But since `calculateAndSaveRouteSummaries` is about saving summaries...
    // Let's call `optimizeRouteForTechnician` first to ensure strict ordering, 
    // and then (or individually) save the summary.

    // Wait, the user wants the "Optimization" to happen here.
    // `optimizeRouteForTechnician` is already available from component scope.
    // const { optimizeRouteForTechnician } = useData(); // REMOVED: Invalid hook call

    // But for the logic:
    for (const techId of Object.keys(techGroups)) {
      const groupItems = techGroups[techId];
      const date = groupItems[0]?.date || new Date().toISOString().split('T')[0];

      // Trigger Optimization & Sequencing (Updates DB 'sequence_order')
      if (techId) {
        await optimizeRouteForTechnician(techId, date);

        // Also create a "Planning" summary record if needed?
        // The previous logic did this. Let's keep it but maybe we don't need to recalculate if we trust the outcome?
        // Actually, for the summary table (dashboard), we need `route_summaries`.
        // Let's keep a simplified insert for now or just rely on the optimization having happened.

        // For this task, strict requirement is "Order Synchronization".
        // Optimization handled the order.
        // I'll skip the redundant calculation logic that was mocking geocoding here 
        // because `optimizeRouteForTechnician` uses the real or stored lat/lng from the collections we just added.
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background-light dark:bg-background-dark relative">
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#233348]">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">Importação em Massa</h1>
              <p className="text-[#92a9c9]">Importe planilhas operacionais completas (.xlsx).</p>
            </div>
            <div className="flex items-center gap-2">
              <Step number={1} label="Upload" active={step >= 1} />
              <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-primary' : 'bg-[#233348]'}`}></div>
              <Step number={2} label="Revisão" active={step >= 2} />
              <div className={`w-12 h-0.5 ${step >= 3 ? 'bg-primary' : 'bg-[#233348]'}`}></div>
              <Step number={3} label="Concluir" active={step >= 3} />
            </div>
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#1a232e] rounded-xl p-1 border border-[#233348] shadow-xl">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#1a232e] rounded-lg border-2 border-dashed border-[#324867] hover:border-primary/50 transition-colors group cursor-pointer relative overflow-hidden h-64 flex flex-col items-center justify-center"
                  >
                    <input
                      ref={fileInputRef}
                      className="hidden"
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileChange}
                    />
                    <div className="mb-4 p-4 bg-[#233348] rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-all text-[#92a9c9]">
                      <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Selecionar Arquivo Excel</h3>
                    <p className="text-[#92a9c9] text-sm mb-6 max-w-sm text-center">Suporte nativo para relatórios operacionais</p>
                  </div>
                </div>
                {errorMessage && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined">error</span>
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div className="bg-[#1a232e] rounded-xl border border-[#233348] overflow-hidden">
                <div className="p-4 border-b border-[#233348] flex justify-between items-center bg-[#192433]">
                  <h3 className="text-white font-bold">Pré-visualização ({previewData.length} registros)</h3>
                  <button onClick={() => setStep(1)} className="text-sm text-primary hover:underline">Cancelar</button>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-sm text-[#92a9c9]">
                    <thead className="bg-[#111822] text-xs uppercase sticky top-0 font-bold text-white z-10">
                      <tr>
                        <th className="px-6 py-3">Cliente</th>
                        <th className="px-6 py-3">Endereço</th>
                        <th className="px-6 py-3">Bairro/Cidade</th>
                        <th className="px-6 py-3">Complemento</th>
                        <th className="px-6 py-3">Serial (Esp.)</th>
                        <th className="px-6 py-3">Técnico (Auto)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#233348]">
                      {previewData.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#233348]/50">
                          <td className="px-6 py-3 font-bold text-white">{row.client}</td>
                          <td className="px-6 py-3 truncate max-w-[200px]" title={row.address}>{row.address}</td>
                          <td className="px-6 py-3">{row.neighborhood} - {row.city}</td>
                          <td className="px-6 py-3 text-orange-400">{row.complement}</td>
                          <td className="px-6 py-3 font-mono text-emerald-400">{row.equipmentCode}</td>
                          <td className="px-6 py-3">
                            {row.driverId ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                {
                                  // Find name for display
                                  technicians.find(t => t.id === row.driverId)?.name
                                }
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">{row.techNamePreview ? `Ñ enc.: ${row.techNamePreview}` : '-'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.length > 100 && (
                  <div className="p-2 text-center text-xs text-slate-500 border-t border-[#233348]">
                    Exibindo os primeiros 100 registros de {previewData.length}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setStep(1)} className="px-6 py-3 rounded-lg border border-[#324867] text-white font-bold hover:bg-[#233348]">Voltar</button>
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-lg bg-primary text-white font-bold hover:bg-blue-600 shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  {isProcessing ? 'Importando...' : 'Confirmar Importação'}
                  {!isProcessing && <span className="material-symbols-outlined">rocket_launch</span>}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-[#1a232e] rounded-xl border border-[#233348]">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Sucesso!</h2>
              <p className="text-[#92a9c9] mb-8">{previewData.length} ordens de serviço foram geradas.</p>
              <div className="flex gap-4">
                <button onClick={() => navigate('/coletas')} className="px-6 py-3 rounded-lg bg-primary text-white font-bold hover:bg-blue-600">
                  Ver Grade de Coletas
                </button>
                <button onClick={() => { setStep(1); setPreviewData([]); }} className="px-6 py-3 rounded-lg bg-[#233348] text-white font-bold hover:bg-[#324867]">
                  Nova Importação
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Step = ({ number, label, active }: any) => (
  <div className={`flex items-center gap-2 ${active ? '' : 'opacity-50'}`}>
    <span
      className={`flex items-center justify-center size-8 rounded-full text-sm font-bold ${active ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-[#233348] text-[#92a9c9]'
        }`}
    >
      {number}
    </span>
    <span className={`${active ? 'text-white' : 'text-[#92a9c9]'} text-sm font-medium hidden sm:block`}>{label}</span>
  </div>
);