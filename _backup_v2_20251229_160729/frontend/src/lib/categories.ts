import { DivinationCategory } from '@/types';

export const divinationCategories: DivinationCategory[] = [
  {
    id: 'career',
    name: '事業工作',
    icon: '💼',
    description: '工作運勢、職場發展、創業決策',
    subCategories: [
      { id: 'job-change', name: '求職/換工作', promptHint: '想詢問是否該換工作或這份工作是否適合' },
      { id: 'promotion', name: '升遷/加薪', promptHint: '想了解升遷或加薪的可能性' },
      { id: 'business', name: '創業/投資', promptHint: '考慮創業或投資某個項目' },
      { id: 'project', name: '專案/合作', promptHint: '某個專案或合作案的發展' },
    ],
  },
  {
    id: 'wealth',
    name: '財運理財',
    icon: '💰',
    description: '財運走勢、投資決策、收入狀況',
    subCategories: [
      { id: 'general-wealth', name: '整體財運', promptHint: '想了解近期的整體財運狀況' },
      { id: 'investment', name: '投資理財', promptHint: '某項投資或理財決策' },
      { id: 'debt', name: '債務/借貸', promptHint: '關於借貸或債務的問題' },
    ],
  },
  {
    id: 'relationship',
    name: '感情姻緣',
    icon: '💕',
    description: '戀愛運勢、婚姻關係、桃花運',
    subCategories: [
      { id: 'single', name: '單身求緣', promptHint: '單身想了解桃花運或何時能遇到對象' },
      { id: 'dating', name: '戀愛發展', promptHint: '目前交往對象的感情發展' },
      { id: 'marriage', name: '婚姻關係', promptHint: '婚姻關係或是否適合結婚' },
      { id: 'reconcile', name: '復合/挽回', promptHint: '想復合或挽回前任' },
    ],
  },
  {
    id: 'health',
    name: '健康平安',
    icon: '🏥',
    description: '健康狀況、疾病康復、平安吉凶',
    subCategories: [
      { id: 'general-health', name: '整體健康', promptHint: '想了解近期健康狀況' },
      { id: 'recovery', name: '疾病康復', promptHint: '某個疾病的康復情況' },
      { id: 'surgery', name: '手術/治療', promptHint: '是否適合進行手術或某種治療' },
    ],
  },
  {
    id: 'study',
    name: '學業考試',
    icon: '📚',
    description: '升學考試、學習進度、資格認證',
    subCategories: [
      { id: 'exam', name: '考試運勢', promptHint: '某項考試的結果如何' },
      { id: 'study-abroad', name: '留學/進修', promptHint: '是否適合出國留學或進修' },
      { id: 'certification', name: '證照/資格', promptHint: '考取某項證照或資格' },
    ],
  },
  {
    id: 'general',
    name: '其他問題',
    icon: '🔮',
    description: '其他人生決策、出行吉凶、失物尋找',
    subCategories: [
      { id: 'decision', name: '人生抉擇', promptHint: '面臨某個重要決定' },
      { id: 'travel', name: '出行/搬遷', promptHint: '出行或搬遷是否順利' },
      { id: 'lost', name: '失物尋找', promptHint: '遺失物品能否找回' },
      { id: 'custom', name: '自由提問', promptHint: '' },
    ],
  },
];

export const sampleQuestions: Record<string, string[]> = {
  'job-change': [
    '我目前在考慮換工作，新公司開出的條件還不錯，想問這次跳槽是否順利？',
    '最近收到獵頭聯繫，這個新機會適合我嗎？',
  ],
  'promotion': [
    '今年有機會升遷主管職嗎？',
    '年底績效面談能順利談到加薪嗎？',
  ],
  'general-wealth': [
    '想了解我近三個月的財運如何？',
    '今年整體財運走勢如何？',
  ],
  'investment': [
    '考慮投入這筆資金到股市，會有好的回報嗎？',
    '朋友邀請我投資他的新創公司，適合參與嗎？',
  ],
  'single': [
    '我單身兩年了，近期會有好的姻緣出現嗎？',
    '最近認識了一個對象，這段緣分能發展嗎？',
  ],
  'dating': [
    '和現任交往半年了，這段感情能長久嗎？',
    '男/女朋友最近態度冷淡，我們的關係會怎麼發展？',
  ],
  'exam': [
    '下個月的國考能順利通過嗎？',
    '正在準備研究所考試，錄取機會如何？',
  ],
  'decision': [
    '正在考慮要不要接受這個機會，想問吉凶如何？',
    '面臨A和B兩個選擇，走A路線會比較好嗎？',
  ],
};

export function getRandomQuestion(subCategoryId?: string): string {
  if (subCategoryId && sampleQuestions[subCategoryId]) {
    const questions = sampleQuestions[subCategoryId];
    return questions[Math.floor(Math.random() * questions.length)];
  }
  
  // 從所有問題中隨機選一個
  const allQuestions = Object.values(sampleQuestions).flat();
  return allQuestions[Math.floor(Math.random() * allQuestions.length)];
}
