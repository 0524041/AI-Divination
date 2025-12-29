# 完整流程範例：從前端到 AI 解讀

## 📋 概述

本文檔詳細說明當用戶使用六爻算命系統時，從前端發起請求到 AI 返回解讀的完整流程。

---

## 1️⃣ 前端發送請求

### 前端數據準備

當用戶點擊「開始占卜」按鈕後，前端會準備以下數據：

```javascript
// 前端發送的 JSON 數據
{
  "question": "我最近的事業運勢如何？",
  "coins": [1, 2, 1, 2, 3, 1],
  "gender": "男",      // 可選
  "target": "自己"     // 可選
}
```

### 硬幣數據說明

`coins` 陣列包含 6 個數字（從下到上，初爻到上爻）：
- `0` = 老陰 ⚋○ (3個正面) - 動爻，陰爻變陽爻
- `1` = 少陽 ⚊ (2正1背)
- `2` = 少陰 ⚋ (1正2背)
- `3` = 老陽 ⚊○ (3個背面) - 動爻，陽爻變陰爻

**範例解讀**：`[1, 2, 1, 2, 3, 1]`
```
上爻(6): 1 → 少陽 ⚊
五爻(5): 3 → 老陽 ⚊○ (動爻)
四爻(4): 2 → 少陰 ⚋
三爻(3): 1 → 少陽 ⚊
二爻(2): 2 → 少陰 ⚋
初爻(1): 1 → 少陽 ⚊
```

### API 請求

```bash
POST http://localhost:5000/api/divinate
Content-Type: application/json
Authorization: Bearer {session_cookie}
X-Gemini-Api-Key: {user_gemini_key}  # 可選，使用 Gemini 時需要

{
  "question": "我最近的事業運勢如何？",
  "coins": [1, 2, 1, 2, 3, 1],
  "gender": "男",
  "target": "自己"
}
```

---

## 2️⃣ 後端處理流程

### Step 1: 接收請求並驗證

```python
# server.py - /api/divinate 端點

@app.route('/api/divinate', methods=['POST'])
@auth.login_required
def divinate():
    data = request.json
    question = data.get('question')      # "我最近的事業運勢如何？"
    coins = data.get('coins')           # [1, 2, 1, 2, 3, 1]
    gender = data.get('gender')         # "男"
    target = data.get('target')         # "自己"
    
    user_id = session['user_id']
    
    # 檢查每日使用次數限制
    # ...
```

### Step 2: 調用六爻排盤算法

```python
# server.py

from lib.divination import get_divination_tool

# 調用六爻排盤核心算法
divination_result = get_divination_tool(yaogua=coins)

# divination_result 是一個字典，包含完整的排盤信息
```

### 排盤結果範例 (Python Dict)

```python
{
    "time": "2025-12-29 14:30:00",
    "bazi": "乙巳年 戊子月 壬申日 丁未時",
    "kongwang": "戌亥",
    "guashen": "乾",
    "benguaming": "天風姤",
    "bianguaming": "天山遯",
    "gua_type": "一世卦",
    
    "shensha": [
        {"name": "驛馬", "zhi": ["寅"]},
        {"name": "桃花", "zhi": ["酉"]}
    ],
    
    "yao_1": {
        "liushen": "青龍",
        "origin": {
            "relative": "妻財",
            "zhi": "卯",
            "wuxing": "木",
            "line": "⚊",
            "is_yang": True,
            "is_subject": False,
            "is_object": False,
            "is_changed": False
        }
    },
    
    "yao_2": {
        "liushen": "玄武",
        "origin": {
            "relative": "官鬼",
            "zhi": "巳",
            "wuxing": "火",
            "line": "⚋",
            "is_yang": False,
            "is_subject": False,
            "is_object": False,
            "is_changed": False
        }
    },
    
    # ... yao_3, yao_4 類似
    
    "yao_5": {
        "liushen": "白虎",
        "origin": {
            "relative": "父母",
            "zhi": "戌",
            "wuxing": "土",
            "line": "⚊",
            "is_yang": True,
            "is_subject": True,      # 世爻
            "is_object": False,
            "is_changed": True       # 動爻
        },
        "variant": {                 # 變爻信息
            "relative": "父母",
            "zhi": "申",
            "wuxing": "金",
            "line": "⚋",
            "is_yang": False
        }
    },
    
    "yao_6": {
        "liushen": "螣蛇",
        "origin": {
            "relative": "兄弟",
            "zhi": "亥",
            "wuxing": "水",
            "line": "⚊",
            "is_yang": True,
            "is_subject": False,
            "is_object": True,       # 應爻
            "is_changed": False
        }
    },
    
    # 如果該卦有卦辭爻辭
    "gua_ci": "姤：女壯，勿用取女。",
    "yao_ci": {
        6: "上九：姤其角，吝，無咎。",
        5: "九五：以杞包瓜，含章，有隕自天。",
        4: "九四：包無魚，起凶。",
        3: "九三：臀無膚，其行次且，厲，無大咎。",
        2: "九二：包有魚，無咎，不利賓。",
        1: "初六：繫于金柅，貞吉，有攸往，見凶，羸豕孚蹢躅。"
    }
}
```

### Step 3: 格式化排盤結果

```python
# server.py 調用 format_divination_result()

from lib.divination import format_divination_result

# 將字典格式化為可讀的文本
formatted_text = format_divination_result(
    divination_result, 
    gender="男", 
    target="自己"
)
```

---

## 3️⃣ 格式化後的文本（送給 AI）

```
============================================================
起卦時間: 2025-12-29 14:30:00
八字: 乙巳年 戊子月 壬申日 丁未時
空亡: 戌亥
卦宮: 乾
本卦: 天風姤
變卦: 天山遯
卦類型: 一世卦
============================================================
求測者性別: 男
占卜對象: 自己
============================================================
神煞: 驛馬:['寅'], 桃花:['酉']
------------------------------------------------------------
爻位   六神     六親     地支   五行   爻象   世應   動    變爻
------------------------------------------------------------
6爻    螣蛇    兄弟    亥   水   ⚊   應       
5爻    白虎    父母    戌   土   ⚊   世   ○    → 父母 申金
4爻    勾陳    父母    申   金   ⚊           
3爻    朱雀    官鬼    午   火   ⚊           
2爻    玄武    官鬼    巳   火   ⚋           
1爻    青龍    妻財    卯   木   ⚊           
============================================================

【易經原文】
------------------------------------------------------------
卦辭: 姤：女壯，勿用取女。

爻辭:
  上九：姤其角，吝，無咎。
  九五：以杞包瓜，含章，有隕自天。
  九四：包無魚，起凶。
  九三：臀無膚，其行次且，厲，無大咎。
  九二：包有魚，無咎，不利賓。
  初六：繫于金柅，貞吉，有攸往，見凶，羸豕孚蹢躅。
============================================================
```

---

## 4️⃣ 組裝 System Prompt

### 讀取 Prompt 模板

```python
# server.py

def get_system_prompt():
    """讀取 prompts/system_prompt.md"""
    with open('prompts/system_prompt.md', 'r', encoding='utf-8') as f:
        return f.read()

prompt_template = get_system_prompt()
```

### System Prompt 模板

`prompts/system_prompt.md` 內容包含：

```markdown
# Role
你是一位精通《易經》六爻預測學的國學大師...

# Knowledge Base (六爻解卦專業規則)
1. 取用神...
2. 斷旺衰...
3. 看動變...
...

# Task Workflow
1. 審視盤面
2. 定性問題
3. 邏輯推演
4. 結構化輸出

---

現在用戶的問題是：

<問題>
{question}
</問題>

六爻排盤結果如下：

<內容>
{divination_result}
</內容>

請根據上述卦象進行專業解讀。
```

### 替換變量

```python
# server.py

full_prompt = prompt_template.replace(
    '{question}', question
).replace(
    '{divination_result}', formatted_text
)
```

---

## 5️⃣ 完整的 AI Prompt（最終版本）

```
# Role
你是一位精通《易經》六爻預測學的國學大師，擁有深厚的斷卦經驗。你精通京房易學，善於運用「黃金策」、「增刪卜易」等古籍理論，能準確捕捉盤面中的吉凶信號，並結合現代生活給予求測者充滿智慧與人文關懷的指引。

# Knowledge Base (六爻解卦專業規則)
在解盤時，請嚴格遵守以下邏輯與規則：

1.  **取用神 (Determine the Focus Line)**:
    * **自身/運勢**: 看「世爻」。
    * **求財/生意**: 看「妻財爻」。
    * **事業/官運/訴訟**: 看「官鬼爻」。
    * **學業/文書/房產/長輩**: 看「父母爻」。
    * **子孫/醫藥/解憂/寵物**: 看「子孫爻」。
    * **競爭/朋友/阻礙**: 看「兄弟爻」。
    * *特殊規則*: 若用神不上卦，需查看伏神。

2.  **斷旺衰 (Analyze Strength)**:
    * **月建 (Month)**: 掌管一月之權，決定爻的先天旺衰（旺、相、休、囚、死）。
    * **日辰 (Day)**: 主宰一日之令，能生剋沖合卦中之爻，不僅看旺衰，更看「暗動」與「沖散」。
    * **空亡 (Void)**: 爻入空亡（旬空），代表暫時無力、落空、心猿意馬，出空或被沖時可解。

3.  **看動變 (Moving Lines)**:
    * **動爻**: 是事情變化的樞紐，神兆機於動。
    * **回頭生**: 變爻生本爻，吉者更吉。
    * **回頭剋**: 變爻剋本爻，凶。
    * **化進神**: 如申化酉，力量增強；**化退神**: 如酉化申，力量減弱。

4.  **神煞與六神 (Shensha & Six Gods)**:
    * **青龍**: 主喜慶、正直；**白虎**: 主血光、威嚴、道路；**朱雀**: 主口舌、文書；**玄武**: 主曖昧、隱私、盜賊；**勾陳**: 主田土、遲滯；**螣蛇**: 主驚恐、怪夢。
    * **驛馬**: 主變動、出行；**桃花**: 主異性緣、社交。

5.  **世應關係**: 世為自己，應為他人/環境。世應相生則和諧，相剋則艱難，相沖則變數大。

6.  **卦象性質**:
    * **本宮卦**: 最穩定，事情按部就班。
    * **遊魂卦**: 不安定，心猿意馬，易有變動。
    * **歸魂卦**: 事情回歸、結束，或重新開始。

---

# Task Workflow
請依照以下步驟進行思考與輸出：

1.  **審視盤面**: 閱讀提供的起卦時間與卦象（本卦、變卦、六親分布）。
2.  **定性問題**: 根據用戶的問題鎖定「用神」。
3.  **邏輯推演**:
    * 分析用神在日月建下的旺衰。
    * 分析世爻（求測者狀態）與應爻（對方/環境）的關係。
    * 重點分析「動爻」，看其對用神與世爻的作用（生剋沖合）。
    * 結合六神與神煞輔助判斷細節。
4.  **結構化輸出**: 將分析結果按 Markdown 格式輸出。

---

現在用戶的問題是：

<問題>
我最近的事業運勢如何？
</問題>

六爻排盤結果如下：

<內容>
============================================================
起卦時間: 2025-12-29 14:30:00
八字: 乙巳年 戊子月 壬申日 丁未時
空亡: 戌亥
卦宮: 乾
本卦: 天風姤
變卦: 天山遯
卦類型: 一世卦
============================================================
求測者性別: 男
占卜對象: 自己
============================================================
神煞: 驛馬:['寅'], 桃花:['酉']
------------------------------------------------------------
爻位   六神     六親     地支   五行   爻象   世應   動    變爻
------------------------------------------------------------
6爻    螣蛇    兄弟    亥   水   ⚊   應       
5爻    白虎    父母    戌   土   ⚊   世   ○    → 父母 申金
4爻    勾陳    父母    申   金   ⚊           
3爻    朱雀    官鬼    午   火   ⚊           
2爻    玄武    官鬼    巳   火   ⚋           
1爻    青龍    妻財    卯   木   ⚊           
============================================================

【易經原文】
------------------------------------------------------------
卦辭: 姤：女壯，勿用取女。

爻辭:
  上九：姤其角，吝，無咎。
  九五：以杞包瓜，含章，有隕自天。
  九四：包無魚，起凶。
  九三：臀無膚，其行次且，厲，無大咎。
  九二：包有魚，無咎，不利賓。
  初六：繫于金柅，貞吉，有攸往，見凶，羸豕孚蹢躅。
============================================================
</內容>

請根據上述卦象進行專業解讀。
```

---

## 6️⃣ 調用 AI 服務

### 選擇 AI Provider

```python
# server.py

ai_provider = get_setting('ai_provider', 'local')  # 'gemini' 或 'local'

if ai_provider == 'gemini':
    # 使用 Gemini API
    user_gemini_key = request.headers.get('X-Gemini-Api-Key')
    user_client = genai.Client(api_key=user_gemini_key)
    
    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="high")
    )
    
    response = user_client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[full_prompt],
        config=config
    )
    
    interpretation = response.text

else:
    # 使用本地 AI (OpenAI-compatible API)
    local_url = get_setting('local_api_url', 'http://localhost:1234/v1')
    local_model = get_setting('local_model_name', 'qwen/qwen3-8b')
    
    interpretation = call_local_ai(full_prompt, local_url, local_model)
```

---

## 7️⃣ AI 返回解讀結果

### AI 輸出範例

````markdown
## 🎯 卦象總覽

**【天風姤 之 天山遯】**

> 一句話總結：事業當前處於遇合期，五爻父母動而化退，需警惕文書、合約或上層決策的變動，宜穩守待時，切忌貿然進取。

---

## 📊 盤面分析

### 用神分析
問事業運勢，主看「官鬼爻」與「世爻」。此卦官鬼午火、巳火並現，午火於三爻，巳火於二爻，均為離火之象。月建戊子水剋火，日辰壬申金生水助剋，官鬼休囚無力，代表事業機會暫時不顯，職位升遷難有突破。

### 世應與現狀
世爻五爻父母戌土，臨白虎主威嚴、道路、文書。父母爻在世，代表求測者當前心思多放在文書、合約、或是長輩上司的意見上。應爻六爻兄弟亥水，臨螣蛇主驚恐、不安，亥水剋世爻戌土，顯示外界環境（同事、競爭者）對你有些壓力或掣肘。

### 動爻玄機
**關鍵**：五爻父母戌土動，化父母申金。此為「化退神」，力量減弱。白虎動主文書、合約有變，或上司決策不穩。戌土化申金為「回頭生」，但因化退，吉意打折。建議：近期若有合約、文書事宜，需謹慎審閱，避免因細節疏忽而生變故。

### 神煞輔佐
- **驛馬臨寅**：代表變動、出行，但寅木不在卦中，變動暫不明顯。
- **桃花臨酉**：代表人緣、社交，酉金不在卦中，異性緣或社交助力有限。
- **六神白虎動**：主威嚴、道路、血光，在父母爻動時尤需注意文書合約的法律風險。

---

## 🔮 吉凶判斷

**結論：平中帶憂**

官鬼休囚，升遷無力；世爻動而化退，自身狀態亦有減弱之象。整體而言，近期事業運勢「不算凶，但難言吉」，宜守不宜攻，等待時機成熟再發力。

---

## 💡 行動建議

1. **穩守為上**：近期不宜冒進，尤其涉及合約、文書、投資等事務，需反覆確認細節。
2. **關注文書**：五爻父母動，代表文書、合約或上司決策有變，務必保持警覺，避免因疏忽而生變故。
3. **養精蓄銳**：官鬼休囚，代表機會未至。此時宜充實自我，學習新技能，為未來時機做準備。

---

## 📜 贈言

> 「九五：以杞包瓜，含章，有隕自天。」
> 
> 易經告訴我們，即便當前局勢不明，內在的美好終會顯現。保持低調、謹慎行事，天時到來時，自然會有好消息從天而降。耐心守候，方為智者之道。
````

---

## 8️⃣ 後端返回前端

```python
# server.py

# 保存歷史記錄
history_id = add_history(question, divination_result, interpretation, user_id)

# 返回 JSON
return jsonify({
    "id": history_id,
    "result": interpretation,  # AI 解讀的 Markdown 文本
    "tool_status": {
        "get_current_time": "success",
        "get_divination_tool": "success"
    }
})
```

### 返回的 JSON 範例

```json
{
  "id": 123,
  "result": "## 🎯 卦象總覽\n\n**【天風姤 之 天山遯】**\n\n> 一句話總結：...",
  "tool_status": {
    "get_current_time": "success",
    "get_divination_tool": "success"
  }
}
```

---

## 9️⃣ 前端展示

前端接收到 JSON 後：
1. 解析 `result` 欄位（Markdown 文本）
2. 使用 Markdown 渲染器顯示格式化結果
3. 顯示卦象圖、動爻標記等視覺化元素

---

## 📊 完整流程圖

```
┌─────────────┐
│   用戶輸入   │
│   問題 +     │
│ 性別/對象   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   前端       │
│ 產生 6 個    │
│ 硬幣結果     │
└──────┬──────┘
       │
       ▼ POST /api/divinate
┌─────────────┐
│   後端       │
│ 驗證 + 限制  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 調用六爻     │
│ 排盤算法     │
│divination_   │
│  core.py    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 格式化排盤   │
│   結果為     │
│   文本       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 組裝 System  │
│   Prompt    │
│ (問題+盤面)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 調用 AI      │
│ (Gemini/     │
│  Local AI)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AI 返回      │
│ Markdown     │
│ 格式解讀     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 保存歷史     │
│ 返回前端     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 前端渲染     │
│ Markdown +   │
│ 視覺化卦象   │
└─────────────┘
```

---

## 🎯 關鍵要點

1. **硬幣數據由前端產生**：確保用戶每次占卜的隨機性
2. **六爻排盤核心獨立**：`divination_core.py` 負責所有排盤邏輯
3. **格式化層分離**：`format_divination_result()` 將字典轉為 AI 可讀文本
4. **System Prompt 外部化**：`system_prompt.md` 可獨立修改而不影響代碼
5. **AI Provider 可切換**：支援 Gemini 和本地 AI，用戶可自由選擇
6. **完整的信息流**：從起卦時間、八字、六爻排盤、卦辭爻辭，全部傳給 AI

---

## 🔧 調試建議

如需查看完整流程，可在後端添加日誌：

```python
print("=" * 60)
print("【收到前端請求】")
print(f"問題: {question}")
print(f"硬幣: {coins}")
print(f"性別: {gender}, 對象: {target}")
print("=" * 60)
print("【六爻排盤結果】")
print(json.dumps(divination_result, ensure_ascii=False, indent=2))
print("=" * 60)
print("【格式化後文本】")
print(formatted_text)
print("=" * 60)
print("【完整 AI Prompt】")
print(full_prompt)
print("=" * 60)
```

這樣可以清楚看到每一步的數據流動！
