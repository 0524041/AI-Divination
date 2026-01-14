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
        return <div className="p-4 text-center text-red-500">命盤資料錯誤</div>;
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

    const getMutagenColor = (mutagen?: string) => {
        switch (mutagen) {
            case '祿': return 'bg-green-100 text-green-700 border-green-200';
            case '權': return 'bg-red-100 text-red-700 border-red-200';
            case '科': return 'bg-blue-100 text-blue-700 border-blue-200';
            case '忌': return 'bg-yellow-100 text-red-600 border-red-200 font-bold';
            default: return 'text-gray-500 bg-gray-100';
        }
    };

    const getBrightnessColor = (brightness?: string) => {
        if (brightness === '廟' || brightness === '旺') return 'text-red-700 dark:text-[#ff3333] font-bold';
        if (brightness === '平' || brightness === '利' || brightness === '得') return 'text-gray-700 dark:text-gray-300';
        return 'text-gray-500 dark:text-gray-500 opacity-80'; 
    };

    const relatedIndices = focusedIndex !== null ? getRelatedIndices(focusedIndex) : [];

    const handlePalaceClick = (index: number) => {
        setFocusedIndex(index);
    };

    const handlePalaceKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            setFocusedIndex(index);
        }
    };

    return (
        <div className="w-full overflow-x-auto rounded-lg shadow-2xl bg-white dark:bg-[#1a0b2e] border-4 border-double border-amber-600 dark:border-[#d4af37]">

            <div className="min-w-[800px] md:w-full max-w-[1000px] mx-auto aspect-[4/4] p-1 relative font-serif text-gray-800 dark:text-[#d4af37] select-none">

                <div className="absolute inset-0 opacity-5 pointer-events-none bg-center bg-no-repeat dark:block hidden"
                    style={{ backgroundImage: 'radial-gradient(circle, #d4af37 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <div className="grid grid-cols-4 grid-rows-4 h-full w-full gap-[2px] bg-amber-200 dark:bg-[#d4af37]/20">

                    <div className="col-start-2 row-start-2 col-span-2 row-span-2 flex flex-col items-center justify-center p-2 text-center bg-white/95 dark:bg-[#1a0b2e]/95 z-20 shadow-lg border border-amber-100 overflow-y-auto">
                        {centerInfo ? (
                            <div className="w-full h-full flex flex-col justify-start py-2 text-sm">
                                <div className="mb-2">
                                    <h2 className="text-3xl font-bold text-amber-900 dark:text-[#d4af37] tracking-widest">
                                        {centerInfo.name}
                                    </h2>
                                    <div className="flex justify-center gap-2 text-sm text-gray-500 mt-1 font-bold">
                                        <span>{centerInfo.gender === 'male' ? '乾造' : '坤造'}</span>
                                        <span>{centerInfo.fiveElements}</span>
                                    </div>
                                </div>

                                {viewMode !== 'natal' && (
                                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                                        {viewMode === 'yearly' && `流年：${flowData?.yearly?.heavenlyStem}${flowData?.yearly?.earthlyBranch}年`}
                                        {viewMode === 'monthly' && `流月：${flowData?.monthly?.heavenlyStem}${flowData?.monthly?.earthlyBranch}月`}
                                        {viewMode === 'daily' && `流日：${flowData?.daily?.heavenlyStem}${flowData?.daily?.earthlyBranch}日`}
                                    </div>
                                )}

                                <div className="flex flex-col gap-1 text-left text-sm px-8 mb-2 bg-gray-50 dark:bg-white/5 py-2 rounded items-center">
                                    <div className="w-full flex justify-between border-b border-gray-200/50 pb-1">
                                        <span className="text-gray-400">陽曆</span>
                                        <span className="font-medium">{centerInfo.solarDate}</span>
                                    </div>
                                    <div className="w-full flex justify-between border-b border-gray-200/50 pb-1">
                                        <span className="text-gray-400">農曆</span>
                                        <span className="font-medium">{centerInfo.lunarInfo?.description}</span>
                                    </div>
                                    <div className="w-full flex justify-between pt-1">
                                        <span className="text-gray-400">干支</span>
                                        <span className="font-medium">{centerInfo.bazi}</span>
                                    </div>
                                </div>

                                <div className="w-full px-2 mt-1">
                                    <div className="grid grid-cols-5 text-sm border-b border-gray-200 dark:border-gray-700 pb-1 mb-1 font-bold text-gray-500">
                                        <span>四化</span>
                                        <span className="text-green-600">祿</span>
                                        <span className="text-red-600">權</span>
                                        <span className="text-blue-600">科</span>
                                        <span className="text-amber-600">忌</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                        <span className="font-bold bg-red-100 dark:bg-red-900/30 px-1 rounded text-red-700">生年</span>
                                        {getFlowMutagens(baseChart.chineseDate?.charAt(0) || '').map((star, i) => (
                                            <span key={`mutagen-origin-${i}`}>{star}</span>
                                        ))}
                                    </div>

                                    {decadalStem && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className="font-bold bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-blue-700">大限</span>
                                            {decadalMutagens.map((star, i) => <span key={`mutagen-decadal-${i}`}>{star}</span>)}
                                        </div>
                                    )}

                                    {yearlyStem && viewMode !== 'natal' && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className="font-bold bg-green-100 dark:bg-green-900/30 px-1 rounded text-green-700">流年</span>
                                            {yearlyMutagens.map((star, i) => <span key={`mutagen-yearly-${i}`}>{star}</span>)}
                                        </div>
                                    )}

                                    {monthlyStem && (viewMode === 'monthly' || viewMode === 'daily') && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className="font-bold bg-purple-100 dark:bg-purple-900/30 px-1 rounded text-purple-700">流月</span>
                                            {monthlyMutagens.map((star, i) => <span key={`mutagen-monthly-${i}`}>{star}</span>)}
                                        </div>
                                    )}

                                    {dailyStem && viewMode === 'daily' && (
                                        <div className="grid grid-cols-5 text-sm items-center mb-1 font-medium">
                                            <span className="font-bold bg-orange-100 dark:bg-orange-900/30 px-1 rounded text-orange-700">流日</span>
                                            {dailyMutagens.map((star, i) => <span key={`mutagen-daily-${i}`}>{star}</span>)}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto flex flex-wrap justify-center gap-2 text-xs pt-2 border-t border-gray-100 font-bold">
                                    <span className="bg-red-600 text-white px-2 py-0.5 rounded">命宮</span>
                                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded">大限</span>
                                    <span className="bg-green-600 text-white px-2 py-0.5 rounded">流年</span>
                                    <span className="bg-purple-600 text-white px-2 py-0.5 rounded">流月</span>
                                    <span className="bg-orange-600 text-white px-2 py-0.5 rounded">流日</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-2xl opacity-50">紫微斗數排盤</span>
                        )}
                    </div>

                    {Object.entries(GRID_POSITIONS).map(([branch, pos]) => {
                        const palace = getPalaceByBranch(branch);
                        if (!palace) return <div key={branch} className="bg-gray-100" />;

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
                            <div
                                key={`palace-${branch}`}
                                onClick={() => handlePalaceClick(palace.index)}
                                onKeyDown={(e) => handlePalaceKeyDown(e, palace.index)}
                                role="button"
                                tabIndex={0}
                                className={`
                                    relative p-[2px] flex flex-col justify-between overflow-hidden cursor-pointer
                                    hover:z-30 hover:shadow-2xl transition-all duration-200 border
                                    ${isCore ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-300' : 
                                      hasPositiveEnergy ? 'bg-green-50 dark:bg-green-900/20 border-green-200' :
                                      'bg-white dark:bg-[#1f1137] border-gray-200 dark:border-white/10'}
                                    
                                    ${isRelated ? 'bg-yellow-50 dark:bg-yellow-900/30 !border-yellow-400 ring-1 ring-yellow-400' : ''}
                                    ${isFocused ? 'ring-2 ring-accent z-10' : ''}
                                    ${isSoul ? 'ring-2 ring-inset ring-red-500' : ''}
                                `}
                                style={{
                                    gridRow: pos.row + 1,
                                    gridColumn: pos.col + 1
                                }}
                            >
                                <div className="flex justify-between items-start px-1 pt-0.5 border-b border-gray-100 dark:border-white/5 pb-0.5">
                                    <div className="flex flex-col leading-none text-xs font-mono text-gray-500 font-bold">
                                        <span>{palace.heavenlyStem}</span>
                                        <span>{palace.earthlyBranch}</span>
                                    </div>

                                    <div className="flex flex-col items-center flex-1 mx-1">
                                        <div className={`
                                            text-base font-bold px-1 rounded shadow-sm w-full text-center
                                            ${isSoul ? 'bg-red-600 text-white' : 'bg-amber-50 text-amber-900'}
                                        `}>
                                            {palace.name}
                                        </div>
                                        
                                        <div className="flex flex-wrap justify-center gap-[1px] w-full mt-[1px]">
                                            {isDecadal && <span className="text-[10px] bg-blue-600 text-white px-1 rounded-sm leading-tight font-bold">大{palace.name}</span>}
                                            {isYearly && <span className="text-[10px] bg-green-600 text-white px-1 rounded-sm leading-tight font-bold">年{palace.name}</span>}
                                            {isMonthly && <span className="text-[10px] bg-purple-600 text-white px-1 rounded-sm leading-tight font-bold">月{palace.name}</span>}
                                            {isDaily && <span className="text-[10px] bg-orange-600 text-white px-1 rounded-sm leading-tight font-bold">日{palace.name}</span>}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end text-[10px] text-gray-500 leading-none font-medium">
                                        <span>{palace.changsheng12}</span>
                                        <span>{palace.boshi12}</span>
                                        {isYearly && <span className="text-green-600">{palace.jiangqian12}</span>}
                                        {isYearly && <span className="text-green-600">{palace.suiqian12}</span>}
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-2 gap-0.5 px-0.5 py-0.5 min-h-0 relative">
                                    
                                    <div className="flex flex-col content-start gap-[1px] text-[11px] leading-tight overflow-hidden">
                                        {palace.minorStars?.map((star: Star) => (
                                            <div key={`${star.name}-minor`} className="flex items-center flex-wrap">
                                                <span className={`${star.brightness === '陷' ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                                                    {star.name}
                                                </span>
                                                {star.mutagen && (
                                                    <span className={`ml-[1px] text-[9px] px-[1px] rounded ${getMutagenColor(star.mutagen)}`}>
                                                        {star.mutagen}
                                                    </span>
                                                )}
                                                {renderMutagenBadge(star.name, '大', decadalMutagens, 'text-blue-600 border-blue-200')}
                                                {renderMutagenBadge(star.name, '年', yearlyMutagens, 'text-green-600 border-green-200')}
                                                {renderMutagenBadge(star.name, '月', monthlyMutagens, 'text-purple-600 border-purple-200')}
                                                {renderMutagenBadge(star.name, '日', dailyMutagens, 'text-orange-600 border-orange-200')}
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
                                                        <span className={`text-[10px] w-3 h-3 flex items-center justify-center rounded font-bold ${getMutagenColor(star.mutagen)}`}>
                                                            {star.mutagen}
                                                        </span>
                                                    )}
                                                    
                                                    <div className="flex flex-col gap-[1px] items-end">
                                                        {renderMutagenBadge(star.name, '大', decadalMutagens, 'text-blue-600 bg-blue-50 border-blue-200')}
                                                        {renderMutagenBadge(star.name, '年', yearlyMutagens, 'text-green-600 bg-green-50 border-green-200')}
                                                        {renderMutagenBadge(star.name, '月', monthlyMutagens, 'text-purple-600 bg-purple-50 border-purple-200')}
                                                        {renderMutagenBadge(star.name, '日', dailyMutagens, 'text-orange-600 bg-orange-50 border-orange-200')}
                                                    </div>
                                                </div>
                                                {star.brightness && <span className="text-[9px] opacity-70 scale-90 origin-right font-medium">({star.brightness})</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-white/5 pt-0.5 px-1 flex justify-between items-end bg-gray-50/50 dark:bg-black/10">
                                    {palace.decadal && (
                                        <div className="flex flex-col">
                                            <span className="text-xl font-bold text-blue-500 font-sans leading-none">
                                                {palace.decadal.range[0]}-{palace.decadal.range[1]}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap justify-end gap-x-1 text-[10px] text-gray-400 max-w-[60%] leading-none pb-0.5 font-medium">
                                        {palace.ages?.filter((a: number) => a <= 90).map((age: number) => (
                                            <span key={age} className={age === flowData?.age?.nominalAge ? 'text-red-500 font-bold underline text-xs' : ''}>
                                                {age}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="md:hidden text-center text-xs text-gray-400 py-2">
                ← 左右滑動查看完整命盤 →
            </div>
        </div>
    );
};
