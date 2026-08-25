'use client';

import { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { Button, ButtonProps } from './Button';
import { apiPost } from '@/lib/api-client';
import { useToast } from './Toast';

export interface ShareButtonProps extends Omit<ButtonProps, 'onClick' | 'onError'> {
  historyId: number;
  onSuccess?: (shareUrl: string) => void;
  onShareError?: (error: Error) => void;
}

/**
 * Safari-compatible share button using ClipboardItem + Promise
 * Creates share link and copies to clipboard in one action
 */
export function ShareButton({
  historyId,
  onSuccess,
  onShareError,
  children,
  ...props
}: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');
  const { toast } = useToast();

  const handleShare = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setState('loading');

    // Create async function for getting share URL
    const getShareUrl = async (): Promise<string> => {
      const res = await apiPost('/api/share/create', { history_id: historyId });
      const data = await res.json();
      return `${window.location.origin}${data.share_url}`;
    };

    try {
      // Safari fix: use ClipboardItem + Promise
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const textPromise = getShareUrl().then(url => new Blob([url], { type: 'text/plain' }));
        const clipboardItem = new ClipboardItem({ 'text/plain': textPromise });
        await navigator.clipboard.write([clipboardItem]);

        const shareUrl = await getShareUrl(); // Get URL for callback
        toast('連結已複製到剪貼簿', { kind: 'success' });
        onSuccess?.(shareUrl);
        setState('success');
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      // Fallback for other browsers
      const shareUrl = await getShareUrl();

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast('連結已複製到剪貼簿', { kind: 'success' });
          onSuccess?.(shareUrl);
          setState('success');
          setTimeout(() => setState('idle'), 3000);
          return;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed:', clipboardErr);
        }
      }

      // Last resort
      toast('分享連結已建立，請手動複製', { kind: 'info' });
      setState('idle');
    } catch (err) {
      console.error('Share error:', err);
      toast('建立分享連結失敗，請稍後再試', { kind: 'error' });
      onShareError?.(err instanceof Error ? err : new Error(String(err)));
      setState('idle');
    }
  };

  const icon = state === 'loading'
    ? <Loader2 className="animate-spin" size={16} />
    : state === 'success'
      ? <Check size={16} />
      : <Share2 size={16} />;

  return (
    <Button
      onClick={handleShare}
      disabled={state === 'loading'}
      {...props}
    >
      {icon}
      {children || (state === 'success' ? '已分享' : '分享')}
    </Button>
  );
}
