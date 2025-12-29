# 六爻排盤工具技術規格 (MCP Tool Spec)

本文件詳細說明了 `divination-chart-mcp` 工具的輸入參數與輸出結構，供 AI 模型理解與排盤使用。

> [!NOTE]
> 本工具整合自開源專案：[divination-chart-mcp](https://github.com/wangsquirrel/divination-chart-mcp)
> 作者：Wáng Sōng (wangsquirrel@gmail.com)

## 工具名稱
`divination_liu_yao`

## 輸入參數 (Input JSON Schema)

| 欄位 | 類型 | 必填 | 說明 |
| :--- | :--- | :--- | :--- |
| `input_data.year` | Integer | 是 | 公曆年份 (1900-2100) |
| `input_data.month` | Integer | 是 | 月份 (1-12) |
| `input_data.day` | Integer | 是 | 日期 (1-31) |
| `input_data.hour` | Integer | 是 | 小時 (0-23) |
| `input_data.yaogua`| Array[Int]| 否 | 搖卦結果（從初爻到上爻）。0-3 代表硬幣背面個數。如果不提供則自動隨機搖卦。 |

## 輸出結構 (Output JSON Structure)

工具返回完整的六爻盤面信息：

### 核心欄位
- **`yaogua`**: 原始搖卦結果（6次擲硬幣背面的個數）。
- **`time`**: 起卦的完整時間。
- **`bazi`**: 起卦時間對應的干支（四柱）。
- **`kongwang`**: 旬中空亡的地支。
- **`guashen`**: 卦身。
- **`benguaming`**: 本卦卦名（如「既濟」）。
- **`bianguaming`**: 變卦（之卦）卦名（如「隨」）。
- **`shensha`**: 神煞列表（天乙貴人、驛馬、桃花、文昌等）。

### 爻位詳細信息 (`yao_1` 到 `yao_6`)
每個爻位包含：
- **`liushen`**: 該爻所臨的六神（青龍、朱雀、勾陳、螣蛇、白虎、玄武）。
- **`origin` (本卦爻)**:
  - `relative`: 六親（子孫、官鬼、父母、妻財、兄弟）。
  - `zhi`: 地支。
  - `wuxing`: 五行屬性。
  - `line`: 爻象（⚊ 陽，⚋ 陰）。
  - `is_subject`: 是否為世爻。
  - `is_object`: 是否為應爻。
  - `is_changed`: 是否為動爻（老陽/老陰）。
  - `fushen`: 伏神信息（若有）。
- **`variant` (變卦爻)**: 如果該爻發生變動，此處顯示變卦中對應位的六親與地支。

## 範例輸出

```json
{
  "yaogua": [1, 2, 3, 0, 1, 2],
  "time": "2025-12-25 17:00:00",
  "bazi": "乙巳 戊子 戊辰 辛酉",
  "kongwang": "戌亥",
  "benguaming": "既濟",
  "bianguaming": "隨",
  "yao_3": {
    "liushen": "白虎",
    "origin": {
      "relative": "兄弟",
      "zhi": "亥",
      "wuxing": "水",
      "line": "⚊",
      "is_subject": true,
      "is_changed": true
    },
    "variant": {
      "relative": "官鬼",
      "zhi": "辰"
    }
  }
}
```
