import { API_URL } from './config.js';
import { escapeHTML } from './utils.js';

const HISTORY_KEY = 'edushare_search_history';
const MAX_HISTORY = 5;

let TRENDING_SEARCHES = [];

async function fetchTrendingSearches() {
    if (TRENDING_SEARCHES.length > 0) return;
    try {
        const res = await fetch(`${API_URL}/documents/trending-searches`);
        if (res.ok) {
            const data = await res.json();
            TRENDING_SEARCHES = data.trendingSearches || [];
        }
    } catch (e) {
        console.error('Error fetching trending searches', e);
    }
}

export function setupSearchWidget(containerSelector = '.nav-search') {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    if (container.dataset.searchInitialized) return;
    container.dataset.searchInitialized = 'true';

    fetchTrendingSearches();

    const input = container.querySelector('input');
    const searchIcon = container.querySelector('.search-icon');
    
    let wrapper = container.querySelector('.search-input-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'search-input-wrapper';
        container.insertBefore(wrapper, input);
        wrapper.appendChild(searchIcon);
        wrapper.appendChild(input);
    }

    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'btn-clear-search';
    btnClear.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    wrapper.appendChild(btnClear);

    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    container.appendChild(dropdown);

    let debounceTimer = null;
    let currentFocusIndex = -1;
    let suggestionsList = [];
    
    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveHistory(query) {
        if (!query) return;
        let history = getHistory();
        history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
        history.unshift(query);
        if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function removeHistoryItem(query) {
        let history = getHistory();
        history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        renderDefaultView();
    }

    function clearHistory() {
        localStorage.removeItem(HISTORY_KEY);
        renderDefaultView();
    }

    function performSearch(query) {
        if (!query) return;
        saveHistory(query);
        window.location.href = `../document/searchResults.html?q=${encodeURIComponent(query)}`;
    }
    
    function highlightMatch(text, query) {
        if (!query) return escapeHTML(text);
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return escapeHTML(text).replace(regex, '<span class="search-highlight">$1</span>');
    }

    function renderDefaultView() {
        const history = getHistory();
        let html = '';
        suggestionsList = [];
        
        if (history.length > 0) {
            html += `
                <div class="search-section">
                    <div class="search-section-title">
                        <span>Lịch sử tìm kiếm</span>
                        <button class="btn-clear-history" id="btnClearHistory">Xóa tất cả</button>
                    </div>
            `;
            history.forEach(item => {
                suggestionsList.push({ type: 'history', text: item });
                html += `
                    <div class="search-item" data-query="${escapeHTML(item)}">
                        <i class="fa-solid fa-clock-rotate-left item-icon"></i>
                        <span class="item-text">${escapeHTML(item)}</span>
                        <button class="btn-remove-history" data-query="${escapeHTML(item)}" title="Xóa"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `
            <div class="search-section">
                <div class="search-section-title"><span>Tìm kiếm phổ biến</span></div>
        `;
        TRENDING_SEARCHES.forEach(item => {
            suggestionsList.push({ type: 'trending', text: item });
            html += `
                <div class="search-item" data-query="${escapeHTML(item)}">
                    <i class="fa-solid fa-arrow-trend-up item-icon" style="color: var(--primary);"></i>
                    <span class="item-text">${escapeHTML(item)}</span>
                </div>
            `;
        });
        html += `</div>`;
        
        dropdown.innerHTML = html;
        attachItemListeners();
    }

    async function fetchSuggestions(query) {
        dropdown.innerHTML = `<div class="search-empty"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm kiếm...</div>`;
        try {
            const res = await fetch(`${API_URL}/documents/search?q=${encodeURIComponent(query)}&limit=5`);
            const data = await res.json();
            
            suggestionsList = [];
            let html = '';
            
            if (res.ok && data.data && data.data.length > 0) {
                html += `<div class="search-section"><div class="search-section-title"><span>Gợi ý tài liệu</span></div>`;
                data.data.forEach(doc => {
                    suggestionsList.push({ type: 'doc', text: doc.TenTL });
                    html += `
                        <div class="search-item" data-query="${escapeHTML(doc.TenTL)}">
                            <i class="fa-solid fa-file-lines item-icon"></i>
                            <span class="item-text">${highlightMatch(doc.TenTL, query)}</span>
                        </div>
                    `;
                });
                html += `</div>`;
            } else {
                suggestionsList.push({ type: 'query', text: query });
                html += `
                    <div class="search-item" data-query="${escapeHTML(query)}">
                        <i class="fa-solid fa-magnifying-glass item-icon"></i>
                        <span class="item-text">Tìm kiếm cho "<strong>${escapeHTML(query)}</strong>"</span>
                    </div>
                `;
            }
            
            dropdown.innerHTML = html;
            attachItemListeners();
        } catch (err) {
            console.error('Error fetching suggestions:', err);
            dropdown.innerHTML = `<div class="search-empty">Lỗi kết nối. Nhấn Enter để tìm kiếm.</div>`;
        }
    }

    function attachItemListeners() {
        const items = dropdown.querySelectorAll('.search-item');
        items.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-remove-history')) {
                    e.stopPropagation();
                    const query = e.target.closest('.btn-remove-history').dataset.query;
                    removeHistoryItem(query);
                    return;
                }
                const query = item.dataset.query;
                input.value = query;
                performSearch(query);
            });
            item.addEventListener('mouseenter', () => {
                updateFocus(index);
            });
        });

        const btnClearAll = dropdown.querySelector('#btnClearHistory');
        if (btnClearAll) {
            btnClearAll.addEventListener('click', (e) => {
                e.stopPropagation();
                clearHistory();
            });
        }
    }

    function updateFocus(newIndex) {
        const items = dropdown.querySelectorAll('.search-item');
        if (items.length === 0) return;
        
        items.forEach(el => el.classList.remove('active'));
        
        if (newIndex >= items.length) newIndex = -1;
        if (newIndex < -1) newIndex = items.length - 1;
        
        currentFocusIndex = newIndex;
        
        if (currentFocusIndex !== -1) {
            items[currentFocusIndex].classList.add('active');
        }
    }
    
    input.addEventListener('focus', () => {
        container.classList.add('dropdown-open');
        const val = input.value.trim();
        if (val) {
            if (dropdown.innerHTML === '') fetchSuggestions(val);
        } else {
            renderDefaultView();
        }
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            container.classList.remove('dropdown-open');
        }
    });

    input.addEventListener('input', () => {
        const val = input.value.trim();
        btnClear.style.display = val ? 'block' : 'none';
        
        clearTimeout(debounceTimer);
        currentFocusIndex = -1;
        
        if (!val) {
            renderDefaultView();
            return;
        }

        dropdown.innerHTML = `<div class="search-empty"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>`;
        debounceTimer = setTimeout(() => {
            fetchSuggestions(val);
        }, 300);
    });

    input.addEventListener('keydown', (e) => {
        if (!container.classList.contains('dropdown-open')) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                container.classList.add('dropdown-open');
            }
        }

        const items = dropdown.querySelectorAll('.search-item');

        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                updateFocus(currentFocusIndex + 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                updateFocus(currentFocusIndex - 1);
                break;
            case 'Enter':
                e.preventDefault();
                if (currentFocusIndex > -1 && currentFocusIndex < suggestionsList.length) {
                    const query = suggestionsList[currentFocusIndex].text;
                    input.value = query;
                    performSearch(query);
                } else {
                    performSearch(input.value.trim());
                }
                break;
            case 'Escape':
                e.preventDefault();
                container.classList.remove('dropdown-open');
                break;
        }
    });

    btnClear.addEventListener('click', () => {
        input.value = '';
        btnClear.style.display = 'none';
        input.focus();
        renderDefaultView();
    });

    if (input.value.trim()) {
        btnClear.style.display = 'block';
    }
}
