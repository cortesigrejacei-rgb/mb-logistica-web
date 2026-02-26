import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import type { Collection } from '../context/DataContext';
import { supabase } from '../lib/supabaseClient';

const getTodayLocal = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

export const Combustivel = () => {
    const { technicians, collections: contextCollections, showToast } = useData();
    const [summaries, setSummaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);

    const [selectedDate, setSelectedDate] = useState(getTodayLocal());

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

            // 1. Filter Collections: Include currently selected date OR active routes
            const activeCollections = contextCollections.filter(c =>
                c.driverId && (
                    c.date === selectedDate ||
                    (c.status !== 'Coletado' && c.status !== 'Falha')
                )
            );

            console.log(`[Combustivel] Synchronizing ${activeCollections.length} collections (Selected: ${selectedDate})`);

            if (activeCollections.length === 0) {
                alert(`Nenhuma rota ativa ou registro para ${selectedDate} encontrado.`);
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

                // Determine "Route Date"
                // ALWAYS prioritize the user selected date if items exist for it, 
                // otherwise only use most frequent if strictly necessary.
                // But if we are in "Fuel" tab, we usually care about the date we are VIEWING.
                const bestDate = selectedDate;



                // 1. Try to reuse valid distance from Map (Cached in DB)
                let { data: existingDist } = await supabase
                    .from('route_summaries')
                    .select('total_distance_km, status')
                    .eq('technician_id', techId)
                    .eq('date', bestDate)
                    .maybeSingle();

                let distanceKm = 0;
                let durationSeconds = 0;
                let usedCached = false;

                // FALLBACK: Se não existir rota para hoje, tenta pegar a última distância válida desse técnico
                if (!existingDist || !existingDist.total_distance_km) {
                    console.log(`[Recalculate Fallback] Sem rota para ${bestDate}. Buscando última distância válida para ${tech.name}...`);
                    const { data: lastRoute } = await supabase
                        .from('route_summaries')
                        .select('total_distance_km')
                        .eq('technician_id', techId)
                        .gt('total_distance_km', 0)
                        .order('date', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastRoute) {
                        console.log(`[Recalculate Fallback] Sucesso! Usando distância de ${lastRoute.total_distance_km}km de uma rota anterior.`);
                        existingDist = lastRoute as any;
                    }
                }

                if (!existingDist || !existingDist.total_distance_km) {
                    console.warn(`[Recalculate] Dados do mapa AUSENTES para ${tech.name} na data ${bestDate} (mesmo com fallback).`);
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

                // Consumption & Price Logic (Consolidated)
                const consumption = tech.avg_consumption || 10;
                const fuelPrice = tech.fuel_type === 'Etanol'
                    ? (station?.price_ethanol || 3.99)
                    : (tech.fuel_type === 'Diesel' ? (station?.price_diesel || 6.09) : (station?.price_gasoline || 5.89));

                const litersNeeded = distanceKm / consumption;
                const cost = (isNaN(litersNeeded) || isNaN(fuelPrice)) ? 0 : (litersNeeded * fuelPrice);

                const remainingKm = tech.remaining_km || 0;
                const remainingLiters = remainingKm / consumption;
                const remainingCost = (isNaN(remainingLiters) || isNaN(fuelPrice)) ? 0 : (remainingLiters * fuelPrice);

                // 5. Save Summary using BEST DATE
                const { error: upsertError } = await supabase.from('route_summaries').upsert({
                    technician_id: techId,
                    date: bestDate,
                    total_distance_km: distanceKm,
                    total_duration_seconds: durationSeconds,
                    collection_count: groupItems.length,
                    estimated_fuel_cost: cost,
                    remaining_distance_km: remainingKm,
                    remaining_fuel_cost: remainingCost,
                    status: usedCached ? 'Calculated (Map)' : 'Calculated',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'technician_id,date' });

                if (upsertError) {
                    console.error("Error saving summary", upsertError);
                    skippedTechs.push(`${tech.name} (Erro: ${upsertError.message})`);
                } else {
                    syncedCount++;
                    // ALERT IF ID IS NOT UUID (Will not show on mobile)
                    if (techId.length < 20) {
                        skippedTechs.push(`${tech.name} (SALVO, mas ID: ${techId} é inválido para o Celular)`);
                    }
                }

                // Update the tracked date for auto-switching view
                detectedSyncDate = bestDate;

            } // Close for loop

            // RELOAD Data for current view
            await fetchSummaries();

            if (skippedTechs.length > 0) {
                alert(`Sincronização concluída com avisos!\n\nAtualizados: ${syncedCount}\nIgnorados: ${skippedTechs.length}\n\nTécnicos ignorados:\n${skippedTechs.join('\n')}`);
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

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const totalCost = summaries.reduce((acc, curr) => acc + (curr.estimated_fuel_cost || 0), 0);
    const totalKm = summaries.reduce((acc, curr) => acc + (curr.total_distance_km || 0), 0);
    const totalActualKm = summaries.reduce((acc, curr) => acc + (curr.actual_distance_km || 0), 0);

    const totalActualCost = summaries.reduce((acc, curr) => {
        const tech = technicians.find(t => t.id === curr.technician_id);
        const consumption = tech?.avg_consumption || 10;
        const fuelPrice = (curr.estimated_fuel_cost / (curr.total_distance_km || 1)) || (tech?.fuel_type === 'Etanol' ? 3.99 : 5.89);
        const cost = (curr.actual_distance_km / consumption) * fuelPrice;
        return acc + (isNaN(cost) ? 0 : cost);
    }, 0);

    // Live Totals for Cards
    const totalRemainingCost = summaries.reduce((acc, curr) => {
        if (!isToday) return acc + (curr.remaining_fuel_cost || 0);
        const tech = technicians.find(t => t.id === curr.technician_id);
        const consumption = tech?.avg_consumption || 10;
        const liveKm = tech?.remaining_km || 0;
        const liveCost = (liveKm / consumption) * (curr.estimated_fuel_cost / (curr.total_distance_km || 1));
        return acc + (isNaN(liveCost) ? 0 : liveCost);
    }, 0);

    const totalRemainingKm = summaries.reduce((acc, curr) => {
        if (!isToday) return acc + (curr.remaining_distance_km || 0);
        const tech = technicians.find(t => t.id === curr.technician_id);
        return acc + (tech?.remaining_km || 0);
    }, 0);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark font-display leading-relaxed">
            <header className="flex-shrink-0 px-10 py-6 border-b border-border-dark bg-background-dark/95 backdrop-blur-xl z-10 shadow-2xl">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-1">
                            Gestão de <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent italic">Combustível</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium">Estimativas de custo e progresso baseadas em GPS tempo real.</p>
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

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="p-6 bg-surface-dark/50 backdrop-blur-md rounded-3xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] group hover:border-primary/30 transition-all duration-500">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-blue-500/10 rounded-xl">
                                <span className="material-symbols-outlined text-blue-500">local_gas_station</span>
                            </div>
                            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Custo Estimado</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-white">R$ {totalRemainingCost.toFixed(2).replace('.', ',')}</p>
                            <span className="text-xs text-slate-500 font-bold">/ R$ {totalCost.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-tighter">Valor que falta rodar hoje</p>
                    </div>
                    <div className="p-6 bg-surface-dark/50 backdrop-blur-md rounded-3xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] group hover:border-emerald-400/30 transition-all duration-500">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-emerald-500">route</span>
                            </div>
                            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Quilometragem</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-white">{totalRemainingKm.toFixed(1)} km</p>
                            <span className="text-xs text-slate-500 font-bold">/ {totalKm.toFixed(1)} km</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-tighter">Distância que falta percorrer</p>
                    </div>
                    <div className="p-6 bg-surface-dark/50 backdrop-blur-md rounded-3xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] group hover:border-blue-400/30 transition-all duration-500">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-blue-400/10 rounded-xl group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-blue-400">explore</span>
                            </div>
                            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Odorômetro Real</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-white">{totalActualKm.toFixed(1)} km</p>
                            <span className="text-xs text-slate-500 font-bold">R$ {totalActualCost.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-tighter">Total GPS medido hoje</p>
                    </div>
                    <div className="p-6 bg-surface-dark/50 backdrop-blur-md rounded-3xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] group hover:border-orange-500/30 transition-all duration-500">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-orange-500/10 rounded-xl group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-orange-500">groups</span>
                            </div>
                            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Técnicos na Rota</span>
                        </div>
                        <p className="text-3xl font-black text-white">{summaries.length}</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-tighter">Equipes ativas no momento</p>
                    </div>
                </div>



                {/* Table */}
                <div className="bg-surface-dark/40 backdrop-blur-sm rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
                    <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Detalhamento por Técnico</h2>
                        {isToday && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live GPS Monitor</span>
                            </div>
                        )}
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-background-dark text-xs uppercase text-slate-500 font-black">
                            <tr>
                                <th className="px-6 py-4">Técnico</th>
                                <th className="px-6 py-4">Veículo / Consumo</th>
                                <th className="px-6 py-4">Coletas</th>
                                <th className="px-6 py-4">Dist. Total (Mapa)</th>
                                <th className="px-6 py-4 text-primary">KM Faltante</th>
                                <th className="px-6 py-4 text-blue-400">Km Real (GPS)</th>
                                <th className="px-6 py-4">Custo Total</th>
                                <th className="px-6 py-4 text-emerald-400">Custo Restante</th>
                                <th className="px-6 py-4 text-blue-400">Custo Real (GPS)</th>
                                <th className="px-6 py-4">Última Sinc.</th>
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

                                    // Inject LIVE logic: Calculate remaining cost based on current tech.remaining_km if date is today
                                    const consumption = tech?.avg_consumption || 10;
                                    const liveRemainingKm = (isToday && tech) ? (tech.remaining_km || 0) : (item.remaining_distance_km || 0);

                                    // 2. Actual Distance from GPS (if finished)
                                    const actualKm = item.actual_distance_km || 0;
                                    const fuelPrice = (item.estimated_fuel_cost / (item.total_distance_km || 1)) || (tech?.fuel_type === 'Etanol' ? 3.99 : 5.89);
                                    const actualCost = (actualKm / consumption) * fuelPrice;

                                    // Use the cached price from summary if possible, or recalculate if live
                                    // For simplicity in display, we use the snapshotted cost ratio if not today
                                    const liveRemainingCost = isToday
                                        ? (liveRemainingKm / consumption) * (item.estimated_fuel_cost / (item.total_distance_km || 1))
                                        : (item.remaining_fuel_cost || 0);

                                    const lastUpdate = item.updated_at
                                        ? new Date(item.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                        : '-';

                                    return (
                                        <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group/row">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-10 rounded-full bg-background-dark overflow-hidden border border-white/5 group-hover/row:border-primary/50 transition-colors">
                                                        <img
                                                            src={tech?.avatar || `https://ui-avatars.com/api/?name=${tech?.name || 'Unknown'}`}
                                                            className="w-full h-full object-cover"
                                                            alt={`Avatar de ${tech?.name || 'técnico'}`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-black text-sm tracking-tight">{tech?.name || 'Desconhecido'}</p>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">{tech?.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white text-sm font-bold tracking-tight">{tech?.fuel_type || 'Gasolina'}</span>
                                                    <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">{tech?.avg_consumption || 10} km/l</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-white text-sm font-black tracking-tighter">{item.collection_count}</td>
                                            <td className="px-6 py-4 text-white text-sm font-black opacity-30 tracking-tighter italic">{item.total_distance_km?.toFixed(1) || '0.0'} km</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-black transition-all ${liveRemainingKm > 0 ? 'text-primary' : 'text-slate-700'}`}>
                                                        {liveRemainingKm.toFixed(1)} km
                                                    </span>
                                                    {isToday && (
                                                        <span className="text-[8px] text-emerald-500/60 font-black uppercase tracking-[0.2em] animate-pulse">Live</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-blue-400 text-sm font-black tracking-tighter">
                                                {actualKm.toFixed(1)} km
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm font-bold tracking-tighter">R$ {(item.estimated_fuel_cost || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-emerald-400 text-sm font-black tracking-tighter">
                                                R$ {liveRemainingCost.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-blue-400 text-sm font-black tracking-tighter">
                                                R$ {actualCost.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-[10px] font-black tracking-widest uppercase">{lastUpdate}</td>
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
                                <button onClick={handleSaveStation} className="md:col-span-1 bg-primary text-white rounded-lg font-bold text-xs uppercase tracking-wider py-2 hover:bg-blue-600 transition-all h-full mt-auto flex items-center justify-center">
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
                                                <td className="px-4 py-3 text-slate-300 text-right">R$ {(station.price_gasoline || 0).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-slate-300 text-right">R$ {(station.price_ethanol || 0).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-slate-300 text-right">R$ {(station.price_diesel || 0).toFixed(2)}</td>
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
