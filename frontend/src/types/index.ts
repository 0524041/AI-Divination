// 用戶相關類型
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at?: string;
  last_login?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

// 設定相關類型
export interface Settings {
  daily_limit: string;
  ai_provider: 'local' | 'gemini';
  local_api_url: string;
  local_model_name: string;
  system_prompt?: string;
  default_prompt?: string;
}

// 占卜相關類型
export interface DivinationRequest {
  question: string;
  coins: number[]; // 6 個數字，每個 0-3，代表背面個數
}

export interface ToolStatus {
  get_divination_tool: 'unused' | 'success' | 'error';
  get_current_time: 'unused' | 'success' | 'error';
}

export interface DivinationResponse {
  id: number;
  result: string;
  tool_status: ToolStatus;
  ai_model?: string;
}

// 結構化 AI 輸出 (舊版 JSON 格式)
export interface StructuredResult {
  summary: string;
  overview: {
    title: string;
    meaning: string;
  };
  sections: Array<{
    title: string;
    content: string;
  }>;
  guidance: {
    conclusion: string;
    suggestions: string[];
    motto: string;
  };
}

// 歷史記錄類型
export interface HistoryItem {
  id: number;
  user_id: number;
  question: string;
  result_json: string;
  interpretation: string;
  ai_model?: string;
  is_favorite: boolean;
  created_at: string;
  date_str: string;
  username?: string; // Admin 查詢時顯示
}

// 占卜類別選項
export interface DivinationCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subCategories?: SubCategory[];
}

export interface SubCategory {
  id: string;
  name: string;
  promptHint: string;
}

// API 響應類型
export interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  data?: T;
}
