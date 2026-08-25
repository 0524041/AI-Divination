# AI 接入統一為 OpenAI-compatible BYOK ＋ 管理者管理的系統預設端點

支援多供應商（Google AI Studio、OpenRouter、OpenCode、本地 Ollama 等）且要讓管理者能隨時更換免費預設模型——若沿用「一家一個 service class」的路徑，每加一家就要寫一份客製程式碼且模型名散落硬編碼（已發生：gpt-5.1 vs gpt-4o 矛盾）。決定：**所有非 OAuth 的接入一律走 OpenAI-compatible `/chat/completions` 端點**（base_url + key + model 三元組），含 Gemini 官方相容端點，刪除各家專屬 SDK 路徑；OAuth 類連接僅在設定中保留 `auth_type` 擴充點，本輪不實作。系統預設端點存於 DB、由 admin 介面管理（首次啟動以環境變數種子化），不再寫死於程式碼。

## Considered Options

- 沿用多 provider class 擴充——拒絕：維護成本隨供應商數量線性成長。
- 支援 ChatGPT 網頁版 session token——拒絕：非官方管道，違反 ToS 且隨時失效。

## Consequences

Gemini 原生 SDK（含 thinking_level 等專屬參數）退場；供應商差異只能透過相容層表達，極少數不相容的供應商將無法接入。
