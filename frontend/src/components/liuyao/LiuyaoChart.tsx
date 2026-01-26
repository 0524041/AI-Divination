import React, { useMemo } from 'react';
import { Card } from '@/components/ui/Card';

interface LiuyaoChartProps {
    formattedText: string;
}

interface YaoLine {
    sixGod: string;
    votary: string; // 伏神
    mainYao: {
        name: string; // 兄弟戌土
        symbol: string; // ▅▅▅▅▅
        isMoving: boolean; // O or X
        shiYing: string; // 世 or 應 or ''
    };
    changedYao?: {
        name: string;
        symbol: string;
    };
}

interface ParsedChart {
    basicInfo: {
        time: string;
        ganZhi: string;
        shenSha: string;
    };
    hexagrams: {
        main: string;
        changed: string;
    };
    lines: YaoLine[];
}

export const LiuyaoChart: React.FC<LiuyaoChartProps> = ({ formattedText }) => {
    const parsedData = useMemo<ParsedChart | null>(() => {
        if (!formattedText) return null;

        const result: ParsedChart = {
            basicInfo: { time: '', ganZhi: '', shenSha: '' },
            hexagrams: { main: '', changed: '' },
            lines: [],
        };

        const lines = formattedText.split('\n');
        let currentSection = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.includes('【基本資訊】')) {
                currentSection = 'basic';
                continue;
            } else if (line.includes('【卦象結構】')) {
                currentSection = 'structure';
                continue;
            }

            if (currentSection === 'basic') {
                if (line.startsWith('起卦時間：')) result.basicInfo.time = line.replace('起卦時間：', '').trim();
                else if (line.startsWith('干支：')) result.basicInfo.ganZhi = line.replace('干支：', '').trim();
                else if (line.startsWith('神煞：')) result.basicInfo.shenSha = line.replace('神煞：', '').trim();
            } else if (currentSection === 'structure') {
                if (line.startsWith('本卦：')) {
                    // Parse: 本卦：艮宮: 天澤履 (五世卦)        變卦：兌宮: 澤地萃
                    // Split by spaces or specific keywords is safer
                    // Assuming typical format: 本卦：Name ... 變卦：Name ...
                    const parts = line.split(/\s+變卦：/);
                    result.hexagrams.main = parts[0].replace('本卦：', '').trim();
                    if (parts[1]) result.hexagrams.changed = parts[1].trim();
                } else if (line.includes('六神') && line.includes('伏神')) {
                    // Header line, skip
                    continue;
                } else if (line.match(/^[\u4e00-\u9fa5]{2}\s+/)) {
                    // This looks like a Yao line (Starts with 2 Chinese chars for Six God)
                    // Example: 玄武              兄弟戌土     ▅▅▅▅▅ O       → 兄弟未土 ▅▅　▅▅

                    // Use regex to capture parts
                    // 1. Six God (2 chars)
                    // 2. Votary (Optional)
                    // 3. Main Yao Name (e.g. 兄弟戌土)
                    // 4. Main Yao Symbol (blocks)
                    // 5. Moving (O/X) (Optional)
                    // 6. Shi/Ying (Optional)
                    // 7. Arrow (Optional)
                    // 8. Changed Yao Name (Optional)
                    // 9. Changed Yao Symbol (Optional)

                    // This regex is tricky due to variable spacing. Let's process by column chunks or stricter regex.
                    // Let's try splitting by whitespace sequences first and mapping based on expected content.

                    // But Votary is problematic, it can be empty (multiple spaces).
                    // Regex approach:
                    // ^(\S+)\s+(.*?)\s+(\S{3,5})\s+(▅+.*▅+)\s*(O|X)?\s*(世|應)?(\s*→\s*(.*?)\s+(▅+.*▅+))?
                    // Note: Yao symbols contain spaces sometimes (Yin line: ▅▅　▅▅). Blocks are U+2585. Space is U+3000 or normal.

                    const yaoLine: YaoLine = {
                        sixGod: '', votary: '', mainYao: { name: '', symbol: '', isMoving: false, shiYing: '' }
                    };

                    // 1. Get Six God (first 2 chars)
                    yaoLine.sixGod = line.substring(0, 2);

                    // The rest of the line
                    let rest = line.substring(2).trim();

                    // Check if there is an arrow "→" indicating change
                    const hasChange = rest.includes('→');
                    let changedPart = '';
                    if (hasChange) {
                        const splitChange = rest.split('→');
                        rest = splitChange[0].trim();
                        changedPart = splitChange[1]?.trim() || '';
                    }

                    // Parse Main Part: [Votary] [Name] [Symbol] [Moving] [ShiYing]
                    // The complicated part is Votary which is often empty.
                    // "              兄弟戌土     ▅▅▅▅▅ O       "
                    // "伏神       父母午火     ▅▅▅▅▅         " <- Wait, usually Votary is empty space.
                    // Votary appears *before* main yao name if present.

                    // Let's rely on splitting by multiple spaces.
                    const tokens = rest.split(/\s+/);

                    // Expected tokens from right to left is safer?
                    // Rightmost of 'rest' might include Shi/Ying, Moving, Symbol.

                    // Let's iterate tokens and classify.
                    let tokenIndex = 0;

                    // Check if first token looks like Votary (e.g. 妻財子水)
                    // Main Yao Name also looks like 兄弟戌土.
                    // If there are 2 name-like tokens before the symbol, the first is Votary.

                    // Let's retry a simpler approach: substring based on fixed width? 
                    // No, formatting might vary.

                    // Regex attempt 2:
                    // (六神) (伏神?) (本卦爻名) (本卦符號) (動?) (世應?)
                    const mainMatch = rest.match(/^(.*?)\s+([^\s]+)\s+(▅.+?▅)(\s+[OX])?(\s+[世應])?$/);

                    if (mainMatch) {
                        // group 1: Votary (might be empty or contain it)
                        // group 2: Main Name
                        // group 3: Symbol
                        // group 4: Moving
                        // group 5: ShiYing

                        yaoLine.votary = mainMatch[1].trim();
                        yaoLine.mainYao.name = mainMatch[2];
                        yaoLine.mainYao.symbol = mainMatch[3];
                        if (mainMatch[4]) yaoLine.mainYao.isMoving = true;
                        if (mainMatch[5]) yaoLine.mainYao.shiYing = mainMatch[5].trim();
                    } else {
                        // Use fallback or relaxed parsing
                        // Maybe no Votary
                        const parts2 = rest.split(/\s+/);
                        // Assume last part is Shi/Ying if matches, or Moving, or Symbol
                        // This is getting messy.

                        // Simplest assumption based on user sample:
                        // [Votary optional] [Name] [Symbol] [Moving optional] [Shi/Ying optional]
                        // "              兄弟戌土     ▅▅▅▅▅ O       "
                        // "白虎   妻財子水       子孫申金     ▅▅▅▅▅    世    "
                        // If Votary exists, it's roughly col 2.
                        // Let's just grab the whole line text and rely on regex for specific known patterns.

                        // Extract Symbol: ▅▅▅▅▅ or ▅▅　▅▅
                        const symbolMatch = rest.match(/(▅▅.+?▅▅)/);
                        if (symbolMatch) {
                            yaoLine.mainYao.symbol = symbolMatch[1];
                            const preSymbol = rest.substring(0, symbolMatch.index).trim();
                            const postSymbol = rest.substring(symbolMatch.index! + symbolMatch[0].length).trim();

                            // preSymbol contains Votary and Name
                            const preParts = preSymbol.split(/\s+/);
                            if (preParts.length >= 2) {
                                yaoLine.votary = preParts[0];
                                yaoLine.mainYao.name = preParts[1];
                            } else {
                                yaoLine.mainYao.name = preParts[0];
                            }

                            // postSymbol contains Moving and ShiYing
                            if (postSymbol.includes('O')) yaoLine.mainYao.isMoving = true;
                            if (postSymbol.includes('X')) yaoLine.mainYao.isMoving = true;
                            if (postSymbol.includes('世')) yaoLine.mainYao.shiYing = '世';
                            if (postSymbol.includes('應')) yaoLine.mainYao.shiYing = '應';
                        }
                    }

                    if (changedPart) {
                        // [Name] [Symbol]
                        const symbolMatch = changedPart.match(/(▅▅.+?▅▅)/);
                        if (symbolMatch) {
                            yaoLine.changedYao = {
                                symbol: symbolMatch[1],
                                name: changedPart.substring(0, symbolMatch.index).trim()
                            };
                        }
                    }

                    result.lines.push(yaoLine);
                }
            }
        }

        // Reverse lines if they are Top-to-Bottom in text but we want to render strictly? 
        // Usually Six Yao text is presented Top (Line 6) to Bottom (Line 1).
        // The user text: "六神... 兄弟戌土 (Top?)" 
        // Usually standard output is Top down. We render as is.

        return result;
    }, [formattedText]);

    if (!parsedData) return null;

    return (
        <div className="space-y-6 w-full font-mono">
            {/* Basic Info Card - Compact & Designed */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-sm bg-background-card/40 rounded-xl p-4 border border-border/50 shadow-inner">
                <div className="md:col-span-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border/50 pb-2 md:pb-0 md:pr-4">
                    <span className="text-[10px] text-foreground-muted uppercase tracking-widest mb-1">起卦時間</span>
                    <span className="font-bold text-foreground-primary tracking-wide text-sm md:text-base">{parsedData.basicInfo.time}</span>
                </div>
                <div className="md:col-span-8 grid grid-cols-2 gap-4">
                    <div className="flex flex-col justify-center">
                        <span className="text-[10px] text-foreground-muted uppercase tracking-widest mb-1">干支</span>
                        <span className="font-medium text-foreground-secondary text-xs md:text-sm">{parsedData.basicInfo.ganZhi}</span>
                    </div>
                    <div className="flex flex-col justify-center">
                        <span className="text-[10px] text-foreground-muted uppercase tracking-widest mb-1">神煞</span>
                        <span className="font-medium text-foreground-secondary text-xs md:text-sm truncate" title={parsedData.basicInfo.shenSha}>
                            {parsedData.basicInfo.shenSha}
                        </span>
                    </div>
                </div>
            </div>

            {/* Hexagram Names - Enhanced Typography */}
            <div className="flex justify-between items-center px-4 md:px-10 py-2">
                <div className="text-center flex-1 group cursor-default">
                    <div className="text-[10px] text-foreground-muted mb-1 opacity-70 group-hover:opacity-100 transition-opacity">本卦</div>
                    <div className="text-xl md:text-2xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-amber-300 animate-in slide-in-from-left duration-700">
                        {parsedData.hexagrams.main.split(':')[1]?.trim() || parsedData.hexagrams.main}
                    </div>
                </div>
                <div className="text-foreground-muted/30 text-2xl mx-4 font-light">→</div>
                <div className="text-center flex-1 group cursor-default">
                    <div className="text-[10px] text-foreground-muted mb-1 opacity-70 group-hover:opacity-100 transition-opacity">變卦</div>
                    <div className="text-xl md:text-2xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-amber-300 animate-in slide-in-from-right duration-700">
                        {parsedData.hexagrams.changed.split(':')[1]?.trim() || parsedData.hexagrams.changed || '-'}
                    </div>
                </div>
            </div>

            {/* Hexagram Table - Compact & Text Only */}
            <div className="overflow-hidden rounded-xl border border-border shadow-lg bg-background-card/30 backdrop-blur-md">
                <table className="w-full min-w-[500px] border-collapse">
                    <thead>
                        <tr className="bg-gradient-to-r from-accent/10 to-transparent text-foreground-secondary text-xs md:text-sm uppercase tracking-wider border-b border-border/60">
                            <th className="px-4 py-3 text-left w-[15%] font-bold opacity-80">六神</th>
                            <th className="px-4 py-3 text-left w-[15%] font-bold opacity-80">伏神</th>
                            <th className="px-4 py-3 text-center w-[35%] font-bold text-accent">本卦</th>
                            <th className="px-4 py-3 text-center w-[35%] font-bold text-accent/80">變卦</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {parsedData.lines.map((line, idx) => (
                            <tr
                                key={idx}
                                className={`
                  group hover:bg-white/5 dark:hover:bg-white/5 transition-colors duration-200
                  ${line.mainYao.shiYing === '世' ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}
                  ${line.mainYao.shiYing === '應' ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}
                `}
                            >
                                {/* 六神 */}
                                <td className="px-4 py-3 text-sm font-medium text-foreground-secondary group-hover:text-foreground-primary transition-colors">
                                    {line.sixGod}
                                </td>

                                {/* 伏神 */}
                                <td className="px-4 py-3 text-foreground-muted text-xs md:text-sm group-hover:text-foreground-secondary transition-colors">
                                    {line.votary || '-'}
                                </td>

                                {/* 本卦 */}
                                <td className="px-4 py-3 relative">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className={`text-base font-medium tracking-wide
                      ${line.mainYao.isMoving ? 'text-red-500 font-bold' : 'text-foreground-primary'}
                    `}>
                                            {line.mainYao.name}
                                        </span>
                                        {line.mainYao.isMoving && <span className="text-[10px] text-red-500 animate-pulse">●</span>}

                                        {/* 世/應 Badge - Compact */}
                                        <div className="absolute right-4 md:right-10 flex items-center h-full pointer-events-none">
                                            {line.mainYao.shiYing && (
                                                <span className={`
                           flex items-center justify-center w-6 h-6 rounded-md font-bold text-[10px] shadow-sm backdrop-blur-sm ring-1 ring-inset ml-2
                           ${line.mainYao.shiYing === '世'
                                                        ? 'bg-amber-500 text-white ring-amber-300 shadow-amber-500/20 scale-105 z-10'
                                                        : 'bg-blue-600/80 text-white ring-blue-400 shadow-blue-500/20 opacity-90'}
                         `}>
                                                    {line.mainYao.shiYing}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                {/* 變卦 */}
                                <td className="px-4 py-3 text-center">
                                    {line.changedYao ? (
                                        <span className="text-foreground-secondary text-base tracking-wide">{line.changedYao.name}</span>
                                    ) : (
                                        <span className="text-foreground-muted/10 text-xl font-light">·</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
