'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  title?: string;
  description: string;
}

const ToastContext = createContext<{
  toast: (description: string, opts?: { kind?: ToastKind; title?: string }) => void;
}>({ toast: () => {} });

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (description: string, opts?: { kind?: ToastKind; title?: string }) => {
      setItems((prev) => [
        ...prev.slice(-3),
        { id: nextId++, kind: opts?.kind ?? 'info', title: opts?.title, description },
      ]);
    },
    []
  );

  const remove = (id: number) =>
    setItems((prev) => prev.filter((t) => t.id !== id));

  const styles: Record<ToastKind, string> = {
    success: 'border-jade/60',
    error: 'border-[var(--cinnabar)]/60',
    info: 'border-border-accent',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            duration={4200}
            onOpenChange={(open) => !open && remove(item.id)}
            className={cn(
              'fixed bottom-5 right-5 z-[60] rounded-lg border bg-background-secondary px-4 py-3 shadow-lg max-w-sm',
              styles[item.kind]
            )}
          >
            {item.title && (
              <ToastPrimitive.Title className="font-semibold text-foreground-primary text-sm mb-0.5">
                {item.title}
              </ToastPrimitive.Title>
            )}
            <ToastPrimitive.Description className="text-sm text-foreground-secondary">
              {item.description}
            </ToastPrimitive.Description>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
