'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { divinationCategories, getRandomQuestion } from '@/lib/categories';
import { DivinationCategory, SubCategory } from '@/types';
import { ChevronLeft, Sparkles, Lightbulb } from 'lucide-react';

interface DivinationGuidanceProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

type Step = 'category' | 'subcategory' | 'question';

export function DivinationGuidance({ onSubmit, isLoading }: DivinationGuidanceProps) {
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<DivinationCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [question, setQuestion] = useState('');

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
    // 如果有提示，預填一些引導文字
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
    }
  };

  const handleSkipToFreeForm = () => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setStep('question');
  };

  const handleSubmit = () => {
    if (question.trim()) {
      onSubmit(question.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step 1: Category Selection */}
      {step === 'category' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--gold)] mb-2">您想問什麼類型的問題？</h2>
            <p className="text-muted-foreground">選擇一個類別，幫助您更好地整理問題</p>
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
              {selectedCategory && (
                <div className="flex gap-2 mb-1">
                  <Badge variant="secondary">
                    {selectedCategory.icon} {selectedCategory.name}
                  </Badge>
                  {selectedSubCategory && (
                    <Badge variant="outline">{selectedSubCategory.name}</Badge>
                  )}
                </div>
              )}
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
