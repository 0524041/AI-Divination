'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
  mustRead?: boolean;
}

export function TutorialModal({ open, onClose, mustRead = false }: TutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !mustRead && onClose()}>
      <DialogContent className="glass-panel max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[var(--gold)] flex items-center gap-2">
            🎓 六爻占卜教學
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-card-foreground">
          <section>
            <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">🎯 什麼是六爻？</h3>
            <p className="leading-relaxed">
              六爻是中國古老的占卜方法，通過擲三枚銅錢六次，形成六個爻，組成卦象來預測吉凶。
              每個爻可以是陽爻（⚊）或陰爻（⚋），其中「老陽」和「老陰」為動爻，會產生變卦。
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">✅ 正確的問卦方式</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>問具體事情</strong>：這次投資會順利嗎？</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>問走勢趨勢</strong>：最近三個月的財運如何？</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>問一件事</strong>：這份工作適合我嗎？</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>問方向建議</strong>：向東還是向西發展更好？</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">❌ 錯誤的問卦方式</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-500">✗</span>
                <span>BTC 什麼時候會 ATH？（問具體時間點）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">✗</span>
                <span>我未來會不會中樂透？（問必然事件）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">✗</span>
                <span>我會活到幾歲？（問壽命）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">✗</span>
                <span>同時問多件事情</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-[var(--gold)] mb-2">🙏 問卦心法</h3>
            <div className="space-y-3 bg-muted/20 p-4 rounded-lg">
              <p>
                <strong className="text-[var(--gold)]">心誠則靈</strong> — 
                占卜之法，首重其誠。無事不占，不動不占。
              </p>
              <p>
                <strong className="text-[var(--gold)]">一事一占</strong> — 
                一事只可一占，反覆問之則為褻瀆。
              </p>
            </div>
          </section>

          {mustRead && (
            <div className="pt-4 border-t border-border/50 text-center">
              <p className="text-[var(--gold)] mb-4">您已閱讀並了解問卦規則了嗎？</p>
              <Button className="btn-gold px-8" onClick={onClose}>
                我已了解，開始問卦
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
