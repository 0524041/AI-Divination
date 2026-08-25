import React, { useState } from 'react';
import { getFlowMutagens } from '@/lib/astro';

interface Star {
    name: string;
    brightness?: string;
    type?: 'major' | 'minor' | 'adjective' | 'soft' | 'tough' | 'lucun' | 'tianma' | 'flower' | 'helper' | 'changsheng' | 'boshi';
    mutagen?: string;
}

interface Palace {
    index: number;
    name: string;
    heavenlyStem: string;
    earthlyBranch: string;
    majorStars: Star[];
    minorStars: Star[];
    adjectiveStars?: Star[];
    changsheng12?: string;
    boshi12?: string;
    jiangqian12?: string;
    suiqian12?: string;
    decadal?: {
        range: number[];
    };
    ages?: number[];
    isBodyPalace?: boolean;
    isSoulPalace?: boolean;
}

interface ZiweiChartProps {
    chart: any;
    viewMode: 'natal' | 'yearly' | 'monthly' | 'daily';
    centerInfo?: {
        name: string;
        gender: string;
        fiveElements: string;
        birthDate: string;
        solarDate: string;
        lunarDate: string;
        bazi?: string;
        lunarInfo?: {
            description: string;
        };
        correctionNote?: string;
    };
}

const GRID_POSITIONS: Record<string, { row: number; col: number }> = {
    '巳': { row: 0, col: 0 },
    '午': { row: 0, col: 1 },
    '未': { row: 0, col: 2 },
    '申': { row: 0, col: 3 },
    '酉': { row: 1, col: 3 },
    '戌': { row: 2, col: 3 },
    '亥': { row: 3, col: 3 },
    '子': { row: 3, col: 2 },
    '丑': { row: 3, col: 1 },
    '寅': { row: 3, col: 0 },
    '卯': { row: 2, col: 0 },
    '辰': { row: 1, col: 0 },
};

const MUTAGEN_MAP = ['祿', '權', '科', '忌'];

const getRelatedIndices = (index: number) => {
    const opposite = (index + 6) % 12;
    const trine1 = (index + 4) % 12;
    const trine2 = (index + 8) % 12;
    return [opposite, trine1, trine2];
};

export const ZiweiChart: React.FC<ZiweiChartProps> = ({
    chart,
    viewMode,
    centerInfo
}) => {
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    const baseChart = chart.palaces ? chart : chart.astrolabe;
    const flowData = chart.palaces ? null : chart;

    if (!baseChart || !baseChart.palaces) {
        return <div className="p-4 text-center text-[var(--cinnabar)]">命盤資料錯誤</div>;
    }

    const soulPalaceIndex = baseChart.palaces.findIndex((p: any) => p.isSoulPalace);

    const decadalIndex = flowData?.decadal?.index;
    const yearlyIndex = flowData?.yearly?.index;
    const monthlyIndex = flowData?.monthly?.index;
    const dailyIndex = flowData?.daily?.index;

    const decadalStem = flowData?.decadal?.heavenlyStem;
    const yearlyStem = flowData?.yearly?.heavenlyStem;
    const monthlyStem = flowData?.monthly?.heavenlyStem;
    const dailyStem = flowData?.daily?.heavenlyStem;

    const getMutagenList = (stem: string) => {
        if (!stem) return [];
        return getFlowMutagens(stem);
    };

    const decadalMutagens = getMutagenList(decadalStem);
    const yearlyMutagens = getMutagenList(yearlyStem);
    const monthlyMutagens = getMutagenList(monthlyStem);
    const dailyMutagens = getMutagenList(dailyStem);

    const hasPositiveMutagen = (starName: string, originalMutagen?: string) => {
        if (originalMutagen && ['祿', '權', '科'].includes(originalMutagen)) return true;

        const checkFlow = (mutagens: string[]) => {
            const idx = mutagens.indexOf(starName as any);
            return idx !== -1 && idx !== 3;
        };

        if (checkFlow(decadalMutagens)) return true;
        if (viewMode !== 'natal') {
            if (checkFlow(yearlyMutagens)) return true;
            if (viewMode === 'monthly' || viewMode === 'daily') {
                if (checkFlow(monthlyMutagens)) return true;
            }
            if (viewMode === 'daily') {
                if (checkFlow(dailyMutagens)) return true;
            }
        }
        return false;
    };

    const renderMutagenBadge = (starName: string, level: string, mutagens: string[], colorClass: string) => {
        const idx = mutagens.indexOf(starName as any);
        if (idx !== -1) {
            return (
                <span className={`text-[9px] px-[2px] rounded border ${colorClass} ml-[1px]`}>
                    {level}{MUTAGEN_MAP[idx]}
                </span>
            );
        }
        return null;
    };

    const getPalaceByBranch = (branch: string) => baseChart.palaces.find((p: any) => p.earthlyBranch === branch);

    // 四化色彩（token 化：祿=玉青、權=朱砂、科=金、忌=朱砂加粗）
    const getMutagenColor = (mutagen?: string) => {
        switch (mutagen) {
            case '祿': return 'bg-background-secondary text-[var(--jade)] border-[var(--jade)]';
            case '權': return 'bg-background-secondary text-[var(--cinnabar)] border-[var(--cinnabar)]';
            case '科': return 'bg-background-secondary text-accent border-accent';
            case '忌': return 'bg-background-secondary text-[var(--cinnabar)] border-[var(--cinnabar)] font-bold';
            default: return 'text-foreground-muted bg-background-secondary';
        }
    };

    const getBrightnessColor = (brightness?: string) => {
        if (brightness === '廟' || brightness === '旺') return 'text-[var(--cinnabar)] font-bold';
        if (brightness === '平' || brightness === '利' || brightness === '得') return 'text-foreground-secondary';
        return 'text-foreground-muted opacity-80';
    };

    const relatedIndices = focusedIndex !== null ? getRelatedIndices(focusedIndex) : [];

    const handlePalaceClick = (index: number) => {
        if (focusedIndex === index) {
            setFocusedIndex(null);
        } else {
            setFocusedIndex(index);
        }
    };

    const handlePalaceKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            setFocusedIndex(index);
        }
    };

    // 流層標記色（token 化）
    const LEVEL_BADGES = {
        natal: 'bg-accent-light text-accent border-accent',
        decadal: 'bg-background-secondary text-[var(--jade)] border-[var(--jade)]',
        yearly: 'bg-background-secondary text-accent border-accent',
        monthly: 'bg-background-secondary text-foreground-secondary border-border',
        daily: 'bg-background-secondary text-[var(--cinnabar)] border-[var(--cinnabar)]',
    };

    return (
        <div className="w-full overflow-x-auto rounded-lg shadow-2xl bg-background-card border-4 border-double border-border-accent">

            <div className="min-w-[800px] md:w-full max-w-[1000px] mx-auto aspect-[4/4] p-1 relative font-serif text-foreground-primary select-none">

                <div className="absolute inset-0 opacity-5 pointer-events-none bg-center bg-no-repeat dark:block hidden"
                    style={{ backgroundImage: 'radial-gradient(circle, var(--gold) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <div className="grid grid-cols-4 grid-rows-4 h-full w-full gap-[2px] bg-background-secondary">

                    <div className="col-start-2 row-start-2 col-span-2 row-span-2 flex flex-col items-center justify-center p-2 text-center bg-background-card z-20 shadow-lg border border-border-accent overflow-y-auto">
                        {centerInfo ? (
                            <div className="w-full h-full flex flex-col justify-start py-2 text-sm">
                                <div className="mb-2">
                                    <h2 className="text-3xl font-bold text-accent tracking-widest">
                                        {centerInfo.name}
                                    </h2>
                                    <div className="flex justify-center gap-2 text-sm text-foreground-secondary mt-1 font-bold">
                                        <span>{centerInfo.gender === 'male' ? '乾造' : '坤造'}</span>
                                        <span>{centerInfo.fiveElements}</span>
                                    </div>
                                </div>

                                {viewMode !== 'natal' && (
                                    <div className="text-xl font-bold text-accent mb-2">
                                        {viewMode === 'yearly' && `流年：${flowData?.yearly?.heavenlyStem}${flowData?.yearly?.earthlyBranch}年`}
                                        {viewMode === 'monthly' && `流月：${flowData?.monthly?.heavenlyStem}${flowData?.monthly?.earthlyBranch}月`}
                                        {viewMode === 'daily' && `流日：${flowData?.daily?.heavenlyStem}${flowData?.daily?.earthlyBranch}日`}
                                    </div>
                                )}

                                <div className="flex flex-col gap-1 text-left text-sm px-8 mb-2 bg-background-primary py-2 rounded items-center">
                                    <div className="w-full flex justify-between border-b border-border pb-1">
                                        <span className="text-foreground-muted">陽曆</span>
                                        <span className="font-medium">{centerInfo.solarDate}</span>
                                    </div>
                                    <div className="w-full flex justify-between border-b border-border pb-1">
                                        <span className="text-foreground-muted">農曆</span>
                                        <span className="font-medium">{centerInfo.lunarInfo?.description}</span>
                                    </div>
                                    <div className="w-full flex justify-between pt-1">
                                        <span className="text-foreground-muted">干支</span>
                                        <span className="font-medium">{centerInfo.bazi}</span>
                                    </div>
                                </div>

                                <div className="w-full px-2 mt-1">
                                    <div className="grid grid-cols-5 text-sm border-b border-border pb-1 mb-1 font-bold text-foreground-muted">
                                        <span>四化</span>
                                        <span className="text-[var(--jade)]">祿</span>
                                        <span className="text-[var(--cinnabar)]">權</span>
                                        <span className="text-accent">科</span>
                                        <span className="text-[var(--cinnabar)] font-bold">忌</span>
                                    </div>

                                    <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                        <span className={`font-bold px-1 rounded border ${LEVEL_BADGES.natal}`}>生年</span>
                                        {getFlowMutagens(baseChart.chineseDate?.charAt(0) || '').map((star) => (
                                            <span key={`mutagen-origin-${star}`}>{star}</span>
                                        ))}
                                    </div>

                                    {decadalStem && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className={`font-bold px-1 rounded border ${LEVEL_BADGES.decadal}`}>大限</span>
                                            {decadalMutagens.map((star) => <span key={`mutagen-decadal-${star}`}>{star}</span>)}
                                        </div>
                                    )}

                                    {yearlyStem && viewMode !== 'natal' && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className={`font-bold px-1 rounded border ${LEVEL_BADGES.yearly}`}>流年</span>
                                            {yearlyMutagens.map((star) => <span key={`mutagen-yearly-${star}`}>{star}</span>)}
                                        </div>
                                    )}

                                    {monthlyStem && (viewMode === 'monthly' || viewMode === 'daily') && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className={`font-bold px-1 rounded border ${LEVEL_BADGES.monthly}`}>流月</span>
                                            {monthlyMutagens.map((star) => <span key={`mutagen-monthly-${star}`}>{star}</span>)}
                                        </div>
                                    )}

                                    {dailyStem && viewMode === 'daily' && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className={`font-bold px-1 rounded border ${LEVEL_BADGES.daily}`}>流日</span>
                                            {dailyMutagens.map((star) => <span key={`mutagen-daily-${star}`}>{star}</span>)}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto flex flex-wrap justify-center gap-2 text-xs pt-2 border-t border-border font-bold">
                                    <span className="bg-[var(--cinnabar)] text-white px-2 py-0.5 rounded">命宮</span>
                                    <span className="bg-background-secondary text-[var(--jade)] border border-[var(--jade)] px-2 py-0.5 rounded">大限</span>
                                    <span className="bg-background-secondary text-accent border border-accent px-2 py-0.5 rounded">流年</span>
                                    <span className="bg-background-secondary text-foreground-secondary border border-border px-2 py-0.5 rounded">流月</span>
                                    <span className="bg-background-secondary text-[var(--cinnabar)] border border-[var(--cinnabar)] px-2 py-0.5 rounded">流日</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-2xl opacity-50">紫微斗數排盤</span>
                        )}
                    </div>

                    {Object.entries(GRID_POSITIONS).map(([branch, pos]) => {
                        const palace = getPalaceByBranch(branch);
                        if (!palace) return <div key={`empty-${branch}`} className="bg-background-secondary" />;

                        const isSoul = palace.index === soulPalaceIndex;
                        const isDecadal = palace.index === decadalIndex;
                        const isYearly = palace.index === yearlyIndex;
                        const isMonthly = palace.index === monthlyIndex;
                        const isDaily = palace.index === dailyIndex;

                        let isCore = false;
                        if (viewMode === 'natal' && palace.name === '命宮') isCore = true;
                        else if (viewMode === 'yearly' && isYearly) isCore = true;
                        else if (viewMode === 'monthly' && isMonthly) isCore = true;
                        else if (viewMode === 'daily' && isDaily) isCore = true;

                        const hasPositiveEnergy = palace.majorStars.some((s: Star) => hasPositiveMutagen(s.name, s.mutagen));

                        const isFocused = focusedIndex === palace.index;
                        const isRelated = relatedIndices.includes(palace.index);

                        return (
                            <button
                                type="button"
                                key={`palace-${branch}`}
                                onClick={() => handlePalaceClick(palace.index)}
                                onKeyDown={(e) => handlePalaceKeyDown(e, palace.index)}
                                aria-pressed={isFocused}
                                className={`
                                    relative p-[2px] flex flex-col justify-between overflow-hidden cursor-pointer text-left
                                    hover:z-30 hover:shadow-2xl transition-all duration-200 border
                                    ${isCore ? 'bg-accent-light border-border-accent' :
                                        hasPositiveEnergy ? 'bg-background-secondary border-border-accent' :
                                            'bg-background-card border-border'}

                                    ${isRelated ? 'bg-accent-light ring-2 ring-[var(--gold)]' : ''}
                                    ${isFocused ? 'ring-4 ring-accent z-20 shadow-xl scale-[1.02]' : ''}
                                    ${isSoul ? 'ring-2 ring-inset ring-[var(--cinnabar)]' : ''}
                                `}
                                style={{
                                    gridRow: pos.row + 1,
                                    gridColumn: pos.col + 1
                                }}
                            >
                                <div className="flex justify-between items-start px-1 pt-0.5 border-b border-border pb-0.5">
                                    <div className="flex flex-col leading-none text-xs font-mono text-foreground-muted font-bold">
                                        <span>{palace.heavenlyStem}</span>
                                        <span>{palace.earthlyBranch}</span>
                                    </div>

                                    <div className="flex flex-col items-center flex-1 mx-1">
                                        <div className={`
                                            text-base font-bold px-1 rounded shadow-sm w-full text-center
                                            ${isSoul ? 'bg-[var(--cinnabar)] text-white' : 'bg-accent-light text-foreground-primary'}
                                        `}>
                                            {palace.name}
                                        </div>

                                        <div className="flex flex-wrap justify-center gap-[1px] w-full mt-[1px]">
                                            {isDecadal && <span className={`text-[10px] px-1 rounded-sm leading-tight font-bold border ${LEVEL_BADGES.decadal}`}>大{palace.name}</span>}
                                            {isYearly && <span className={`text-[10px] px-1 rounded-sm leading-tight font-bold border ${LEVEL_BADGES.yearly}`}>年{palace.name}</span>}
                                            {isMonthly && <span className={`text-[10px] px-1 rounded-sm leading-tight font-bold border ${LEVEL_BADGES.monthly}`}>月{palace.name}</span>}
                                            {isDaily && <span className={`text-[10px] px-1 rounded-sm leading-tight font-bold border ${LEVEL_BADGES.daily}`}>日{palace.name}</span>}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end text-[10px] text-foreground-muted leading-none font-medium">
                                        <span>{palace.changsheng12}</span>
                                        <span>{palace.boshi12}</span>
                                        {isYearly && <span className="text-[var(--jade)]">{palace.jiangqian12}</span>}
                                        {isYearly && <span className="text-[var(--jade)]">{palace.suiqian12}</span>}
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-2 gap-0.5 px-0.5 py-0.5 min-h-0 relative">

                                    <div className="flex flex-col content-start gap-[1px] text-[11px] leading-tight overflow-hidden">
                                        {palace.minorStars?.map((star: Star) => (
                                            <div key={`${star.name}-minor`} className="flex items-center flex-wrap">
                                                <span className={star.brightness === '陷' ? 'text-foreground-muted' : 'text-foreground-secondary'}>
                                                    {star.name}
                                                </span>
                                                {star.mutagen && (
                                                    <span className={`ml-[1px] text-[9px] px-[1px] rounded border ${getMutagenColor(star.mutagen)}`}>
                                                        {star.mutagen}
                                                    </span>
                                                )}
                                                {renderMutagenBadge(star.name, '大', decadalMutagens, 'text-[var(--jade)] border-[var(--jade)]')}
                                                {renderMutagenBadge(star.name, '年', yearlyMutagens, 'text-accent border-accent')}
                                                {renderMutagenBadge(star.name, '月', monthlyMutagens, 'text-foreground-secondary border-border')}
                                                {renderMutagenBadge(star.name, '日', dailyMutagens, 'text-[var(--cinnabar)] border-[var(--cinnabar)]')}
                                            </div>
                                        ))}
                                        <div className="flex flex-wrap gap-x-1 opacity-70 text-[10px] mt-1">
                                            {palace.adjectiveStars?.map((star: Star) => (
                                                <span key={`${star.name}-adj`}>{star.name}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-0.5 text-right">
                                        {palace.majorStars.map((star: Star) => (
                                            <div key={`${star.name}-major`} className={`flex flex-col items-end leading-none ${getBrightnessColor(star.brightness)}`}>
                                                <div className="flex items-center justify-end flex-wrap gap-[1px]">
                                                    <span className="text-lg font-bold tracking-widest">{star.name}</span>

                                                    {star.mutagen && (
                                                        <span className={`text-[10px] w-3 h-3 flex items-center justify-center rounded font-bold border ${getMutagenColor(star.mutagen)}`}>
                                                            {star.mutagen}
                                                        </span>
                                                    )}

                                                    <div className="flex flex-col gap-[1px] items-end">
                                                        {renderMutagenBadge(star.name, '大', decadalMutagens, 'text-[var(--jade)] bg-background-secondary border-[var(--jade)]')}
                                                        {renderMutagenBadge(star.name, '年', yearlyMutagens, 'text-accent bg-background-secondary border-accent')}
                                                        {renderMutagenBadge(star.name, '月', monthlyMutagens, 'text-foreground-secondary bg-background-secondary border-border')}
                                                        {renderMutagenBadge(star.name, '日', dailyMutagens, 'text-[var(--cinnabar)] bg-background-secondary border-[var(--cinnabar)]')}
                                                    </div>
                                                </div>
                                                {star.brightness && <span className="text-[9px] opacity-70 scale-90 origin-right font-medium">({star.brightness})</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-border pt-0.5 px-1 flex justify-between items-end bg-background-primary">
                                    {palace.decadal && (
                                        <div className="flex flex-col">
                                            <span className="text-xl font-bold text-accent font-sans leading-none">
                                                {palace.decadal.range[0]}-{palace.decadal.range[1]}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap justify-end gap-x-1 text-[10px] text-foreground-muted max-w-[60%] leading-none pb-0.5 font-medium">
                                        {palace.ages?.filter((a: number) => a <= 90).map((age: number) => (
                                            <span key={`age-${age}`} className={age === flowData?.age?.nominalAge ? 'text-[var(--cinnabar)] font-bold underline text-xs' : ''}>
                                                {age}
                                            </span>
                                        ))}
                                     </div>
                                 </div>
                             </button>
                         );
                    })}
                </div>
            </div>

            <div className="md:hidden text-center text-xs text-foreground-muted py-2">
                ← 左右滑動查看完整命盤 →
            </div>
        </div>
    );
};
