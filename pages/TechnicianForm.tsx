import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import type { Technician } from '../context/DataContext';
import { useNavigate, useParams } from 'react-router-dom';

export const TechnicianForm = () => {
    const { technicians, addTechnician, updateTechnician, uploadFile, showToast } = useData();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('Coletor');

    // Avatar handling
    const [avatar, setAvatar] = useState('');
    const [avatarUrlInput, setAvatarUrlInput] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // New Fields: Address & Fuel
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState<number | undefined>(undefined);
    const [lng, setLng] = useState<number | undefined>(undefined);
    const [consumption, setConsumption] = useState(10.0);
    const [fuelType, setFuelType] = useState<'Gasolina' | 'Etanol' | 'Diesel'>('Gasolina');
    // City/State management (Start)
    const [city, setCity] = useState('');
    const [state, setState] = useState('');

    // End Address State
    const [endAddress, setEndAddress] = useState('');
    const [endLat, setEndLat] = useState<number | undefined>(undefined);
    const [endLng, setEndLng] = useState<number | undefined>(undefined);
    const [endCity, setEndCity] = useState('');
    const [endState, setEndState] = useState('');

    useEffect(() => {
        if (id) {
            const tech = technicians.find(t => t.id === id);
            if (tech) {
                setName(tech.name);
                setEmail(tech.email);
                setRole(tech.role);
                setAvatar(tech.avatar);
                setAvatarUrlInput(tech.avatar.startsWith('http') ? tech.avatar : '');

                setAddress(tech.address || '');
                setLat(tech.start_lat);
                setLng(tech.start_lng);
                setConsumption(tech.avg_consumption || 10.0);
                setFuelType(tech.fuel_type as any || 'Gasolina');
                setCity(tech.city || '');
                setState(tech.state || '');

                setEndAddress(tech.end_address || '');
                setEndLat(tech.end_lat);
                setEndLng(tech.end_lng);
                setEndCity(tech.end_city || '');
                setEndState(tech.end_state || '');
            }
        }
    }, [id, technicians]);

    // Debug
    // useEffect(() => {
    //    if (id) showToast(`Edição: ${id}`);
    // }, [id]);

    const handleGeocodeAddress = async (type: 'start' | 'end') => {
        const addrQuery = type === 'start' ? address : endAddress;
        if (!addrQuery) return;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(addrQuery)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const item = data[0];
                const latitude = parseFloat(item.lat);
                const longitude = parseFloat(item.lon);

                const addrDetails = item.address;
                const foundCity = addrDetails.city || addrDetails.town || addrDetails.village || addrDetails.municipality || 'Desconhecida';
                const foundState = addrDetails.state_district || addrDetails.state || 'PR';

                if (type === 'start') {
                    setLat(latitude);
                    setLng(longitude);
                    setCity(foundCity);
                    setState(foundState);
                } else {
                    setEndLat(latitude);
                    setEndLng(longitude);
                    setEndCity(foundCity);
                    setEndState(foundState);
                }

                showToast(`Geocodificado (${type === 'start' ? 'Partida' : 'Retorno'}): ${foundCity} - ${foundState}`);
            } else {
                showToast('Endereço não encontrado no mapa.', 'error');
            }
        } catch (e) {
            console.error("Geocoding error", e);
            showToast('Erro ao buscar coordenadas.', 'error');
        }
    };

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatar(URL.createObjectURL(file));
            setAvatarUrlInput('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUploading(true);

        let finalAvatarUrl = avatarUrlInput || avatar;

        if (avatarFile) {
            const url = await uploadFile(avatarFile, 'avatars', 'tecnicos');
            if (url) finalAvatarUrl = url;
        }

        try {
            if (id) {
                await updateTechnician(id, {
                    name,
                    email,
                    role,
                    avatar: finalAvatarUrl || undefined,
                    address,
                    start_lat: lat,
                    start_lng: lng,
                    avg_consumption: consumption,
                    fuel_type: fuelType,
                    city,
                    state,
                    end_address: endAddress,
                    end_lat: endLat,
                    end_lng: endLng,
                    end_city: endCity,
                    end_state: endState
                });
                showToast('Técnico atualizado!');
            } else {
                await addTechnician({
                    name,
                    email,
                    role,
                    status: 'Offline',
                    avatar: finalAvatarUrl || '',
                    address,
                    start_lat: lat,
                    start_lng: lng,
                    avg_consumption: consumption,
                    fuel_type: fuelType,
                    city,
                    state,
                    end_address: endAddress,
                    end_lat: endLat,
                    end_lng: endLng,
                    end_city: endCity,
                    end_state: endState
                });
                showToast('Técnico cadastrado!');
            }
            navigate('/tecnicos');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar técnico.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background-dark font-display p-6 md:p-10 scrollbar-thin">
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
                            {id ? 'Editar Técnico' : 'Novo Técnico'}
                        </h1>
                        <p className="text-slate-400 mt-1">Preencha os dados do colaborador.</p>
                    </div>
                    <button
                        onClick={() => navigate('/tecnicos')}
                        className="px-4 py-2 rounded-xl border border-border-dark bg-surface-dark text-slate-300 hover:text-white transition-colors"
                    >
                        Voltar
                    </button>
                </div>

                <div className="bg-surface-dark rounded-[40px] border border-white/10 p-10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="flex flex-col items-center gap-6 mb-4">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-32 h-32 rounded-full bg-background-dark overflow-hidden border-4 border-border-dark group-hover:border-primary transition-all shadow-2xl">
                                    <img
                                        src={avatarUrlInput || avatar || `https://ui-avatars.com/api/?name=${name || 'MB'}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=MB&background=random`; }}
                                        alt="Avatar"
                                    />
                                </div>
                                <div className="absolute bottom-0 right-0 bg-primary size-10 rounded-full flex items-center justify-center border-4 border-surface-dark text-white">
                                    <span className="material-symbols-outlined text-lg">photo_camera</span>
                                </div>
                                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarSelect} />
                            </div>

                            <div className="w-full max-w-md space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hotlink: URL da Foto (Opcional)</label>
                                <input
                                    type="url"
                                    placeholder="https://exemplo.com/foto.jpg"
                                    className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={avatarUrlInput}
                                    onChange={e => {
                                        setAvatarUrlInput(e.target.value);
                                        if (e.target.value) setAvatarFile(null);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input type="text" required className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                                <input type="email" required className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </div>

                        {/* Address Field (Start) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Endereço Residencial (Partida)</label>
                            <div className="bg-background-dark border border-border-dark rounded-2xl flex items-center px-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                <span className="material-symbols-outlined text-slate-500">home</span>
                                <input
                                    type="text"
                                    placeholder="Rua, Número, Cidade - Estado"
                                    className="bg-transparent text-white text-sm font-bold border-none focus:ring-0 w-full h-12"
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    onBlur={() => handleGeocodeAddress('start')}
                                />
                            </div>
                            {lat && (
                                <div className="flex items-center gap-1 ml-1">
                                    <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                                    <span className="text-[10px] text-emerald-500 font-bold">Partida: {lat.toFixed(4)}, {lng?.toFixed(4)}</span>
                                </div>
                            )}
                        </div>

                        {/* Address Field (End/Return) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Endereço de Retorno (Pernoite/Hotel)</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEndAddress(address);
                                        setEndLat(lat);
                                        setEndLng(lng);
                                        setEndCity(city);
                                        setEndState(state);
                                    }}
                                    className="text-[10px] text-primary font-bold hover:underline"
                                >
                                    Mesmo da Partida
                                </button>
                            </div>
                            <div className="bg-background-dark border border-border-dark rounded-2xl flex items-center px-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                <span className="material-symbols-outlined text-slate-500">hotel</span>
                                <input
                                    type="text"
                                    placeholder="Deixe em branco se for o mesmo da partida"
                                    className="bg-transparent text-white text-sm font-bold border-none focus:ring-0 w-full h-12"
                                    value={endAddress}
                                    onChange={e => setEndAddress(e.target.value)}
                                    onBlur={() => handleGeocodeAddress('end')}
                                />
                            </div>
                            {endLat && (
                                <div className="flex items-center gap-1 ml-1">
                                    <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                                    <span className="text-[10px] text-emerald-500 font-bold">Retorno: {endLat.toFixed(4)}, {endLng?.toFixed(4)}</span>
                                </div>
                            )}
                        </div>

                        {/* Fuel & Consumption */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Consumo Médio (km/l)</label>
                                <div className="bg-background-dark border border-border-dark rounded-2xl flex items-center px-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                    <span className="material-symbols-outlined text-slate-500">local_gas_station</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="10.0"
                                        className="bg-transparent text-white text-sm font-bold border-none focus:ring-0 w-full h-12"
                                        value={consumption}
                                        onChange={e => setConsumption(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Combustível</label>
                                <div className="bg-background-dark border border-border-dark rounded-2xl flex items-center px-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                    <span className="material-symbols-outlined text-slate-500">water_drop</span>
                                    <select
                                        className="bg-transparent text-white text-sm font-bold border-none focus:ring-0 w-full h-12 [&>option]:text-black"
                                        value={fuelType}
                                        onChange={e => setFuelType(e.target.value as any)}
                                    >
                                        <option value="Gasolina">Gasolina</option>
                                        <option value="Etanol">Etanol</option>
                                        <option value="Diesel">Diesel</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Função MB</label>
                            <select className="w-full bg-background-dark border border-border-dark text-white rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none appearance-none" value={role} onChange={e => setRole(e.target.value)}>
                                <option value="Coletor">Coletor</option>
                                <option value="Coletor Sênior">Coletor Sênior</option>
                                <option value="Supervisor">Supervisor</option>
                            </select>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button
                                type="button"
                                onClick={() => navigate('/tecnicos')}
                                className="flex-1 py-4 rounded-2xl bg-border-dark text-white font-bold text-sm hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isUploading}
                                className="flex-1 py-4 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 uppercase tracking-widest hover:bg-blue-600 transition-colors"
                            >
                                {isUploading ? 'Salvando...' : 'Salvar Dados'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
