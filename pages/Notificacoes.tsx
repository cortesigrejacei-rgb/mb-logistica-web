import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabaseClient';
import { sendPushNotification } from '../utils/notificationUtils';

export const Notificacoes = () => {
    const { technicians, showToast } = useData();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [selectedTech, setSelectedTech] = useState<string>('all');
    const [isSending, setIsSending] = useState(false);

    // Show all active technicians, regardless of push token status
    const availableTechs = technicians.filter(t => t.status !== 'Inativo');

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !body.trim()) {
            showToast('Preencha título e mensagem.', 'error');
            return;
        }

        setIsSending(true);

        const recipients = selectedTech === 'all'
            ? availableTechs
            : availableTechs.filter(t => t.id === selectedTech);

        if (recipients.length === 0) {
            showToast('Nenhum técnico disponível para envio.', 'error');
            setIsSending(false);
            return;
        }

        let successCount = 0;
        let failCount = 0;

        // Use sendPushNotification (RPC) for each recipient
        // The RPC function handles both the Sending AND the Logging to 'notifications' table.
        const promises = recipients.map(async (tech) => {
            const result = await sendPushNotification(tech.id, title, body);

            if (result && result.success) {
                successCount++;
            } else {
                console.error(`Failed to send to ${tech.name}:`, result?.error);
                failCount++;
            }
        });

        await Promise.all(promises);

        setIsSending(false);

        if (failCount > 0) {
            showToast(`Enviado: ${successCount}. Falhas: ${failCount}. Verifique o console.`, 'warning');
        } else {
            showToast(`Sucesso! Notificação enviada para ${successCount} técnico(s).`, 'success');
        }

        setTitle('');
        setBody('');
        fetchHistory(); // Refresh list to show new entries
    };

    // Fetch history
    const [history, setHistory] = useState<any[]>([]);

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('notifications')
            .select('*, technician_id')
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) setHistory(data);
    };

    React.useEffect(() => {
        fetchHistory();
    }, []);

    // Helper to refresh on send
    const handleSendWithRefresh = async (e: React.FormEvent) => {
        await handleSend(e);
        fetchHistory();
    };

    const getTechName = (id: string) => {
        const tech = technicians.find(t => t.id === id);
        return tech ? tech.name : id;
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-dark font-display p-6 md:p-10 overflow-y-auto scrollbar-thin">
            <div className="max-w-6xl mx-auto w-full">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-primary">notifications</span>
                            Central de Notificações
                        </h1>
                        <p className="text-slate-400 mt-1">Envie alertas push e consulte o histórico de mensagens.</p>
                    </div>
                    <button onClick={fetchHistory} className="text-primary hover:text-white text-sm font-bold flex items-center gap-1 transition-colors">
                        <span className="material-symbols-outlined text-lg">refresh</span> Atualizar
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-surface-dark rounded-3xl border border-white/10 p-6 shadow-2xl sticky top-6">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">edit_square</span>
                                Nova Mensagem
                            </h2>
                            <form onSubmit={handleSendWithRefresh} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Destinatário</label>
                                    <div className="relative">
                                        <select
                                            value={selectedTech}
                                            onChange={(e) => setSelectedTech(e.target.value)}
                                            className="w-full bg-background-dark border border-border-dark text-white rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
                                        >
                                            <option value="all">Todos os Técnicos Ativos</option>
                                            {availableTechs.map(tech => (
                                                <option key={tech.id} value={tech.id}>
                                                    {tech.name} {tech.expo_push_token ? '📱' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <span className="material-symbols-outlined">expand_more</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 ml-1">📱 = App Conectado (Push Ativo)</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Título</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Ex: Aviso Importante"
                                        className="w-full bg-background-dark border border-border-dark text-white rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mensagem</label>
                                    <textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        placeholder="Escreva aqui..."
                                        rows={4}
                                        className="w-full bg-background-dark border border-border-dark text-white rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSending}
                                    className="w-full py-3 rounded-xl bg-primary hover:bg-blue-600 text-white font-black text-sm shadow-lg shadow-primary/20 uppercase tracking-widest transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSending ? (
                                        <span className="animate-pulse">Enviando...</span>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-lg">send</span>
                                            Enviar
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* History Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="bg-surface-dark px-4 py-2 rounded-xl border border-white/5 flex gap-3 items-center">
                                <span className="material-symbols-outlined text-emerald-400">devices</span>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 uppercase font-black">Apps Conectados</span>
                                    <span className="text-white font-bold">{availableTechs.filter(t => t.expo_push_token).length} / {availableTechs.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface-dark rounded-3xl border border-white/10 overflow-hidden">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-400">history</span>
                                    Últimos Envios
                                </h3>
                            </div>
                            <div className="divide-y divide-white/5">
                                {history.length === 0 ? (
                                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                        <p>Nenhuma notificação enviada recentemente.</p>
                                    </div>
                                ) : (
                                    history.map((item) => (
                                        <div key={item.id} className="p-5 hover:bg-white/5 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-white font-bold text-sm">{item.title}</h4>
                                                <span className="text-[10px] font-mono text-slate-500 bg-background-dark px-2 py-1 rounded-md border border-white/5">
                                                    {new Date(item.created_at).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-sm mb-3 leading-relaxed">{item.body}</p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-slate-500 font-bold">Para:</span>
                                                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                                                        {getTechName(item.technician_id)}
                                                    </span>
                                                </div>
                                                {item.read && (
                                                    <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-bold">
                                                        <span className="material-symbols-outlined text-sm">done_all</span>
                                                        Lido
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
