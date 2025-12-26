'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { divinationCategories, getRandomQuestion } from '@/lib/categories';
import { DivinationCategory, SubCategory } from '@/types';
import { ChevronLeft, Sparkles, Lightbulb, User, Users } from 'lucide-react';

interface DivinationGuidanceProps {
  onSubmit: (question: string, gender?: string, target?: string) => void;
  isLoading: boolean;
}

type Step = 'info' | 'category' | 'subcategory' | 'question';

// 性別選項
const genderOptions = [
  { id: '男', label: '男', icon: '👨' },
  { id: '女', label: '女', icon: '👩' },
];

// 占卜對象選項
const targetOptions = [
  { id: '自己', label: '算自己', description: '為自己的事情占卜' },
  { id: '父母', label: '算父母', description: '為父母的事情占卜' },
  { id: '朋友', label: '算朋友', description: '為朋友的事情占卜' },
  { id: '他人', label: '算他人', description: '為其他人占卜' },
];

export function DivinationGuidance({ onSubmit, isLoading }: DivinationGuidanceProps) {
  const [step, setStep] = useState<Step>('info');
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<DivinationCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [question, setQuestion] = useState('');

  const handleInfoComplete = () => {
    if (selectedGender && selectedTarget) {
      setStep('category');
    }
  };

  const handleCategorySelect = (category: DivinationCategory) => {
    setSelectedCategory(category);
    if (category.subCategories && category.subCategories.length > 0) {
      setStep('subcategory');
    } else {
      setStep('question');
    }
  };

  const handleSubCategorySelect = (subCategory: SubCategory) => {
    setSelectedSubCategory(subCategory);
    setStep('question');
    if (subCategory.promptHint) {
      setQuestion('');
    }
  };

  const handleRandomQuestion = () => {
    const randomQ = getRandomQuestion(selectedSubCategory?.id);
    setQuestion(randomQ);
  };

  const handleBack = () => {
    if (step === 'question') {
      if (selectedCategory?.subCategories?.length) {
        setStep('subcategory');
      } else {
        setStep('category');
      }
      setSelectedSubCategory(null);
    } else if (step === 'subcategory') {
      setStep('category');
      setSelectedCategory(null);
    } else if (step === 'category') {
      setStep('info');
    }
  };

  const handleSkipToFreeForm = () => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setStep('question');
  };

  const handleSubmit = () => {
    if (question.trim()) {
      onSubmit(question.trim(), selectedGender, selectedTarget);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step 0: Gender & Target Selection */}
      {step === 'info' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--gold)] mb-2">開始占卜前...</h2>
            <p className="text-muted-foreground">請先提供一些基本資訊，有助於更準確的解讀</p>
          </div>

          {/* 性別選擇 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--gold)]">
              <User className="w-5 h-5" />
              <span className="font-medium">您的性別</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {genderOptions.map((option) => (
                <Card
                  key={option.id}
                  className={`glass-panel cursor-pointer transition-all hover:scale-105 ${
                    selectedGender === option.id 
                      ? 'border-[var(--gold)] bg-[var(--gold)]/10' 
                      : 'hover:border-[var(--gold)]/50'
                  }`}
                  onClick={() => setSelectedGender(option.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl mb-2">{option.icon}</div>
                    <span className="font-semibold">{option.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 占卜對象選擇 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--gold)]">
              <Users className="w-5 h-5" />
              <span className="font-medium">占卜對象</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {targetOptions.map((option) => (
                <Card
                  key={option.id}
                  className={`glass-panel cursor-pointer transition-all ${
                    selectedTarget === option.id 
                      ? 'border-[var(--gold)] bg-[var(--gold)]/10' 
                      : 'hover:border-[var(--gold)]/50'
                  }`}
                  onClick={() => setSelectedTarget(option.id)}
                >
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-[var(--gold)]">{option.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Button
            className="btn-gold w-full"
            onClick={handleInfoComplete}
            disabled={!selectedGender || !selectedTarget}
          >
            繼續
          </Button>
        </div>
      )}

      {/* Step 1: Category Selection */}
      {step === 'category' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex gap-2 mb-1">
                <Badge variant="secondary">{selectedGender === '男' ? '👨' : '👩'} {selectedGender}</Badge>
                <Badge variant="outline">{selectedTarget}</Badge>
              </div>
              <h2 className="text-xl font-bold text-[var(--gold)]">您想問什麼類型的問題？</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {divinationCategories.map((category) => (
              <Card
                key={category.id}
                className="glass-panel cursor-pointer hover:border-[var(--gold)]/50 transition-all hover:scale-105"
                onClick={() => handleCategorySelect(category)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-3xl mb-2">{category.icon}</div>
                  <h3 className="font-semibold text-[var(--gold)]">{category.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-[var(--gold)]"
              onClick={handleSkipToFreeForm}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              跳過引導，直接提問
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Sub-Category Selection */}
      {step === 'subcategory' && selectedCategory && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <Badge variant="secondary" className="mb-1">
                {selectedCategory.icon} {selectedCategory.name}
              </Badge>
              <h2 className="text-xl font-bold text-[var(--gold)]">更具體一點...</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedCategory.subCategories?.map((sub) => (
              <Card
                key={sub.id}
                className="glass-panel cursor-pointer hover:border-[var(--gold)]/50 transition-all"
                onClick={() => handleSubCategorySelect(sub)}
              >
                <CardContent className="p-4">
                  <h3 className="font-semibold text-[var(--gold)]">{sub.name}</h3>
                  {sub.promptHint && (
                    <p className="text-xs text-muted-foreground mt-1">{sub.promptHint}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Question Input */}
      {step === 'question' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex gap-2 mb-1">
                {selectedGender && (
                  <Badge variant="secondary">{selectedGender === '男' ? '👨' : '👩'} {selectedGender}</Badge>
                )}
                {selectedTarget && (
                  <Badge variant="outline">{selectedTarget}</Badge>
                )}
                {selectedCategory && (
                  <Badge variant="secondary">
                    {selectedCategory.icon} {selectedCategory.name}
                  </Badge>
                )}
                {selectedSubCategory && (
                  <Badge variant="outline">{selectedSubCategory.name}</Badge>
                )}
              </div>
              <h2 className="text-xl font-bold text-[var(--gold)]">誠心寫下您的問題</h2>
            </div>
          </div>

          {/* Guidance Tips */}
          {selectedSubCategory?.promptHint && (
            <div className="bg-[var(--gold)]/10 border border-[var(--gold)]/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-5 h-5 text-[var(--gold)] flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-[var(--gold)] font-medium">提問建議</p>
                  <p className="text-muted-foreground mt-1">
                    例如：{selectedSubCategory.promptHint}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="請詳細描述您想問的事情，越具體越好..."
              className="input-mystical min-h-[150px] text-lg"
            />

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRandomQuestion}
                className="text-muted-foreground hover:text-[var(--gold)]"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                給我靈感
              </Button>

              <Button
                className="btn-gold px-8"
                onClick={handleSubmit}
                disabled={!question.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">☯</span>
                    演算中...
                  </>
                ) : (
                  '開始起卦'
                )}
              </Button>
            </div>
          </div>

          {/* Question Tips */}
          <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t border-border/50">
            <p className="text-[var(--gold)] font-medium">問卦心法：</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>心誠則靈 - 帶著誠意提問</li>
              <li>一事一占 - 每次只問一個問題</li>
              <li>問具體事 - 避免問是非絕對的問題</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
