# 玄覺空間 設計系統 (Design System)

## 概述
此文件定義了「玄覺空間 (Mystic Mind Space)」的 UI/UX 設計規範。本系統旨在結合傳統玄學的莊重感與現代科技的簡約感，為使用者提供沉浸式且專業的占卜體驗。

## 色彩系統 (Color System)

### 主題色彩
| Token | 淺色模式 | 深色模式 | 用途 |
|-------|---------|---------|------|
| --bg-primary | #F8F6F3 | #0A0E27 | 頁面背景 |
| --bg-card | #FFFFFF | rgba(22,33,62,0.8) | 卡片背景 |
| --accent | #B8962E | #D4AF37 | 主要強調色 (金色) |
| --text-primary | #0F172A | #EAEAEA | 主要文字 |
| --text-secondary | #475569 | #94A3B8 | 次要文字 |
| --border | #E2E8F0 | rgba(212,175,55,0.2) | 邊框 |

### 使用方式
```css
/* 使用 CSS 變數 */
.my-element {
  background: var(--bg-card);
  color: var(--text-primary);
}
```

```tsx
/* 使用 Tailwind (需在 tailwind.config.js 配置) */
<div className="bg-background-card text-foreground-primary">
  內容
</div>
```

## 字體系統 (Typography)

### 字體堆疊
- **標題/中文**: Noto Serif TC (serif) - 展現玄學的傳統底蘊
- **UI/英文**: Inter (sans-serif) - 確保現代化介面的清晰度

### 字體大小
- **xs**: 0.75rem (12px) - 輔助說明、標籤
- **sm**: 0.875rem (14px) - 次要文字、按鈕
- **base**: 1rem (16px) - 內文、主要文字
- **lg**: 1.125rem (18px) - 列表標題、突出文字
- **xl**: 1.25rem (20px) - 小標題
- **2xl**: 1.5rem (24px) - 區塊標題
- **3xl**: 1.875rem (30px) - 頁面標題
- **4xl**: 2.25rem (36px) - 強調標題 (如首頁 Hero Section)

## 元件庫 (Component Library)

### 基礎元件
| 元件 | 路徑 | 說明 |
|------|------|------|
| Button | components/ui/Button.tsx | 支援多種變體 (Gold, Outline, Ghost) 的按鈕 |
| Card | components/ui/Card.tsx | 具備玻璃擬態 (Glassmorphism) 效果的容器 |
| Input | components/ui/Input.tsx | 統一風格的文字輸入框 |
| Select | components/ui/Select.tsx | 自定義樣式的下拉選單 |
| Modal | components/ui/Modal.tsx | 響應式彈窗容器 |
| ThemeToggle | components/ui/ThemeToggle.tsx | 切換淺色/深色模式的按鈕 |
| Skeleton | components/ui/Skeleton.tsx | 內容加載時的骨架屏 |
| Badge | components/ui/Badge.tsx | 狀態標籤或分類標籤 |

### 佈局元件
| 元件 | 路徑 | 說明 |
|------|------|------|
| Navbar | components/layout/Navbar.tsx | 全局頂部導航列 |
| Footer | components/layout/Footer.tsx | 全局頁腳 |
| Container | components/layout/Container.tsx | 限制最大寬度的響應式容器 |

## 主題系統 (Theme System)

### ThemeProvider
```tsx
import { ThemeProvider } from '@/contexts/ThemeContext';

// 在 layout.tsx 中包裹應用
export default function RootLayout({ children }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
```

### useTheme Hook
```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  
  return (
    <div>
      當前主題: {theme} (實際顯示: {resolvedTheme})
      <button onClick={() => setTheme('dark')}>切換深色</button>
    </div>
  );
}
```

## 響應式設計 (Responsive Design)

### 斷點
| 斷點 | 寬度 | 裝置 |
|------|------|------|
| xs | 320px | 小手機 |
| sm | 640px | 大手機 |
| md | 768px | 平板 |
| lg | 1024px | 小桌面 |
| xl | 1280px | 大桌面 |
| 2xl | 1440px | 超寬螢幕 |

### 使用方式
```tsx
<div className="px-4 md:px-6 lg:px-8">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {/* 內容 */}
  </div>
</div>
```

## 動畫指南 (Animation Guidelines)

### 基本原則
1. **進入動畫**: 使用 `ease-out` (例如: `duration-300 ease-out`)
2. **離開動畫**: 使用 `ease-in` (例如: `duration-200 ease-in`)
3. **持續時間**: 一般互動為 150-300ms
4. **減損動作**: 必須支援 `prefers-reduced-motion`

### 預設動畫
- `.fade-in`: 元素淡入效果
- `.animate-glow`: 金色光暈呼吸效果
- `.animate-float`: 輕微上下浮動效果，常用於裝飾性圖示

## 可訪問性 (Accessibility)

### 檢查清單
- [ ] 文字與背景對比度至少 4.5:1 (符合 WCAG AA 標準)
- [ ] 所有可點擊元素均有 `cursor-pointer` 及適當的 hover 狀態
- [ ] 表單輸入元件均有對應的 label 或 aria-label
- [ ] 所有裝飾性以外的圖片均有描述性的 alt 文字
- [ ] 支援完全的鍵盤導航 (Tab indexing, Focus states)
- [ ] 支援 `prefers-reduced-motion` 媒體查詢

## 版本歷史

### v2.0.0 (進行中)
- 新增深色/淺色主題切換功能
- 重構基礎元件庫以提升複用性
- 優化全站響應式設計斷點
- 引入更嚴格的可訪問性檢查流程

### v1.2.0
- 初始化基礎 UI 組件 (Button, Card, Modal)
- 統一品牌色彩與字體堆疊
- 加入玻璃擬態卡片樣式
