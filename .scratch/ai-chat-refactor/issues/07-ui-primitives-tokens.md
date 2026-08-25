# 07 — 「墨與金」設計 token 與 UI primitives 重造

**What to build:** 全新雙主題設計 token（墨底金 accent 的 dark／暖紙 light，ADR 方向＝東方玄學精緻化）與 Radix headless + CVA 元件庫：Button、Card、Dialog、DropdownMenu、Tabs、Toast、Tooltip、Input、Select、Skeleton、Badge。barrel exports 補齊。舊頁面平行存在不受影響（擴充階段）。

**Blocked by:** None — can start immediately

**Status:** done（2026-08-25）

- [x] Token 層：色彩/字體/間距/圓角/陰影 雙主題 CSS variables＋Tailwind 映射
- [x] 上述 11 個 primitives 完成（Radix 行為＋CVA variants）
- [x] barrel export 統一出口
- [x] framer-motion 加入依賴並提供共用轉場 preset
- [x] globals.css 字重 !important hack 與壞掉 animate class 的清退計畫（本票僅 token 層，頁面遷移在後續票）

## 測試項目（Seam③：vitest + jsdom）
1. 每個 primitive：variants 渲染快照＋互動 smoke
2. Dialog：開關、focus trap、Esc 關閉、aria 屬性
3. DropdownMenu/Tabs：鍵盤導航
4. Toast：佇列、自動消失、手動關閉
5. Input/Select：label 關聯、error 狀態呈現
6. 主題切換：dark/light class 切換後 token 變數生效
7. reduced-motion 下轉場 preset 降級
