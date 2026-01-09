'use client';

import { HTMLAttributes, forwardRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
    open: boolean;
    onClose: () => void;
    title?: string;
    showCloseButton?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
    ({ className, open, onClose, title, showCloseButton = true, size = 'lg', children, ...props }, ref) => {

        // Handle escape key
        const handleEscape = useCallback((e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        }, [onClose]);

        useEffect(() => {
            if (open) {
                document.addEventListener('keydown', handleEscape);
                document.body.style.overflow = 'hidden';
            }
            return () => {
                document.removeEventListener('keydown', handleEscape);
                document.body.style.overflow = '';
            };
        }, [open, handleEscape]);

        if (!open) return null;

        const sizes = {
            sm: 'max-w-md',
            md: 'max-w-xl',
            lg: 'max-w-4xl',
            xl: 'max-w-6xl',
            full: 'max-w-full mx-4',
        };

        return (
            <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto animate-in fade-in">
                <div className="min-h-screen flex items-start justify-center p-4 pt-8">
                    <div
                        ref={ref}
                        className={cn(
                            'bg-[rgba(22,33,62,0.95)] backdrop-blur-xl border border-[rgba(212,175,55,0.3)] rounded-2xl w-full shadow-2xl',
                            sizes[size],
                            className
                        )}
                        {...props}
                    >
                        {/* Header */}
                        {(title || showCloseButton) && (
                            <div className="flex items-center justify-between p-6 border-b border-gray-700">
                                {title && (
                                    <h2 className="text-xl font-bold text-[var(--gold)] flex items-center gap-2">
                                        {title}
                                    </h2>
                                )}
                                {showCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                                    >
                                        <X size={24} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-6">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

Modal.displayName = 'Modal';

export { Modal };
