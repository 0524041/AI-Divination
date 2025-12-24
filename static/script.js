let currentHistoryId = null;

function showSection(sectionId) {
    // Nav active state
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    if (sectionId === 'divine' || sectionId === 'result') {
        document.getElementById('nav-divine').classList.add('active');
    } else if (sectionId === 'history') {
        document.getElementById('nav-history').classList.add('active');
        loadHistory();
    }

    // Hide others
    document.querySelectorAll('section').forEach(sec => sec.classList.remove('active-section', 'hidden'));
    
    // Show target
    const target = document.getElementById(`section-${sectionId}`);
    target.classList.add('active-section');
    
    // Special case for result: it's kind of a sub-state of divine usually
    
}

async function performDivination() {
    const question = document.getElementById('question-input').value.trim();
    if (!question) {
        alert("請輸入您想要問的問題");
        return;
    }

    // Show loading UI
    document.getElementById('question-input').disabled = true;
    document.getElementById('divine-btn').disabled = true;
    document.getElementById('divine-btn').innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;margin:0 10px 0 0;"></span> 連結天機...';
    
    showSection('result');
    document.getElementById('result-content').innerHTML = '';
    document.getElementById('loading-indicator').classList.remove('hidden');

    try {
        const response = await fetch('/api/divinate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "占卜失敗");
        }

        // Success
        currentHistoryId = data.id;
        document.getElementById('loading-indicator').classList.add('hidden');
        renderResult(data.result);
        
    } catch (err) {
        document.getElementById('loading-indicator').classList.add('hidden');
        document.getElementById('result-content').innerHTML = `<p style="color: #ff6b6b; text-align: center;">天機晦暗，請稍後再試。<br>錯誤訊息: ${err.message}</p>`;
    } finally {
        document.getElementById('question-input').disabled = false;
        document.getElementById('divine-btn').disabled = false;
        document.getElementById('divine-btn').innerHTML = '<span class="btn-text">占卜</span><span class="btn-icon"><i class="fas fa-sparkles"></i></span>';
    }
}

function renderResult(markdownText) {
    const contentDiv = document.getElementById('result-content');
    contentDiv.innerHTML = marked.parse(markdownText);
}

async function loadHistory() {
    const listDiv = document.getElementById('history-list');
    listDiv.innerHTML = '<p style="text-align:center;color:#888;">載入中...</p>';
    
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        
        if (history.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center;color:#888;">暫無紀錄</p>';
            return;
        }

        listDiv.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="history-content" onclick="viewHistoryItem(${item.id})">
                    <div class="history-question">${item.question}</div>
                    <div class="history-date">${item.created_at}</div>
                </div>
                <div class="history-actions">
                    <button onclick="toggleFavorite(${item.id}, ${!item.is_favorite}, this)" class="${item.is_favorite ? 'favorite' : ''}">
                        <i class="${item.is_favorite ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    <button onclick="copyToClipboard(\`${item.interpretation.replace(/`/g, '\\`').replace(/"/g, '&quot;')}\`)"><i class="fas fa-copy"></i></button>
                </div>
            </div>
        `).join('');
        
    } catch (err) {
        listDiv.innerHTML = '<p style="text-align:center;color:red;">載入失敗</p>';
    }
}

// Global cache for viewing history details simply
// In a real app we might refetch or store in array. 
// For now, let's just refetch history to find the item or implement a robust cache.
// Simplified: View history not implemented in detail, just alert or quick show.
// Better: When converting divinate to use this code, allow clicking history to "replay" the result.

async function viewHistoryItem(id) {
    // Fetch fresh to be sure
    const response = await fetch('/api/history');
    const history = await response.json();
    const item = history.find(h => h.id === id);
    if (item) {
        currentHistoryId = item.id;
        showSection('result');
        document.getElementById('loading-indicator').classList.add('hidden');
        renderResult(item.interpretation);
    }
}

async function toggleFavorite(id, newState, btn) {
    try {
        await fetch(`/api/history/${id}/favorite`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_favorite: newState })
        });
        
        // Update UI
        const icon = btn.querySelector('i');
        if (newState) {
            btn.classList.add('favorite');
            icon.classList.remove('far');
            icon.classList.add('fas');
            btn.onclick = () => toggleFavorite(id, false, btn);
        } else {
            btn.classList.remove('favorite');
            icon.classList.remove('fas');
            icon.classList.add('far');
            btn.onclick = () => toggleFavorite(id, true, btn);
        }
    } catch (err) {
        console.error(err);
    }
}

async function saveCurrentResult() {
    if (currentHistoryId) {
        // Toggle favorite for current
        // We don't know current state easily without checking, assume it's to "Favorite" (true)
        // Or we should track state.
        await toggleFavorite(currentHistoryId, true, { classList: { add: ()=>{} }, querySelector: ()=>({ classList: { remove: ()=>{}, add: ()=>{} } }) }); // Dummy btn object
        alert("已收藏！");
    }
}

function copyToMarkdown() {
    const content = document.getElementById('result-content').innerText; // Get text content
    // Better: We should store the raw markdown somewhere?
    // Actually renderResult accepts markdown, so we have it.
    // Ideally we should cache the raw markdown in a variable.
    // For now, I'll just copy the text.
    // IMPROVEMENT: Store raw markdown in global var.
    navigator.clipboard.writeText(lastMarkdown);
    alert("已複製為 Markdown");
}

let lastMarkdown = "";
const originalRender = renderResult;
renderResult = function(md) {
    lastMarkdown = md;
    originalRender(md);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert("已複製");
}

// Init
showSection('divine');
