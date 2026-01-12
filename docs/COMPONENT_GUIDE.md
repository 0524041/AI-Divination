# 玄覺空間 元件庫使用指南 (Component Library Guide)

本指南旨在幫助開發者快速了解並正確使用「玄覺空間」的 UI 組件庫，確保全站風格統一且符合設計規範。

## 快速開始 (Quick Start)

所有組件均位於 `frontend/src/components` 目錄下。大部分組件已在 `index.ts` 中導出，方便引用。

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>範例標題</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="gold">點擊我</Button>
      </CardContent>
    </Card>
  );
}
```

---

## 基礎組件 (UI Components)

### Button (按鈕)

用於觸發動作或導航。

**Import:**
```tsx
import { Button } from '@/components/ui/Button';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger' \| 'gold'` | `'primary'` | 按鈕樣式變體 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 按鈕尺寸 |
| `loading` | `boolean` | `false` | 是否處於加載狀態 (顯示 Spinner 並禁用) |
| `fullWidth` | `boolean` | `false` | 是否佔滿容器寬度 |
| `icon` | `ReactNode` | - | 圖示 (同 leftIcon) |
| `leftIcon` | `ReactNode` | - | 左側圖示 |
| `rightIcon` | `ReactNode` | - | 右側圖示 |

**Usage:**
```tsx
// 各種變體
<Button variant="primary">主要按鈕</Button>
<Button variant="gold">金色加強</Button>
<Button variant="outline">外框按鈕</Button>
<Button variant="ghost">文字按鈕</Button>
<Button variant="danger">危險動作</Button>

// 加載狀態
<Button loading>提交中</Button>

// 帶圖示
<Button leftIcon={<Search size={16} />}>搜尋</Button>
```

**Do's and Don'ts:**
- **Do**: 使用 `loading` 屬性處理非同步動作，而非手動添加 Spinner。
- **Do**: 優先使用 `gold` 變體於主要的算命/占卜動作。
- **Don't**: 在一個區塊中放置過多 `gold` 或 `primary` 按鈕，應區分主次。

---

### Card (卡片)

用於封裝內容區塊。

**Import:**
```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
```

**Props (Card):**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'golden' \| 'interactive' \| 'glass' \| 'outline'` | `'default'` | 卡片樣式變體 |
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | - | 內邊距 |
| `hover` | `boolean` | `false` | 是否啟用懸停陰影效果 |

**Usage:**
```tsx
<Card variant="glass" padding="md">
  <CardHeader>
    <CardTitle>卡片標題</CardTitle>
  </CardHeader>
  <CardContent>
    這是卡片內容區塊。
  </CardContent>
  <CardFooter>
    頁腳內容
  </CardFooter>
</Card>

// 互動式卡片
<Card variant="interactive" onClick={() => {}}>
  點擊我
</Card>
```

**Do's and Don'ts:**
- **Do**: 使用 `variant="glass"` 於需要沉浸感背景的區塊。
- **Do**: 使用 `CardHeader` 和 `CardTitle` 確保標題樣式統一。
- **Don't**: 在 `CardContent` 內手動添加過多 Padding，優先使用 Card 的 `padding` 屬性。

---

### Input (輸入框)

標準的文字輸入元件。

**Import:**
```tsx
import { Input } from '@/components/ui/Input';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `label` | `string` | - | 輸入框標籤文字 |
| `error` | `string` | - | 錯誤訊息 (顯示於下方並標紅邊框) |
| `variant` | `'default' \| 'ghost'` | `'default'` | 樣式變體 |

**Usage:**
```tsx
<Input 
  label="用戶名" 
  placeholder="請輸入姓名" 
  error={errors.username}
/>
```

---

### Select (下拉選單)

標準的下拉選擇元件。

**Import:**
```tsx
import { Select } from '@/components/ui/Select';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `label` | `string` | - | 標籤文字 |
| `error` | `string` | - | 錯誤訊息 |
| `options` | `{ value: string; label: string }[]` | (必填) | 選項列表 |

**Usage:**
```tsx
<Select 
  label="選擇 AI 模型" 
  options={[
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'local', label: 'Local LLM' }
  ]}
/>
```

---

### Badge (標籤)

用於展示狀態或分類。

**Import:**
```tsx
import { Badge } from '@/components/ui/Badge';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'success' \| 'warning' \| 'error' \| 'accent'` | `'default'` | 狀態變體 |
| `size` | `'sm' \| 'md'` | `'md'` | 尺寸 |

**Usage:**
```tsx
<Badge variant="success">已完成</Badge>
<Badge variant="accent" size="sm">NEW</Badge>
```

---

### Skeleton (骨架屏)

用於加載狀態的佔位圖。

**Import:**
```tsx
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
```

**Props (Skeleton):**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `variant` | `'text' \| 'circular' \| 'rectangular'` | `'rectangular'` | 形狀變體 |

**Usage:**
```tsx
// 自定義骨架
<Skeleton variant="circular" className="w-12 h-12" />
<Skeleton variant="text" className="w-full" />

// 預設卡片骨架
<SkeletonCard />
```

---

### ThemeToggle (主題切換)

用於切換淺色、深色或系統主題模式。

**Import:**
```tsx
import { ThemeToggle } from '@/components/ui/ThemeToggle';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `variant` | `'icon' \| 'dropdown'` | `'icon'` | 樣式變體 |

**Usage:**
```tsx
// 簡單圖示切換
<ThemeToggle variant="icon" />

// 選項組切換
<ThemeToggle variant="dropdown" />
```

---

### Modal (彈窗)

對話框容器。

**Import:**
```tsx
import { Modal } from '@/components/ui/Modal';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `open` | `boolean` | (必填) | 是否顯示 |
| `onClose` | `() => void` | (必填) | 關閉回調 |
| `title` | `string` | - | 彈窗標題 |
| `showCloseButton` | `boolean` | `true` | 是否顯示關閉按鈕 (X) |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'lg'` | 寬度尺寸 |

**Usage:**
```tsx
<Modal 
  open={isOpen} 
  onClose={() => setIsOpen(false)} 
  title="詳細資訊"
>
  <p>彈窗內容...</p>
</Modal>
```

**Do's and Don'ts:**
- **Do**: 確保在 Modal 關閉時清理相關狀態。
- **Don't**: 在 Modal 內放置過於複雜的長表單，應考慮分步導覽。

---

## 佈局組件 (Layout Components)

### Container (容器)

用於控制內容的最大寬度與置中。

**Import:**
```tsx
import { Container } from '@/components/layout/Container';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'lg'` | 最大寬度 |
| `padding` | `boolean` | `true` | 是否包含水平內邊距 (px-4) |

---

### Navbar (導航列)

全站統一的頂部導航列。

**Import:**
```tsx
import { Navbar } from '@/components/layout/Navbar';
```

**Props:**

| 名稱 | 類型 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `pageTitle` | `string` | `'玄覺空間'` | 頁面標題 |
| `pageIcon` | `ReactNode` | `☯` | 頁面圖示 |
| `showBackButton` | `boolean` | `false` | 是否顯示返回按鈕 |
| `backHref` | `string` | `'/'` | 返回連結路徑 |
| `onLogout` | `() => void` | - | 登出時的額外回調 |

---

### Footer (頁腳)

全站統一的底欄。

**Import:**
```tsx
import { Footer } from '@/components/layout/Footer';
```

---

## 主題系統 (Theme System)

本專案支援淺色 (Light)、深色 (Dark) 及系統同步模式。

### useTheme Hook

用於獲取或設定主題狀態。

**Import:**
```tsx
import { useTheme } from '@/contexts/ThemeContext';
```

**API:**

| 名稱 | 類型 | 說明 |
| --- | --- | --- |
| `theme` | `'light' \| 'dark' \| 'system'` | 用戶設定的主題模式 |
| `resolvedTheme` | `'light' \| 'dark'` | 實際生效的主題 (解析系統模式後) |
| `setTheme` | `(theme: Theme) => void` | 更新主題模式 |

**Usage:**
```tsx
const { resolvedTheme, setTheme } = useTheme();

return (
  <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
    切換為 {resolvedTheme === 'dark' ? '淺色' : '深色'}
  </button>
);
```

---

## 語義化顏色標記 (Semantic Color Tokens)

開發時請優先使用這些 CSS 變數或 Tailwind 類別，而非固定色碼。

| Token | 淺色模式 | 深色模式 | 用途 | Tailwind 類別 |
| --- | --- | --- | --- | --- |
| `--bg-primary` | `#F8F6F3` | `#0A0E27` | 頁面背景 | `bg-background-primary` |
| `--bg-card` | `#FFFFFF` | `rgba(22,33,62,0.8)` | 卡片背景 | `bg-background-card` |
| `--accent` | `#B8962E` | `#D4AF37` | 金色強調色 | `text-accent` / `bg-accent` |
| `--text-primary` | `#0F172A` | `#EAEAEA` | 主要文字 | `text-foreground-primary` |
| `--text-secondary` | `#475569` | `#94A3B8` | 次要文字 | `text-foreground-secondary` |
| `--border` | `#E2E8F0` | `rgba(212,175,55,0.2)` | 標準邊框 | `border-border` |
| `--border-accent`| `#B8962E/20`| `#D4AF37/30` | 強調邊框 | `border-border-accent` |

---

## 注意事項

1. **響應式設計**: 所有組件均為移動優先設計。
2. **Icons**: 統一使用 `lucide-react` 圖標庫。
3. **動效**: 優先使用 Tailwind 的 `transition` 類別或組件內建動畫。
