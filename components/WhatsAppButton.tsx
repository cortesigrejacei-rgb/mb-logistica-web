import React, { useState, useRef, useEffect } from 'react';
import { extractPhones } from '../utils/phoneUtils';

interface WhatsAppButtonProps {
    phoneString: string;
    className?: string;
    label?: string;
    showIcon?: boolean;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
    phoneString,
    className = "",
    label = "WhatsApp",
    showIcon = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const phones = extractPhones(phoneString);
    const hasInvalidPhone = phoneString && phones.length === 0;

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = (number: string) => {
        const cleanNumber = number.replace(/\D/g, '');
        const url = `https://wa.me/55${cleanNumber}`;
        window.open(url, '_blank');
        setIsOpen(false);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (phones.length <= 1) {
            if (phones.length === 1) {
                handleAction(phones[0]);
            } else if (hasInvalidPhone) {
                alert(`O formato do telefone "${phoneString}" não é reconhecido como um número válido do WhatsApp.`);
            }
        } else {
            setIsOpen(!isOpen);
        }
    };

    if (!phoneString || (phones.length === 0 && !hasInvalidPhone)) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={handleClick}
                disabled={hasInvalidPhone}
                className={`flex items-center justify-center gap-2 transition-all ${className} ${hasInvalidPhone ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                title={hasInvalidPhone ? `Formato inválido: ${phoneString}` : (phones.length > 1 ? "Selecionar número de WhatsApp" : "Abrir WhatsApp")}
            >
                {showIcon && <span className="material-symbols-outlined text-[20px]">{hasInvalidPhone ? 'block' : 'chat'}</span>}
                {label}
                {phones.length > 1 && (
                    <span className="material-symbols-outlined text-[16px] opacity-50">arrow_drop_down</span>
                )}
            </button>

            {isOpen && phones.length > 1 && (
                <div className="absolute bottom-full mb-2 left-0 w-64 bg-surface-dark border border-border-dark rounded-2xl shadow-2xl z-[100] overflow-hidden animate-scaleIn">
                    <div className="p-4 border-b border-border-dark bg-background-dark/50">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selecione o número</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {phones.map((phone, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(phone);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-primary/10 flex items-center justify-between group transition-colors"
                            >
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">WhatsApp {idx + 1}</span>
                                    <span className="text-white text-sm font-mono font-bold group-hover:text-primary transition-colors">{phone}</span>
                                </div>
                                <span className="material-symbols-outlined text-emerald-400 text-[18px]">open_in_new</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
