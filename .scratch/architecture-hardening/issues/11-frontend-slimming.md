# 11 — 前端瘦身（bundle／圖片／動畫）

**What to build:**

- `ziwei` 頁的 `iztro`（client 端排盤）改用 `next/dynamic` 延遲載入，主 bundle 不含整套排盤引擎。
- `BackgroundCanvas`（p5 flow-field）依 `prefers-reduced-motion` 停用，頁面 `document.hidden` 時暫停動畫。
- 移除未被引用的依賴 `react-p5`、`react-p5-wrapper`、`p5`、`lunar-javascript`（`@p5-wrapper/react` 保留）。
- `TarotCardFace` 的卡圖加 `loading="lazy"`、`decoding="async"` 與 `width`/`height`（或改 `next/image`）。

**Why:** 減少初始 JS 與圖片頻寬、降低行動裝置 CPU／電量。

**Status:** done

- [ ] iztro 動態載入
- [ ] p5 動畫節流
- [ ] 清冗餘依賴（同步更新 package/lock）
- [ ] tarot 圖片 lazy

## 測試項目
1. `npm run test:run`、`tsc --noEmit`、`lint` 全綠
2. `npm run build` 成功，紫微頁仍能排盤

## Notes
`next/font` 自託管 CJK 字型 build 風險高，本輪不處理。

**2026-10-03：** 已做 p5 動畫節流（reduced-motion＋分頁隱藏）、移除冗餘依賴（`react-p5`、`react-p5-wrapper`、`lunar-javascript`）、tarot 圖片 lazy。**iztro 動態載入本輪不做**：`iztro` 已被 App Router 依 route 拆分，僅存在 `/ziwei` chunk（build 顯示該路由 157kB），收益有限而改動風險高，留待後續。
