'use client';

/**
 * TarotCardFace — 後端抽牌結果的牌面呈現（Ticket 10）
 *
 * 儀式動畫與揭盤視圖共用；正逆位以圖像旋轉＋Badge 標記。
 */

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface DivinedTarotCard {
  id: number;
  name: string;
  name_cn: string;
  image: string;
  reversed: boolean;
  position: string;
  position_name: string;
}

interface TarotCardFaceProps {
  card: DivinedTarotCard;
  size?: 'sm' | 'md' | 'lg';
  showPosition?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-20 md:w-24',
  md: 'w-32 md:w-40',
  lg: 'w-52 md:w-64',
};

export function TarotCardFace({ card, size = 'md', showPosition = true, className }: TarotCardFaceProps) {
  return (
    <figure className={cn('flex flex-col items-center gap-2', className)}>
      {showPosition && (
        <figcaption className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
          {card.position_name}
        </figcaption>
      )}
      <div
        className={cn(
          'relative aspect-[2/3] rounded-xl overflow-hidden border-2 border-[var(--gold)] shadow-lg bg-background-secondary',
          SIZE_CLASSES[size]
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/tarot-cards/${card.image}`}
          alt={`${card.name_cn}（${card.reversed ? '逆位' : '正位'}）`}
          className={cn('absolute inset-0 w-full h-full object-cover', card.reversed && 'rotate-180')}
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent px-2 pt-6 pb-1.5 text-center">
          <p className="text-sm font-bold text-white leading-tight">{card.name_cn}</p>
          <p className="text-[10px] text-[var(--gold)] tracking-wider">{card.name}</p>
        </div>
      </div>
      <Badge variant={card.reversed ? 'warning' : 'accent'} size="sm">
        {card.reversed ? '逆位' : '正位'}
      </Badge>
    </figure>
  );
}
