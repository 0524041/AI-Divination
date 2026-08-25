'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background-secondary p-6 shadow-lg',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between mb-4">
          <DialogPrimitive.Title className="font-heading text-lg font-semibold text-foreground-primary">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="關閉"
            type="button"
            className="rounded-md p-1 text-foreground-muted hover:text-foreground-primary hover:bg-accent-light"
          >
            <X size={18} />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
