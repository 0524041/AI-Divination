'use client';

import { marked } from 'marked';

export interface ParsedContent {
  thinkContent: string;  // <think> 標籤內的內容
  mainHtml: string;      // 主要內容的 HTML
}

/**
 * 解析並渲染 Markdown 內容
 * @param content - 原始 Markdown/AI 回傳內容
 * @returns 解析後的內容（包含思考過程和主要 HTML）
 */
export async function parseMarkdown(content: string): Promise<ParsedContent> {
  if (!content) return { thinkContent: '', mainHtml: '' };

  let thinkContent = '';
  let cleanContent = content;

  // 1. 提取 <think>...</think> 內容
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thinkContent = thinkMatch[1].trim();
    cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }

  // 2. 移除 markdown code block 包裝（如果 AI 把內容包在 ``` 裡面）
  // 匹配開頭的 ``` 或 ```markdown 或 ```md
  cleanContent = cleanContent.replace(/^```(?:markdown|md)?\s*\n?/i, '');
  // 匹配結尾的 ```
  cleanContent = cleanContent.replace(/\n?```\s*$/i, '');
  cleanContent = cleanContent.trim();

  // 3. 配置 marked
  marked.setOptions({
    breaks: true,  // 將單個換行轉換為 <br>
    gfm: true,     // 啟用 GitHub Flavored Markdown
  });

  // 4. 解析 Markdown
  const rawHtml = await marked.parse(cleanContent);

  // 5. 使用 DOMPurify 清理 HTML（僅在瀏覽器環境）
  let mainHtml = rawHtml;
  if (typeof window !== 'undefined') {
    const DOMPurify = (await import('dompurify')).default;
    mainHtml = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['span'],
      ADD_ATTR: ['class', 'style'],
    });
  }

  return { thinkContent, mainHtml };
}

/**
 * 簡單版本：只返回 HTML 字串（向後兼容）
 */
export async function parseMarkdownSimple(content: string): Promise<string> {
  const result = await parseMarkdown(content);
  return result.mainHtml;
}
