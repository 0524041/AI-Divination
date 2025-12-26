'use client';

import { useState, useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import { performDivination } from '@/lib/divination';
import { ToolStatus, HistoryItem } from '@/types';

import { AuthForm } from '@/components/AuthForm';
import { Header } from '@/components/Header';
import { DivinationGuidance } from '@/components/DivinationGuidance';
import { CoinTossing } from '@/components/CoinTossing';
import { DivinationResult } from '@/components/DivinationResult';
import { HistoryModal } from '@/components/HistoryModal';
import { TutorialModal } from '@/components/TutorialModal';
import { SettingsModal } from '@/components/SettingsModal';
import { toast } from 'sonner';

type AppMode = 'input' | 'tossing' | 'result';

export default function Home() {
  const { user, isLoading } = useApp();

  // App state
  const [mode, setMode] = useState<AppMode>('input');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCoins, setCurrentCoins] = useState<number[]>([]);
  const [resultData, setResultData] = useState<{
    result: string;
    toolStatus: ToolStatus;
  } | null>(null);

  // Modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState(false);

  // Check if user has seen tutorial
  useEffect(() => {
    if (user) {
      const seen = localStorage.getItem(`tutorial_seen_${user.id}`);
      if (!seen) {
        setTutorialOpen(true);
      } else {
        setTutorialSeen(true);
      }
    }
  }, [user]);

  const handleTutorialClose = () => {
    if (user) {
      localStorage.setItem(`tutorial_seen_${user.id}`, 'true');
      setTutorialSeen(true);
    }
    setTutorialOpen(false);
  };

  const handleStartDivination = useCallback(async (question: string) => {
    setCurrentQuestion(question);
    
    // Generate coins
    const coins = performDivination();
    setCurrentCoins(coins);
    setMode('tossing');
  }, []);

  const handleTossingComplete = useCallback(async () => {
    try {
      const response = await api.divinate({
        question: currentQuestion,
        coins: currentCoins,
      });

      setResultData({
        result: response.result,
        toolStatus: response.tool_status,
      });
      setMode('result');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '占卜失敗，請稍後再試');
      setMode('input');
    }
  }, [currentQuestion, currentCoins]);

  const handleCloseResult = () => {
    setMode('input');
    setCurrentQuestion('');
    setCurrentCoins([]);
    setResultData(null);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setCurrentQuestion(item.question);
    setResultData({
      result: item.interpretation,
      toolStatus: {
        get_divination_tool: 'success',
        get_current_time: 'success',
      },
    });
    setMode('result');
    setHistoryOpen(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="text-4xl animate-spin" style={{ animationDuration: '2s' }}>
          ☯
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen">
      {/* Background effects */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Header */}
      <Header
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenTutorial={() => setTutorialOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4">
        {mode === 'input' && (
          <div className="animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-[var(--gold)] mb-2">誠心占卜</h1>
              <p className="text-muted-foreground">天機不可洩露，唯誠者可得之</p>
            </div>
            <DivinationGuidance
              onSubmit={handleStartDivination}
              isLoading={false}
            />
          </div>
        )}
      </main>

      {/* Coin Tossing Animation */}
      {mode === 'tossing' && (
        <CoinTossing coins={currentCoins} onComplete={handleTossingComplete} />
      )}

      {/* Result Display */}
      {mode === 'result' && resultData && (
        <DivinationResult
          question={currentQuestion}
          result={resultData.result}
          toolStatus={resultData.toolStatus}
          onClose={handleCloseResult}
        />
      )}

      {/* Modals */}
      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectHistory={handleSelectHistory}
      />

      <TutorialModal
        open={tutorialOpen}
        onClose={handleTutorialClose}
        mustRead={!tutorialSeen}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
