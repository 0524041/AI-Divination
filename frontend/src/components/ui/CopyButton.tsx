'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button, ButtonProps } from './Button';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
    text: string;
    onCopied?: () => void;
    successMessage?: string;
}

/**
 * Safari-compatible copy button using ClipboardItem + Promise
 */
export function CopyButton({
    text,
    onCopied,
    successMessage = '已複製',
    children,
    ...props
}: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            // Try ClipboardItem first (Safari-compatible)
            if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
                const blob = new Blob([text], { type: 'text/plain' });
                const clipboardItem = new ClipboardItem({ 'text/plain': blob });
                await navigator.clipboard.write([clipboardItem]);
            }
            // Fallback to writeText
            else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            }
            // Last resort: execCommand
            else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;opacity:0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            setCopied(true);
            onCopied?.();
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            // Show prompt as last resort
            prompt('請手動複製:', text);
        }
    };

    return (
        <Button onClick={handleCopy} {...props}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {children || (copied ? successMessage : '複製')}
        </Button>
    );
}
