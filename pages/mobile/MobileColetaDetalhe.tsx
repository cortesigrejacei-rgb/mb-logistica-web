
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useParams, useNavigate } from 'react-router-dom';

export const MobileColetaDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collections, updateCollectionStatus, uploadFile, currentTechnician, addStockItem, showToast } = useData();
  const task = collections.find(c => c.id === id);
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [observation, setObservation] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [hotlinkUrl, setHotlinkUrl] = useState('');
  const [serialInput, setSerialInput] = useState(task?.serialNumber || '');
  const [isScanning, setIsScanning] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
      }
    }
  }, [selectedResult]);

  if (!task || !currentTechnician) return <div className="p-4 text-white">Carregando detalhes...</div>;

  const displayId = task.id.replace(/\D/g, '');
  const modeloExibicao = task.notes?.includes('Modem') ? task.notes.split('-')[0].trim() : 'Nokia G-240W-A';

  // Assinatura Digital Logic
  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx?.lineTo(x, y);
    ctx?.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    ctx?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setHotlinkUrl('');
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinalize = async () => {
    if (!selectedResult) {
      showToast('Selecione o resultado da visita.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      let finalUrl = hotlinkUrl || undefined;
      
      if (photoFile) {
        const uploaded = await uploadFile(photoFile, 'evidences', 'mobile');
        if (uploaded) finalUrl = uploaded;
      }

      // Em um app real, converteríamos o canvas em Blob e faríamos upload da assinatura também.
      
      let systemStatus: 'Coletado' | 'Falha' | 'Pendente' = 'Pendente';
      if (selectedResult === 'Coletado') systemStatus = 'Coletado';
      else if (selectedResult === 'Ausente' || selectedResult === 'Recusado') systemStatus = 'Falha';

      await updateCollectionStatus(task.id, systemStatus, finalUrl, undefined, serialInput, observation);
      
      if (systemStatus === 'Coletado' && serialInput) {
        await addStockItem({
          model: modeloExibicao,
          serial: serialInput,
          status: 'Usado',
          location: `Carro: ${currentTechnician.name}`
        });
      }

      showToast('Operação MB finalizada com sucesso!');
      navigate('/mobile/historico');
    } catch (e) {
      showToast('Erro ao salvar.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14] text-white font-display overflow-hidden relative">
      
      {/* Header Fiel ao estilo MB */}
      <div className="flex items-center p-5 bg-[#080c14] sticky top-0 z-30 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 active:scale-90 transition-transform">
           <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h1 className="flex-1 text-center font-black text-sm uppercase tracking-[3px] mr-10">Check-out de Coleta</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide space-y-8 pt-4 animate-fadeIn">
        
        {/* Info OS */}
        <div className="bg-primary/10 rounded-3xl p-6 border border-primary/20 flex justify-between items-center">
           <div>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-1">Ordem de Serviço</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">#{displayId}</h2>
           </div>
           <div className="size-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white text-3xl fill">inventory_2</span>
           </div>
        </div>

        {/* Detalhes Cliente */}
        <div className="space-y-4">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                 <span className="material-symbols-outlined text-primary">person</span>
              </div>
              <div>
                 <h3 className="text-lg font-black text-white">{task.client}</h3>
                 <p className="text-xs text-slate-500 font-bold">{task.address}</p>
              </div>
           </div>
        </div>

        {/* Equipamento & Serial */}
        <div className="bg-white/5 rounded-[32px] p-6 border border-white/10 space-y-5">
           <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipamento Identificado</h4>
              <span className="material-symbols-outlined text-primary text-xl">qr_code_scanner</span>
           </div>
           <div className="flex items-center gap-4">
              <div className="size-16 bg-black rounded-2xl flex items-center justify-center border border-white/5">
                 <span className="material-symbols-outlined text-slate-600 text-3xl">router</span>
              </div>
              <div className="flex-1">
                 <p className="text-white font-black text-sm uppercase">{modeloExibicao}</p>
                 <input 
                    type="text"
                    placeholder="DIGITE OU ESCANEIE O SERIAL"
                    className="w-full bg-black/40 border-b-2 border-primary/30 focus:border-primary text-white text-sm font-mono mt-2 py-1 outline-none transition-all uppercase"
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                 />
              </div>
           </div>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
           <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Resultado da Visita</h3>
           <div className="grid grid-cols-2 gap-3">
              {['Coletado', 'Ausente', 'Recusado', 'Agendado'].map((res) => (
                <button 
                  key={res}
                  onClick={() => setSelectedResult(res)}
                  className={`py-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                    selectedResult === res ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-white/5 border-white/10 text-slate-500'
                  }`}
                >
                  {res}
                </button>
              ))}
           </div>
        </div>

        {/* Signature Pad - O "100% Funcional" */}
        {selectedResult === 'Coletado' && (
           <div className="space-y-3 animate-slideUp">
              <div className="flex justify-between items-center px-1">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assinatura do Cliente</h3>
                 <button onClick={clearSignature} className="text-primary text-[10px] font-black uppercase">Limpar</button>
              </div>
              <div className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden relative">
                 <canvas 
                    ref={canvasRef}
                    width={350}
                    height={180}
                    className="w-full touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                 />
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-20">
                    <p className="text-[10px] font-black text-white uppercase tracking-[4px]">Assine Aqui</p>
                 </div>
              </div>
           </div>
        )}

        {/* Evidência: Foto ou Hotlink */}
        <div className="space-y-4">
           <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Evidência Fotográfica</h3>
           <div className="space-y-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-16 bg-white/5 rounded-2xl border border-dashed border-white/20 flex items-center justify-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:border-primary/50 transition-all"
              >
                 <span className="material-symbols-outlined">add_a_photo</span>
                 {photoFile ? 'Foto Capturada' : 'Tirar Foto'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              
              <div className="relative">
                 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-[18px]">link</span>
                 <input 
                    type="url"
                    placeholder="OU COLE O HOTLINK DA IMAGEM..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[10px] text-white font-bold placeholder:text-slate-700 focus:border-primary/40 outline-none transition-all"
                    value={hotlinkUrl}
                    onChange={(e) => {
                       setHotlinkUrl(e.target.value);
                       if (e.target.value) { setPhotoFile(null); setPhotoPreview(null); }
                    }}
                 />
              </div>

              {photoPreview && (
                 <div className="rounded-[32px] overflow-hidden border border-white/10 mt-2 shadow-2xl">
                    <img src={photoPreview} className="w-full h-auto" alt="Preview" />
                 </div>
              )}
           </div>
        </div>

        {/* Observações */}
        <div className="space-y-3 pb-10">
           <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Observações da Visita</h3>
           <textarea 
             className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 text-sm text-white placeholder:text-slate-700 focus:border-primary/40 outline-none h-32 resize-none"
             placeholder="Detalhes opcionais sobre a visita..."
             value={observation}
             onChange={(e) => setObservation(e.target.value)}
           ></textarea>
        </div>

      </div>

      {/* Botão Fixo de Ação */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#080c14] via-[#080c14] to-transparent z-40">
         <button 
           onClick={handleFinalize}
           disabled={isUploading || !selectedResult}
           className="w-full h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-[3px] text-sm shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
         >
            {isUploading ? (
              <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                Finalizar Atendimento
                <span className="material-symbols-outlined font-bold">send</span>
              </>
            )}
         </button>
      </div>
    </div>
  );
};
