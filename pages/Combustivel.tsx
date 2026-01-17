import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabaseClient';
import { Collection } from '../types';

export const Combustivel = () => {
    const { technicians, collections: contextCollections } = useData();
    const [summaries, setSummaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Gas Station Management State
    const [isStationModalOpen, setIsStationModalOpen] = useState(false);
    const [stations, setStations] = useState<any[]>([]);
    // Form state for new station
    const [newStationName, setNewStationName] = useState('');
    const [newStationCity, setNewStationCity] = useState('');
    const [newStationState, setNewStationState] = useState('');
    const [newPriceGas, setNewPriceGas] = useState(5.89);
    const [newPriceEth, setNewPriceEth] = useState(3.99);
    const [newPriceDie, setNewPriceDie] = useState(6.09);

    useEffect(() => {
        if (isStationModalOpen) {
            fetchStations();
        }
    }, [isStationModalOpen]);

    const fetchStations = async () => {
        const { data } = await supabase.from('gas_stations').select('*').order('city');
        if (data) setStations(data);
    };

    const handleSaveStation = async () => {
        if (!newStationName || !newStationCity || !newStationState) return alert("Nome, Cidade e Estado obrigatórios");

        const newStation = {
            name: newStationName,
            city: newStationCity,
            state: newStationState,
            price_gasoline: newPriceGas,
            price_ethanol: newPriceEth,
            price_diesel: newPriceDie
        };

        const { error } = await supabase.from('gas_stations').insert([newStation]);

        if (error) {
            alert("Erro ao salvar posto: " + error.message);
        } else {
            alert("Posto salvo com sucesso!");
            fetchStations();
            setNewStationName('');
            setNewStationCity('');
            setNewStationState('');
        }
    };

    const handleDeleteStation = async (id: string) => {
        if (confirm("Tem certeza que deseja remover este posto?")) {
            await supabase.from('gas_stations').delete().eq('id', id);
            fetchStations();
        }
    };

    useEffect(() => {
        fetchSummaries();
    }, [selectedDate]);

    const fetchSummaries = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('route_summaries')
                .select('*')
                .eq('date', selectedDate);

            if (data) {
                setSummaries(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculate = async () => {
        setCalculating(true);
        try {
            // 0. Prefetch Gas Stations to calculate regional averages
            const { data: stationsDB } = await supabase.from('gas_stations').select('*');
            const allStations = stationsDB || [];

            let detectedSyncDate = '';
            let syncedCount = 0;
            const skippedTechs: string[] = [];

            console.log(`[Combustivel] Recalculating ALL active routes (Global Mode)`);

            // Filter from Context: Status Only (Decoupled from Date)
            // STRICTLY MATCH MAPA.TSX LOGIC: status !== 'Coletado' && status !== 'Falha'
            const activeCollections = contextCollections.filter(c =>
                c.driverId &&
                c.status !== 'Coletado' && c.status !== 'Falha'
            );

            console.log(`[Combustivel] Found Global Active:`, activeCollections.length);

            if (activeCollections.length === 0) {
                alert(`Nenhuma rota ativa encontrada no sistema.`);
                setCalculating(false);
                return;
            }

            // 2. Group by Technician
            const groupedByTech: Record<string, any[]> = {};
            activeCollections.forEach(item => {
                if (item.driverId) {
                    if (!groupedByTech[item.driverId]) groupedByTech[item.driverId] = [];
                    groupedByTech[item.driverId].push(item);
                }
            });

            // 3. Process each technician
            for (const techId of Object.keys(groupedByTech)) {
                const tech = technicians.find(t => t.id === techId);
                // If tech not in local context (rare), try looking up by ID roughly or skip
                if (!tech) continue;

                if (groupedByTech[techId]) {
                    // Pre-sort by sequence_order if available to respect Map
                    groupedByTech[techId].sort((a, b) => (a.sequence_order || 9999) - (b.sequence_order || 9999));
                }

                const groupItems = groupedByTech[techId];

                // Determine "Route Date" (Most frequent date in this tech's active items)
                // STRICTLY MATCH MAPA.TSX LOGIC
                const dateCounts: Record<string, number> = {};
                groupItems.forEach(c => {
                    if (c.date) dateCounts[c.date] = (dateCounts[c.date] || 0) + 1;
                });
                const bestDate = Object.keys(dateCounts).sort((a, b) => dateCounts[b] - dateCounts[a])[0] || new Date().toISOString().split('T')[0];

                console.log(`[Combustivel Sync Debug] Tech: ${tech.name} (${techId})`);
                console.log(`[Combustivel Sync Debug] Active Collections: ${groupItems.length}`);
                console.log(`[Combustivel Sync Debug] Calculated Target Date: ${bestDate}`);

                console.log(`[Recalculate] Tech: ${tech.name} (${techId}) -> Route Date: ${bestDate}`);

                // 1. Try to reuse valid distance from Map (Cached in DB)
                const { data: existingDist } = await supabase
                    .from('route_summaries')
                    .select('total_distance_km, status')
                    .eq('technician_id', techId)
                    .eq('date', bestDate)
                    .maybeSingle();

                let distanceKm = 0;
                let durationSeconds = 0;
                let usedCached = false;

                if (!existingDist || !existingDist.total_distance_km) {
                    console.warn(`[Recalculate] Dados do mapa AUSENTES para ${tech.name} na data ${bestDate}.`);
                    skippedTechs.push(`${tech.name} (Sem Rota no Mapa)`);
                    continue;
                }

                console.log(`[Recalculate] Usando dados do Mapa: ${existingDist.total_distance_km}km`);
                distanceKm = existingDist.total_distance_km;
                durationSeconds = 0;
                usedCached = true;

                // 4. Calculate Cost
                // Find Regional Gas Station Average Price
                const getCityPrice = (c: string) => {
                    if (!c) return null;
                    const clean = c.toLowerCase().trim();
                    return allStations.find(s => s.city.toLowerCase().trim() === clean);
                };

                const techCity = tech.city || (groupItems[0] && groupItems[0].city);
                const station = getCityPrice(techCity);

                // Defaults if no station found
                let fuelPrice = 5.89;
                if (station) {
                    if (tech.fuel_type === 'Etanol') fuelPrice = station.price_ethanol;
                    else if (tech.fuel_type === 'Diesel') fuelPrice = station.price_diesel;
                    else fuelPrice = station.price_gasoline;
                } else if (allStations.length > 0) {
                    fuelPrice = allStations[0].price_gasoline;
                }

                const consumption = tech.avg_consumption || 10;
                const litersNeeded = distanceKm / consumption;
                const selectedPrice = tech.fuel_type === 'Etanol' ? (station?.price_ethanol || 3.99) : (tech.fuel_type === 'Diesel' ? (station?.price_diesel || 6.09) : (station?.price_gasoline || 5.89));
                const cost = (isNaN(litersNeeded) || isNaN(selectedPrice)) ? 0 : (litersNeeded * selectedPrice);

                // 5. Save Summary using BEST DATE
                const { error: upsertError } = await supabase.from('route_summaries').upsert({
                    technician_id: techId,
                    date: bestDate,
                    total_distance_km: distanceKm,
                    total_duration_seconds: durationSeconds,
                    collection_count: groupItems.length,
                    estimated_fuel_cost: cost,
                    status: usedCached ? 'Calculated (Map)' : 'Calculated',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'technician_id,date' });

                if (upsertError) {
                    console.error("Error saving summary", upsertError);
                    // EXPOSE THE REAL ERROR TO THE USER
                    skippedTechs.push(`${tech.name} (Erro: ${upsertError.message || 'Desconhecido'} - ${upsertError.details || ''})`);
                } else {
                    syncedCount++;
                }

                // Update the tracked date for auto-switching view
                detectedSyncDate = bestDate;

            } // Close for loop

            if (detectedSyncDate && detectedSyncDate !== selectedDate) {
                console.log(`[Combustivel] Auto-switching view to synced date: ${detectedSyncDate}`);
                setSelectedDate(detectedSyncDate);
                // useEffect will trigger fetchSummaries
            } else {
                await fetchSummaries(); // Refresh UI manually if date didn't change
            }

            if (skippedTechs.length > 0) {
                alert(`Sincronização concluída com avisos!\n\nAtualizados: ${syncedCount}\nIgnorados: ${skippedTechs.length}\n\nTécnicos ignorados (provavelmente sem rota no Mapa):\n${skippedTechs.join('\n')}`);
            } else {
                alert(`Sucesso! ${syncedCount} técnicos sincronizados com o Mapa.`);
            }

        } catch (e) {
            console.error(e);
            alert("Erro ao recalcular.");
        } finally {
            setCalculating(false);
        }
    };

    const totalCost = summaries.reduce((acc, curr) => acc + (curr.estimated_fuel_cost || 0), 0);
    const totalKm = summaries.reduce((acc, curr) => acc + (curr.total_distance_km || 0), 0);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark font-display">
            <header className="flex-shrink-0 px-10 py-6 border-b border-border-dark bg-background-dark/95 backdrop-blur z-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight uppercase">Gestão de Combustível</h2>
                        <p className="text-slate-400 mt-1">Estimativas de custo baseadas em roteirização inteligente.</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setIsStationModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-dark bg-surface-dark text-slate-300 text-xs font-bold hover:bg-white/5 hover:text-white transition-colors uppercase tracking-widest"
                        >
                            <span className="material-symbols-outlined text-[18px]">local_gas_station</span>
                            Gerenciar Postos
                        </button>

                        <button
                            onClick={handleRecalculate}
                            disabled={calculating}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${calculating ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/20'}`}
                        >
                            <span className={`material-symbols-outlined text-[18px] ${calculating ? 'animate-spin' : ''}`}>
                                {calculating ? 'sync' : 'calculate'}
                            </span>
                            {calculating ? 'Sincronizando...' : 'Sincronizar Valores'}
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-surface-dark border border-border-dark text-white rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-10">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="p-6 bg-surface-dark rounded-2xl border border-border-dark shadow-lg">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-blue-500/10 rounded-xl">
                                <span className="material-symbols-outlined text-blue-500">local_gas_station</span>
                            </div>
                            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Custo Estimado Total</span>
                        </div>
                        <p className="text-3xl font-black text-white">R$ {totalCost.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="p-6 bg-surface-dark rounded-2xl border border-border-dark shadow-lg">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-emerald-500/10 rounded-xl">
                                <span className="material-symbols-outlined text-emerald-500">route</span>
                            </div>
                            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Quilometragem Total</span>
                        </div>
                        <p className="text-3xl font-black text-white">{totalKm.toFixed(1)} km</p>
                    </div>
                    <div className="p-6 bg-surface-dark rounded-2xl border border-border-dark shadow-lg">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-orange-500/10 rounded-xl">
                                <span className="material-symbols-outlined text-orange-500">groups</span>
                            </div>
                            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Técnicos na Rota</span>
                        </div>
                        <p className="text-3xl font-black text-white">{summaries.length}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-border-dark">
                        <h3 className="text-lg font-bold text-white">Detalhamento por Técnico</h3>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-background-dark text-xs uppercase text-slate-500 font-black">
                            <tr>
                                <th className="px-6 py-4">Técnico</th>
                                <th className="px-6 py-4">Veículo / Consumo</th>
                                <th className="px-6 py-4">Coletas</th>
                                <th className="px-6 py-4">Dist. Mapa (Est.)</th>
                                <th className="px-6 py-4">Dist. GPS (Real)</th>
                                <th className="px-6 py-4">Custo (Est.)</th>
                                <th className="px-6 py-4">Última Sinc.</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {summaries.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                        Nenhum registro encontrado para esta data.
                                    </td>
                                </tr>
                            ) : (
                                summaries.map((item) => {
                                    const tech = technicians.find(t => t.id === item.technician_id);
                                    const lastUpdate = item.updated_at
                                        ? new Date(item.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                        : '-';

                                    return (
                                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-full bg-background-dark overflow-hidden border border-border-dark">
                                                        <img src={tech?.avatar || `https://ui-avatars.com/api/?name=${tech?.name || 'Unknown'}`} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-bold text-sm">{tech?.name || 'Desconhecido'}</p>
                                                        <p className="text-xs text-slate-500">{tech?.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white text-sm font-medium">{tech?.fuel_type || 'Gasolina'}</span>
                                                    <span className="text-xs text-slate-500">{tech?.avg_consumption || 10} km/l</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-white text-sm font-bold">{item.collection_count}</td>
                                            <td className="px-6 py-4 text-white text-sm font-bold">{item.total_distance_km?.toFixed(1) || '0.0'} km</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-sm font-bold ${item.actual_distance_km > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                                    {item.actual_distance_km ? item.actual_distance_km.toFixed(1) : '0.0'} km
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-400 text-sm font-bold">R$ {item.estimated_fuel_cost.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-slate-400 text-xs font-mono">{lastUpdate}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wide">
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* Modal de Postos */}
            {
                isStationModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsStationModalOpen(false)}></div>
                        <div className="relative bg-surface-dark rounded-[32px] border border-white/10 w-full max-w-3xl p-8 shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-black text-white">Postos de Combustível</h3>
                                <button onClick={() => setIsStationModalOpen(false)} className="text-slate-400 hover:text-white">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 bg-background-dark p-4 rounded-xl border border-border-dark">
                                <input placeholder="Nome do Posto" value={newStationName} onChange={e => setNewStationName(e.target.value)} className="bg-surface-dark border border-border-dark text-white rounded-lg px-3 py-2 text-sm md:col-span-2" />
                                <input placeholder="Cidade" value={newStationCity} onChange={e => setNewStationCity(e.target.value)} className="bg-surface-dark border border-border-dark text-white rounded-lg px-3 py-2 text-sm md:col-span-2" />
                                <input placeholder="UF" value={newStationState} onChange={e => setNewStationState(e.target.value)} className="bg-surface-dark border border-border-dark text-white rounded-lg px-3 py-2 text-sm md:col-span-1" maxLength={2} />

                                <div className="md:col-span-5 flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Gasolina</label>
                                        <input type="number" step="0.01" value={newPriceGas} onChange={e => setNewPriceGas(parseFloat(e.target.value))} className="w-full bg-surface-dark border border-border-dark text-white rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Etanol</label>
                                        <input type="number" step="0.01" value={newPriceEth} onChange={e => setNewPriceEth(parseFloat(e.target.value))} className="w-full bg-surface-dark border border-border-dark text-white rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Diesel</label>
                                        <input type="number" step="0.01" value={newPriceDie} onChange={e => setNewPriceDie(parseFloat(e.target.value))} className="w-full bg-surface-dark border border-border-dark text-white rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                </div>
                                <button onClick={handleSaveStation} className="md:col-span-1 bg-primary text-white rounded-lg font-bold text-xs uppercase tracking-wider py-2 hover:bg-blue-600 transition-colors h-full mt-auto">
                                    Salvar
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-black/20 text-xs uppercase text-slate-400 font-bold border-b border-white/5">
                                        <tr>
                                            <th className="px-4 py-3">Posto</th>
                                            <th className="px-4 py-3">Local</th>
                                            <th className="px-4 py-3 text-right">Gasolina</th>
                                            <th className="px-4 py-3 text-right">Etanol</th>
                                            <th className="px-4 py-3 text-right">Diesel</th>
                                            <th className="px-4 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {stations.map(station => (
                                            <tr key={station.id} className="hover:bg-white/5">
                                                <td className="px-4 py-3 text-white font-bold">{station.name}</td>
                                                <td className="px-4 py-3 text-slate-400 text-xs">{station.city} - {station.state}</td>
                                                <td className="px-4 py-3 text-slate-300 text-right">R$ {station.price_gasoline.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-slate-300 text-right">R$ {station.price_ethanol.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-slate-300 text-right">R$ {station.price_diesel.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => handleDeleteStation(station.id)} className="text-red-500 hover:text-red-400">
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
