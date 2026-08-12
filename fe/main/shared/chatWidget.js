import { getSocket } from './socketClient.js';
import { getAssetUrl } from './utils.js';

const API_URL = window.API_URL || 'http://localhost:3000';
let currentPartnerId = null;
let currentPartnerName = '';
let currentPartnerAvatar = '';
let onlineUsers = new Set();
let typingTimeout;
let editMessageId = null;
let replyMessageId = null;

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function formatDateDivider(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('vi-VN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function injectChatWidget() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../../css/chatWidget.css';
    document.head.appendChild(link);

    const container = document.createElement('div');
    container.id = 'chat-widget-container';
    container.innerHTML = `
        <style>
            #chat-widget-panel { opacity: 0; pointer-events: none; transform: translateY(20px); }
        </style>
        <div id="chat-widget-panel">
            <div class="chat-header">
                <button class="back-btn" id="chat-back-btn"><i class="fa-solid fa-arrow-left"></i></button>
                <div class="chat-title" id="chat-header-title">Tin nhắn</div>
                <button class="close-btn" id="chat-close-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div id="chat-contacts-view">
                <div class="search-container">
                    <i class="fa-solid fa-magnifying-glass search-icon"></i>
                    <input type="text" id="chat-search-input" placeholder="Tìm kiếm người dùng...">
                </div>
                <div id="contacts-list"></div>
            </div>

            <div id="chat-conversation-view">
                <div id="messages-list"></div>
                <div class="edit-mode-bar" id="edit-mode-bar" style="display:none">
                    <span><i class="fa-solid fa-pen"></i> Chỉnh sửa: <span class="reply-content-preview" id="edit-preview"></span></span>
                    <button class="edit-mode-close" onclick="cancelEdit()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="edit-mode-bar" id="reply-mode-bar" style="display:none">
                    <span><i class="fa-solid fa-reply"></i> Đang trả lời: <span class="reply-content-preview" id="reply-preview"></span></span>
                    <button class="edit-mode-close" onclick="cancelReply()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="chat-input-area">
                    <label class="upload-btn">
                        <i class="fa-solid fa-paperclip"></i>
                        <input type="file" id="chat-file-upload" accept="*/*" style="display:none">
                    </label>
                    <button class="upload-btn" id="chat-mic-btn" title="Ghi âm"><i class="fa-solid fa-microphone"></i></button>
                    <textarea id="chat-message-input" placeholder="Aa" rows="1"></textarea>
                    <button id="chat-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        </div>
        <button id="chat-widget-button">
            <i class="fa-brands fa-facebook-messenger"></i>
            <span id="chat-unread-badge" class="hidden">0</span>
        </button>
    `;
    document.body.appendChild(container);

    initChatEvents();
    loadContacts();
    setupSocket();
}

function initChatEvents() {
    const btnOpen = document.getElementById('chat-widget-button');
    const btnClose = document.getElementById('chat-close-btn');
    const btnBack = document.getElementById('chat-back-btn');
    const panel = document.getElementById('chat-widget-panel');
    const inputSearch = document.getElementById('chat-search-input');
    const btnSend = document.getElementById('chat-send-btn');
    const inputMessage = document.getElementById('chat-message-input');
    const fileUpload = document.getElementById('chat-file-upload');
    const btnMic = document.getElementById('chat-mic-btn');

    btnOpen.addEventListener('click', () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            document.body.style.overflow = 'hidden';
            loadContacts();
        } else {
            document.body.style.overflow = '';
        }
    });

    btnClose.addEventListener('click', () => {
        panel.classList.remove('open');
        document.body.style.overflow = '';
    });

    btnBack.addEventListener('click', () => {
        document.getElementById('chat-conversation-view').style.display = 'none';
        document.getElementById('chat-contacts-view').style.display = 'flex';
        document.getElementById('chat-back-btn').style.display = 'none';
        document.getElementById('chat-header-title').innerText = 'Tin nhắn';
        currentPartnerId = null;
        cancelReply();
        cancelEdit();
        loadContacts();
    });

    let searchTimeout;
    inputSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        searchTimeout = setTimeout(() => {
            if (query) searchUsers(query);
            else loadContacts();
        }, 500);
    });

    btnSend.addEventListener('click', () => {
        if (editMessageId) submitEdit();
        else sendMessage('text');
    });
    inputMessage.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (editMessageId) submitEdit();
            else sendMessage('text');
        }
    });

    inputMessage.addEventListener('input', () => {
        const socket = getSocket();
        if (socket && currentPartnerId) {
            socket.emit('typing', { receiverId: currentPartnerId });
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                socket.emit('stop_typing', { receiverId: currentPartnerId });
            }, 2000);
        }
    });

    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch(`${API_URL}/api/chat/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${getToken()}` },
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    let type = 'file';
                    if (file.type.startsWith('image/')) type = 'image';
                    else if (file.type.startsWith('audio/')) type = 'audio';
                    sendMessage(type, data.url + '|' + data.originalName);
                }
            } catch (err) {
                console.error('Lỗi upload file:', err);
            }
            e.target.value = '';
        }
    });

    let mediaRecorder;
    let audioChunks = [];
    btnMic.addEventListener('click', async () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            btnMic.classList.remove('recording');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.start();
                audioChunks = [];
                btnMic.classList.add('recording');

                mediaRecorder.addEventListener("dataavailable", event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener("stop", async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'voice.webm');

                    try {
                        const res = await fetch(`${API_URL}/api/chat/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${getToken()}` },
                            body: formData
                        });
                        const data = await res.json();
                        if (res.ok) {
                            sendMessage('audio', data.url + '|Tin nhắn thoại');
                        }
                    } catch (err) {
                        console.error('Lỗi upload audio:', err);
                    }
                    stream.getTracks().forEach(track => track.stop());
                });
            } catch (err) {
                alert('Không thể truy cập Microphone!');
            }
        }
    });
}

function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}
function getAuthHeaders() {
    return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

async function loadContacts() {
    try {
        const res = await fetch(`${API_URL}/api/chat/contacts`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok) {
            renderContacts(data.contacts);
            updateTotalUnread(data.contacts);
        }
    } catch (err) { console.error('Lỗi tải liên hệ:', err); }
}

async function searchUsers(query) {
    try {
        const res = await fetch(`${API_URL}/api/chat/search-users?q=${encodeURIComponent(query)}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok) {
            renderContacts(data.users.map(u => ({
                PartnerId: u.MaND,
                HoTen: u.HoTen,
                AvatarURL: u.AvatarURL,
                LatestMessage: 'Nhấn để bắt đầu trò chuyện',
                UnreadCount: 0
            })));
        }
    } catch (err) { console.error('Lỗi tìm kiếm user:', err); }
}

function renderContacts(contacts) {
    const list = document.getElementById('contacts-list');
    const oldScroll = list.scrollTop;
    list.innerHTML = '';

    if (!contacts || contacts.length === 0) {
        list.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #94a3b8; font-size: 13px;"><i class="fa-regular fa-comments" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;"></i><br>Không có tin nhắn nào.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    contacts.forEach(c => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        item.onclick = () => openConversation(c.PartnerId || c.MaND, c.HoTen, c.AvatarURL);

        let avatarHtml = '';
        if (c.AvatarURL) {
            avatarHtml = `<img src="${getAssetUrl(c.AvatarURL)}" class="contact-avatar" onerror="this.src='https://via.placeholder.com/44'">`;
        } else {
            const initial = c.HoTen ? c.HoTen.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
            avatarHtml = `<div class="contact-avatar-fallback">${initial}</div>`;
        }

        const isOnline = onlineUsers.has(String(c.PartnerId || c.MaND)) ? 'online' : '';
        const msgClass = (c.UnreadCount > 0) ? 'contact-msg unread' : 'contact-msg';
        const unreadDot = (c.UnreadCount > 0) ? '<div class="unread-dot"></div>' : '';
        let msgText = c.LatestMessageUnsent ? 'Tin nhắn đã bị thu hồi' : (c.LatestMessageType === 'image' ? 'Đã gửi một ảnh' : (c.LatestMessageType === 'audio' ? 'Đã gửi tin nhắn thoại' : (c.LatestMessageType === 'file' ? 'Đã gửi đính kèm' : (c.LatestMessage || ''))));
        if (c.LatestMessageSender && c.LatestMessageSender !== c.PartnerId && c.LatestMessageSender !== c.MaND) {
            msgText = 'Bạn: ' + msgText;
        }

        item.innerHTML = `
            <div class="contact-avatar-wrapper">
                ${avatarHtml}
                <div class="contact-status-dot ${isOnline}" id="contact-status-${c.PartnerId || c.MaND}"></div>
            </div>
            <div class="contact-info">
                <div class="contact-name">${c.HoTen}</div>
                <div class="${msgClass}">${msgText}</div>
            </div>
            ${unreadDot}
        `;
        fragment.appendChild(item);
    });

    list.appendChild(fragment);

    if (oldScroll > 0) {
        list.scrollTop = oldScroll;
    }
}

function updateTotalUnread(contacts) {
    let total = 0;
    contacts.forEach(c => { total += (c.UnreadCount || 0); });
    const badge = document.getElementById('chat-unread-badge');
    if (total > 0) {
        badge.textContent = total > 9 ? '9+' : total;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function openConversation(partnerId, partnerName, partnerAvatar) {
    currentPartnerId = partnerId;
    currentPartnerName = partnerName;
    currentPartnerAvatar = partnerAvatar;

    document.getElementById('chat-contacts-view').style.display = 'none';
    document.getElementById('chat-conversation-view').style.display = 'flex';
    document.getElementById('chat-back-btn').style.display = 'block';

    updateHeaderStatus();
    document.getElementById('messages-list').innerHTML = '<div style="text-align:center; padding:40px 20px; color:#94a3b8; font-size:13px;"><i class="fa-regular fa-hand-peace" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;"></i><br>Đang tải...</div>';

    try {
        const res = await fetch(`${API_URL}/api/chat/history/${partnerId}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok) {
            renderMessages(data.messages);
            scrollToBottom(false);
            setTimeout(() => scrollToBottom(false), 100);
            setTimeout(() => scrollToBottom(false), 500);
        }
    } catch (err) { console.error('Lỗi tải lịch sử chat:', err); }
}

function updateHeaderStatus() {
    if (!currentPartnerId) return;
    const isOnline = onlineUsers.has(String(currentPartnerId));
    let avatarHtml = '';
    if (currentPartnerAvatar) {
        avatarHtml = `<img src="${getAssetUrl(currentPartnerAvatar)}" onerror="this.src='https://via.placeholder.com/32'">`;
    } else {
        const initial = currentPartnerName ? currentPartnerName.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
        avatarHtml = `<div class="chat-header-fallback">${initial}</div>`;
    }

    document.getElementById('chat-header-title').innerHTML = `
        <div class="contact-avatar-wrapper">
            ${avatarHtml}
            <div class="header-status-dot ${isOnline ? 'online' : ''}" id="header-status-dot"></div>
        </div>
        <div>
            ${currentPartnerName}
            <span class="chat-subtitle" id="chat-header-subtitle">${isOnline ? 'Đang hoạt động' : ''}</span>
        </div>
    `;
}

function renderMessages(messages) {
    const list = document.getElementById('messages-list');
    list.innerHTML = '';
    const myId = parseJwt(getToken())?.MaND;

    if (!messages || messages.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px 20px; color:#94a3b8; font-size:13px;"><i class="fa-regular fa-hand-peace" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;"></i><br>Hãy gửi lời chào!</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    let lastSenderId = null;
    let wrapper = null;
    let lastMsgTime = null;

    messages.forEach((m, index) => {
        const isMe = m.NguoiGui === myId;
        const isLast = index === messages.length - 1;
        const msgTime = new Date(m.NgayGui);

        if (!lastMsgTime || (msgTime - lastMsgTime) > 60 * 60 * 1000) {
            const div = document.createElement('div');
            div.className = 'date-divider';
            div.textContent = formatDateDivider(m.NgayGui);
            fragment.appendChild(div);
            lastSenderId = null; 
        }
        lastMsgTime = msgTime;

        if (m.NguoiGui !== lastSenderId) {
            wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper';
            wrapper.style.alignItems = isMe ? 'flex-end' : 'flex-start';

            if (!isMe) {
                wrapper.classList.add('received-group');

                const nameDiv = document.createElement('div');
                nameDiv.className = 'message-sender-name';
                nameDiv.textContent = currentPartnerName;
                wrapper.appendChild(nameDiv);

                if (currentPartnerAvatar && currentPartnerAvatar !== 'null') {
                    const avatarImg = document.createElement('img');
                    avatarImg.className = 'group-avatar';
                    avatarImg.src = getAssetUrl(currentPartnerAvatar);
                    avatarImg.onerror = function() {
                        const initial = currentPartnerName ? currentPartnerName.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
                        this.outerHTML = `<div class="group-avatar chat-header-fallback" style="font-size: 12px; margin-bottom: 2px;">${initial}</div>`;
                    };
                    wrapper.appendChild(avatarImg);
                } else {
                    const initial = currentPartnerName ? currentPartnerName.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
                    const avatarDiv = document.createElement('div');
                    avatarDiv.className = 'group-avatar chat-header-fallback';
                    avatarDiv.style.fontSize = '12px';
                    avatarDiv.style.marginBottom = '2px';
                    avatarDiv.textContent = initial;
                    wrapper.appendChild(avatarDiv);
                }
            }

            fragment.appendChild(wrapper);
            lastSenderId = m.NguoiGui;
        }

        if (m.TraLoiCho_MaTN && m.ReplyToNoiDung && !m.DaThuHoi) {
            const quoteText = m.ReplyToLoaiTinNhan === 'image' ? '[Hình ảnh]' : (m.ReplyToLoaiTinNhan === 'file' ? '[Tập tin]' : (m.ReplyToLoaiTinNhan === 'audio' ? '[Ghi âm]' : m.ReplyToNoiDung));
            const quoteDiv = document.createElement('div');
            quoteDiv.className = 'reply-quote';
            quoteDiv.textContent = `Trích dẫn: ${quoteText}`;
            wrapper.appendChild(quoteDiv);
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isMe ? 'msg-sent' : 'msg-received'}`;
        msgDiv.id = `msg-${m.MaTN}`;
        msgDiv.title = formatTime(m.NgayGui); 

        let contentHtml = '';
        let linkHtml = '';
        if (m.DaThuHoi) {
            msgDiv.classList.add('msg-unsent');
            contentHtml = 'Tin nhắn đã bị thu hồi';
        } else if (m.LoaiTinNhan === 'image') {
            const url = m.NoiDung.split('|')[0];
            msgDiv.classList.add('msg-image');
            contentHtml = `<img src="${getAssetUrl(url)}" onload="window.scrollToBottom(false)" onclick="window.open('${getAssetUrl(url)}', '_blank')">`;
        } else if (m.LoaiTinNhan === 'audio') {
            const url = m.NoiDung.split('|')[0];
            msgDiv.classList.add('msg-audio');
            contentHtml = `<audio controls src="${getAssetUrl(url)}"></audio>`;
        } else if (m.LoaiTinNhan === 'file') {
            const parts = m.NoiDung.split('|');
            const url = parts[0];
            const name = parts[1] || 'File đính kèm';
            msgDiv.classList.add('msg-file');
            contentHtml = `<i class="fa-solid fa-file"></i> <span class="msg-file-name">${name}</span> <a href="${getAssetUrl(url)}" download target="_blank" style="margin-left: auto; color: inherit;"><i class="fa-solid fa-download"></i></a>`;
        } else {
            contentHtml = m.NoiDung;
            if (m.DaChinhSua) {
                contentHtml += `<span class="msg-edited-label">(Đã chỉnh sửa)</span>`;
            }

            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = m.NoiDung.match(urlRegex);
            if (urls && urls.length > 0) {
                const url = urls[0];
                linkHtml = `<div class="link-preview-container" data-url="${url}"></div>`;
                fetchPreview(url, m.MaTN);
            }
        }
        msgDiv.innerHTML = contentHtml + linkHtml;

        if (!m.DaThuHoi) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'msg-actions-wrapper';

            const safeContent = m.NoiDung.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');

            let dropdownHtml = `
                <div class="msg-dropdown" id="dropdown-${m.MaTN}">
                    <div class="emoji-picker-row">
                        <button onclick="reactMessage(${m.MaTN}, '❤️')">❤️</button>
                        <button onclick="reactMessage(${m.MaTN}, '😆')">😆</button>
                        <button onclick="reactMessage(${m.MaTN}, '😮')">😮</button>
                        <button onclick="reactMessage(${m.MaTN}, '😢')">😢</button>
                        <button onclick="reactMessage(${m.MaTN}, '😡')">😡</button>
                        <button onclick="reactMessage(${m.MaTN}, '👍')">👍</button>
                    </div>
                    <button class="dropdown-item" onclick="startReply(${m.MaTN}, '${safeContent}')"><i class="fa-solid fa-reply"></i> Trả lời</button>
                    ${m.LoaiTinNhan === 'text' ? `<button class="dropdown-item" onclick="copyMessage('${safeContent}')"><i class="fa-regular fa-copy"></i> Sao chép</button>` : ''}
            `;

            if (isMe) {
                if (m.LoaiTinNhan === 'text') {
                    dropdownHtml += `<button class="dropdown-item" onclick="startEdit(${m.MaTN}, '${safeContent}')"><i class="fa-solid fa-pen"></i> Chỉnh sửa</button>`;
                }
                dropdownHtml += `<button class="dropdown-item danger" onclick="unsendMessage(${m.MaTN})"><i class="fa-solid fa-rotate-left"></i> Thu hồi</button>`;
            }
            dropdownHtml += `</div>`;

            actionsDiv.innerHTML = `
                <button class="action-dots-btn" onclick="toggleDropdown(${m.MaTN}, event)">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                ${dropdownHtml}
            `;
            msgDiv.appendChild(actionsDiv);
        }

        if (m.Reactions && m.Reactions !== 'null') {
            try {
                const reacts = typeof m.Reactions === 'string' ? JSON.parse(m.Reactions) : m.Reactions;
                const rList = Object.values(reacts);
                if (rList.length > 0) {
                    const rDiv = document.createElement('div');
                    rDiv.className = 'msg-reactions';
                    rDiv.textContent = rList.join('');
                    msgDiv.appendChild(rDiv);
                }
            } catch(e) {}
        }

        wrapper.appendChild(msgDiv);

        if (isMe && isLast) {
            if (m.DaDoc) {
                let avatarSrc = currentPartnerAvatar ? getAssetUrl(currentPartnerAvatar) : 'https://via.placeholder.com/32';
                const receipt = document.createElement('img');
                receipt.src = avatarSrc;
                receipt.className = 'read-receipt';
                wrapper.appendChild(receipt);
            } else if (m.DaNhan) {
                const tick = document.createElement('div');
                tick.className = 'msg-status-tick delivered';
                tick.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
                wrapper.appendChild(tick);
            } else {
                const tick = document.createElement('div');
                tick.className = 'msg-status-tick sent';
                tick.innerHTML = '<i class="fa-regular fa-circle-check"></i>';
                wrapper.appendChild(tick);
            }
        }
    });

    list.appendChild(fragment);
}

async function fetchPreview(url, msgId) {
    try {
        const res = await fetch(`${API_URL}/api/chat/link-preview?url=${encodeURIComponent(url)}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok) {
            const container = document.querySelector(`#msg-${msgId} .link-preview-container`);
            if (container) {
                container.innerHTML = `
                    <a href="${data.url}" target="_blank" class="link-preview-card">
                        ${data.image ? `<img src="${data.image}">` : ''}
                        <div class="link-preview-info">
                            <div class="link-preview-title">${data.title || data.domain}</div>
                            <div class="link-preview-domain">${data.domain}</div>
                        </div>
                    </a>
                `;
            }
        }
    } catch(e) {}
}

let scrollTimeout;
function scrollToBottom(smooth = true) {
    const list = document.getElementById('messages-list');
    if (!list) return;

    if (!smooth) {
        list.scrollTo({ top: list.scrollHeight, behavior: 'auto' });
        return;
    }

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        list.scrollTo({
            top: list.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}
window.scrollToBottom = scrollToBottom;

async function sendMessage(type = 'text', content = null) {
    const input = document.getElementById('chat-message-input');
    const text = content || input.value.trim();
    if (!text || !currentPartnerId) return;

    const socket = getSocket();
    if (socket) {
        socket.emit('send_message', { receiverId: currentPartnerId, text: text, type: type, replyToId: replyMessageId });
        if (type === 'text') input.value = '';
        cancelReply();
    }
}

async function unsendMessage(msgId) {
    try {
        const res = await fetch(`${API_URL}/api/chat/unsend/${msgId}`, { method: 'PUT', headers: getAuthHeaders() });
        if (res.ok) {
            const socket = getSocket();
            if (socket) socket.emit('message_unsent', { messageId: msgId, receiverId: currentPartnerId });
            loadContacts();
            openConversation(currentPartnerId, currentPartnerName, currentPartnerAvatar);
        }
    } catch (err) {}
}

window.startEdit = function(msgId, oldText) {
    editMessageId = msgId;
    document.getElementById('edit-mode-bar').style.display = 'flex';
    const input = document.getElementById('chat-message-input');
    input.value = oldText.replace(/\\n/g, '\n');
    document.getElementById('edit-preview').textContent = oldText.replace(/\\n/g, ' ');
    input.focus();
};

window.cancelEdit = function() {
    editMessageId = null;
    document.getElementById('edit-mode-bar').style.display = 'none';
    document.getElementById('chat-message-input').value = '';
};

window.startReply = function(msgId, originalText) {
    replyMessageId = msgId;
    document.getElementById('reply-mode-bar').style.display = 'flex';
    document.getElementById('reply-preview').textContent = originalText.replace(/\\n/g, ' ');
    document.getElementById('chat-message-input').focus();
};

window.cancelReply = function() {
    replyMessageId = null;
    document.getElementById('reply-mode-bar').style.display = 'none';
};

async function submitEdit() {
    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();
    if (!text || !editMessageId) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/edit/${editMessageId}`, { 
            method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ text })
        });
        if (res.ok) {
            const socket = getSocket();
            if (socket) socket.emit('message_edited', { messageId: editMessageId, receiverId: currentPartnerId });
            cancelEdit();
            openConversation(currentPartnerId, currentPartnerName, currentPartnerAvatar);
        }
    } catch (err) {}
}

window.copyMessage = function(text) {
    navigator.clipboard.writeText(text.replace(/\\n/g, '\n'));
    alert('Đã sao chép tin nhắn!');
};

window.toggleDropdown = function(msgId, e) {
    e.stopPropagation();
    document.querySelectorAll('.msg-dropdown').forEach(el => {
        el.classList.remove('show');
        if (el.parentElement) el.parentElement.classList.remove('active');
    });
    const dd = document.getElementById(`dropdown-${msgId}`);
    if (dd) {
        dd.classList.toggle('show');
        if (dd.classList.contains('show') && dd.parentElement) {
            dd.parentElement.classList.add('active');
        }
    }
};

document.addEventListener('click', () => {
    document.querySelectorAll('.msg-dropdown').forEach(el => {
        el.classList.remove('show');
        if (el.parentElement) el.parentElement.classList.remove('active');
    });
});

async function reactMessage(msgId, reaction) {
    try {
        const res = await fetch(`${API_URL}/api/chat/react/${msgId}`, { 
            method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ reaction })
        });
        if (res.ok) {
            const data = await res.json();
            const socket = getSocket();
            if (socket) socket.emit('message_reacted', { messageId: msgId, receiverId: currentPartnerId, reactions: data.reactions });
            openConversation(currentPartnerId, currentPartnerName, currentPartnerAvatar);
        }
    } catch (err) {}
}

function setupSocket() {
    const socket = getSocket();
    if (!socket) return;

    socket.on('initial_status', (users) => {
        onlineUsers = new Set(users);
        loadContacts();
        updateHeaderStatus();
    });

    socket.on('user_status_change', ({ userId, status }) => {
        if (status === 'online') onlineUsers.add(String(userId));
        else onlineUsers.delete(String(userId));

        const dot = document.getElementById(`contact-status-${userId}`);
        if (dot) dot.className = `contact-status-dot ${status === 'online' ? 'online' : ''}`;

        if (currentPartnerId == userId) {
            updateHeaderStatus();
        }
    });

    socket.on('receive_message', (msg) => {
        try {
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.play();
        } catch(e) {}

        if (currentPartnerId == msg.NguoiGui) {
            appendMessage(msg, false);
            fetch(`${API_URL}/api/chat/read/${msg.NguoiGui}`, { method: 'PUT', headers: getAuthHeaders() });
        } else {
            loadContacts();
        }
    });

    socket.on('message_sent', (msg) => {
        if (currentPartnerId == msg.NguoiNhan) {
            appendMessage(msg, true);
        }
    });

    socket.on('message_unsent', () => {
        if (currentPartnerId) openConversation(currentPartnerId, currentPartnerName, currentPartnerAvatar);
    });

    socket.on('message_edited', () => {
        if (currentPartnerId) openConversation(currentPartnerId, currentPartnerName, currentPartnerAvatar);
    });

    socket.on('message_reacted', () => {
        if (currentPartnerId) openConversation(currentPartnerId, currentPartnerName, currentPartnerAvatar);
    });

    socket.on('message_delivered', ({ messageId }) => {
        if (currentPartnerId) openConversation(currentPartnerId, currentPartnerName, currentPartnerAvatar);
    });

    socket.on('typing', ({ senderId }) => {
        if (currentPartnerId == senderId) {
            showTypingIndicator();
        }
    });

    socket.on('stop_typing', ({ senderId }) => {
        if (currentPartnerId == senderId) {
            removeTypingIndicator();
        }
    });
}

function appendMessage(msg, isMe) {
    removeTypingIndicator();
    const list = document.getElementById('messages-list');
    const emptyMsg = list.querySelector('div[style*="text-align:center"]');
    if (emptyMsg) emptyMsg.remove();

    let wrapper = list.lastElementChild;
    if (!wrapper || wrapper.style.alignItems !== (isMe ? 'flex-end' : 'flex-start') || wrapper.className !== 'message-wrapper' || wrapper.classList.contains('received-group') !== !isMe) {
        wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        wrapper.style.alignItems = isMe ? 'flex-end' : 'flex-start';

        if (!isMe) {
            wrapper.classList.add('received-group');

            const nameDiv = document.createElement('div');
            nameDiv.className = 'message-sender-name';
            nameDiv.textContent = currentPartnerName;
            wrapper.appendChild(nameDiv);

            if (currentPartnerAvatar && currentPartnerAvatar !== 'null') {
                const avatarImg = document.createElement('img');
                avatarImg.className = 'group-avatar';
                avatarImg.src = getAssetUrl(currentPartnerAvatar);
                avatarImg.onerror = function() {
                    const initial = currentPartnerName ? currentPartnerName.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
                    this.outerHTML = `<div class="group-avatar chat-header-fallback" style="font-size: 12px; margin-bottom: 2px;">${initial}</div>`;
                };
                wrapper.appendChild(avatarImg);
            } else {
                const initial = currentPartnerName ? currentPartnerName.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'group-avatar chat-header-fallback';
                avatarDiv.style.fontSize = '12px';
                avatarDiv.style.marginBottom = '2px';
                avatarDiv.textContent = initial;
                wrapper.appendChild(avatarDiv);
            }
        }

        list.appendChild(wrapper);
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMe ? 'msg-sent' : 'msg-received'}`;
    msgDiv.id = `msg-${msg.MaTN}`;
    msgDiv.title = formatTime(msg.NgayGui || new Date().toISOString());
    if (msg.LoaiTinNhan === 'image') {
        msgDiv.classList.add('msg-image');
        msgDiv.innerHTML = `<img src="${getAssetUrl(msg.NoiDung)}" onload="window.scrollToBottom(true)">`;
    } else {
        msgDiv.textContent = msg.NoiDung;
    }

    wrapper.appendChild(msgDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    removeTypingIndicator();
    const list = document.getElementById('messages-list');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    list.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function parseJwt(token) {
    try { return JSON.parse(atob(token.split('.')[1])); }
    catch (e) { return null; }
}

window.reactMessage = reactMessage;
window.unsendMessage = unsendMessage;
window.cancelEdit = cancelEdit;
window.startReply = window.startReply;
window.cancelReply = window.cancelReply;
window.addEventListener('DOMContentLoaded', injectChatWidget);
