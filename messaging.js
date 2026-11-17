let messagingEpoch = 0;
let messagingTimer;
const messagingApp = document.querySelector('#app');
window.addEventListener('hashchange', () => { messagingEpoch += 1; clearInterval(messagingTimer); });
const messageEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
async function messagingApi(path, options = {}) {
  let response;
  try { response = await fetch(`/api/messaging/${path}`, { credentials: 'same-origin', ...options }); }
  catch { throw new Error('Could not connect. Your draft is still here; try again.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('Start the Node server with npm start to use messages.'); }
  if (!response.ok) { const error = new Error(result.issues?.map(issue => issue.message).join(' ') || result.message || 'The request could not be completed.'); error.status = response.status; error.code = result.code; throw error; }
  return result;
}
async function renderMessaging() {
  clearInterval(messagingTimer);
  const epoch = ++messagingEpoch;
  const current = () => epoch === messagingEpoch && location.hash === '#/messages';
  messagingApp.innerHTML = '<main id="main-content" class="messaging-loading" role="status">Loading messages…</main>';
  let user;
  try { ({ user } = await messagingApi('me')); }
  catch (error) {
    if (!current()) return;
    messagingApp.innerHTML = `<main id="main-content" class="msg-entry"><p class="eyebrow">CAMPUS RESEARCH</p><h1>Messages</h1><p>Connect students and professors around research opportunities.</p>
      <a class="msg-applicants" href="/applicants.html">Professor applicant review demo</a>
      <p class="msg-demo">Local development demo. Choose a synthetic sample account; production authentication is not configured.</p>
      <button data-message-role="STUDENT">Continue as sample student</button><button data-message-role="PROFESSOR">Continue as sample professor</button>
      <p id="msg-entry-status" role="status">${error.status === 401 ? '' : messageEscape(error.message)}</p></main>`;
    document.querySelectorAll('[data-message-role]').forEach(button => { button.onclick = async () => {
      document.querySelectorAll('[data-message-role]').forEach(v => { v.disabled = true; });
      try { await messagingApi('dev-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: button.dataset.messageRole }) }); if (current()) void renderMessaging(); }
      catch (failure) { if (current()) { document.querySelector('#msg-entry-status').textContent = failure.message; document.querySelectorAll('[data-message-role]').forEach(v => { v.disabled = false; }); } }
    }; });
    return;
  }
  if (!current()) return;
  const api = (path, options = {}) => messagingApi(path, { ...options, headers: { 'X-Messaging-Actor': user.id, ...options.headers } });
  const state = { tab: 'inbox', query: '', conversations: [], people: [], selected: null, messages: [], inboxMore: false, peopleMore: false, older: false, drafts: new Map(), pending: new Map(), sending: new Set(), listSerial: 0, chatSerial: 0, chatLoading: false, polling: false };
  const noun = user.role === 'STUDENT' ? 'Professors' : 'Students';
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  messagingApp.innerHTML = `<div class="messages-app"><header class="msg-header"><div><h1>Messages</h1><a href="#/messages" id="msg-back">Back</a></div><p>Connect with research ${noun.toLowerCase()}</p><a class="msg-applicants" href="/applicants.html">Professor applicant review demo</a></header>
    <main id="main-content" class="msg-main"><form class="msg-search" role="search"><span class="msg-search-icon" aria-hidden="true"><img src="assets/messaging/f783a.svg" alt=""><img src="assets/messaging/850ca.svg" alt=""></span><label class="visually-hidden" for="msg-query">Search ${noun.toLowerCase()} or research topics</label><input id="msg-query" maxlength="100" type="search" placeholder="Search ${noun.toLowerCase()} or research topics" autocomplete="off"></form>
    <nav class="msg-tabs" aria-label="Message views"><button id="msg-inbox-tab" aria-pressed="true">Inbox</button><button id="msg-people-tab" aria-pressed="false">Find ${noun}</button></nav>
    <div class="msg-list-heading"><h2 id="msg-list-title">Conversations</h2><span id="msg-list-count"></span></div><div id="msg-list" aria-labelledby="msg-list-title"></div>
    <button class="msg-new" id="msg-new">+ Find a ${user.role === 'STUDENT' ? 'Professor' : 'Student'} / New Message</button>
    <p id="msg-status" class="msg-status" role="status" aria-live="polite"></p><section id="msg-chat" aria-labelledby="msg-chat-title"><h2 id="msg-chat-title">Current Chat</h2><p class="msg-empty">Select a conversation or find someone to start a message.</p></section>
    <footer class="msg-footer"><span>${messageEscape(user.name)} · ${user.role === 'STUDENT' ? 'Student' : 'Professor'} · Local demo</span><button id="msg-switch">Switch demo account / Log out</button></footer></main></div>`;
  function status(text, error = false) {
    if (!current()) return;
    const node = document.querySelector('#msg-status'); node.textContent = text; node.classList.toggle('is-error', error);
  }
  function fail(error) { if (!current()) return; if (error.status === 401 || error.code === 'SESSION_CHANGED') { clearInterval(messagingTimer); void renderMessaging(); } else status(error.message, true); }
  function listMarkup() {
    if (!current()) return;
    const people = state.tab === 'people';
    document.querySelector('#msg-inbox-tab').setAttribute('aria-pressed', String(!people));
    document.querySelector('#msg-people-tab').setAttribute('aria-pressed', String(people));
    document.querySelector('#msg-list-title').textContent = people ? `Find ${noun}` : 'Conversations';
    const rows = people ? state.people : state.conversations.filter(v => `${v.peer.name} ${v.peer.subtitle} ${v.lastMessage?.body || ''}`.toLowerCase().includes(state.query.toLowerCase()));
    document.querySelector('#msg-list-count').textContent = `${rows.length}${(people ? state.peopleMore : state.inboxMore) ? '+' : ''} ${people ? 'people' : 'chats'}`;
    document.querySelector('#msg-list').innerHTML = rows.length ? `<ul class="msg-rows">${rows.map((row, n) => {
      const person = people ? row : row.peer;
      return `<li><button class="msg-person ${state.selected?.id === row.id && !people ? 'is-selected' : ''}" data-message-row="${messageEscape(row.id)}"${!people && state.selected?.id === row.id ? ' aria-current="true"' : ''}><span class="msg-avatar ${n % 2 ? 'is-purple' : ''}" aria-hidden="true">${messageEscape(initials(person.name))}</span><span class="msg-person-copy"><strong>${messageEscape(person.name)}</strong><span>${messageEscape(person.subtitle || person.topics || '')}</span><small>${messageEscape(people ? (person.topics || 'Start a research conversation') : (row.lastMessage?.body || 'No messages yet. Say hello.'))}</small></span></button></li>`;
    }).join('')}</ul>` : `<p class="msg-empty">${state.query ? 'No matches. Try a different name or research topic.' : people ? `No ${noun.toLowerCase()} are available yet.` : 'No conversations yet. Find someone to say hello.'}</p>`;
    if (people ? state.peopleMore : state.inboxMore) document.querySelector('#msg-list').insertAdjacentHTML('beforeend', '<button class="msg-load" id="msg-list-more">Load more</button>');
    document.querySelectorAll('[data-message-row]').forEach(button => { button.onclick = () => { if (people) void start(button.dataset.messageRow); else void select(button.dataset.messageRow, true); }; });
    const more = document.querySelector('#msg-list-more'); if (more) more.onclick = () => void loadList(true);
  }
  async function loadList(append = false, refresh = false) {
    const serial = ++state.listSerial;
    const tab = state.tab;
    try {
      let result = await api(tab === 'people' ? `people?q=${encodeURIComponent(state.query)}&offset=${append ? state.people.length : 0}` : `conversations?offset=${append ? state.conversations.length : 0}`);
      if (refresh && tab === 'inbox') {
        const desired = state.conversations.length;
        const all = [...result.conversations]; let more = result.hasMore;
        while (all.length < desired && more && current() && serial === state.listSerial) {
          const next = await api(`conversations?offset=${all.length}`);
          all.push(...next.conversations); more = next.hasMore;
        }
        result = { conversations: all, hasMore: more };
      }
      if (!current() || serial !== state.listSerial) return;
      if (tab === 'people') { state.people = append ? [...state.people, ...result.people] : result.people; state.peopleMore = result.hasMore; }
      else { state.conversations = append ? [...state.conversations, ...result.conversations] : result.conversations; state.inboxMore = result.hasMore; }
      listMarkup();
    } catch (error) { fail(error); }
  }
  async function start(personId) {
    const serial = ++state.chatSerial;
    state.chatLoading = true; composerState();
    status('Opening conversation…');
    try {
      const { conversation } = await api('conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otherUserId: personId }) });
      if (!current() || serial !== state.chatSerial) return;
      state.tab = 'inbox'; state.query = ''; document.querySelector('#msg-query').value = ''; await loadList(); if (!current() || serial !== state.chatSerial) return; await select(conversation.id, true); status('');
    } catch (error) { if (serial === state.chatSerial) { state.chatLoading = false; composerState(); fail(error); } }
  }
  function renderChat() {
    if (!current() || !state.selected) return;
    const peer = state.selected.peer;
    document.querySelector('#msg-chat').innerHTML = `<h2 id="msg-chat-title">Current Chat</h2><div class="msg-chat-card"><header class="msg-chat-header"><span class="msg-avatar" aria-hidden="true">${messageEscape(initials(peer.name))}</span><div><h3>${messageEscape(peer.name)}</h3><p>${messageEscape(peer.subtitle || '')}</p></div></header><button class="msg-load" id="msg-older"${state.older ? '' : ' hidden'}>Load older messages</button><div class="msg-history" id="msg-history" role="log" aria-label="Conversation history" aria-live="polite" aria-relevant="additions"></div><form class="msg-composer" id="msg-composer"><label class="visually-hidden" for="msg-body">Message ${messageEscape(peer.name)}</label><textarea id="msg-body" maxlength="5000" rows="2" placeholder="Type your message…" required></textarea><button type="submit" id="msg-send">Send</button><small><span id="msg-char-count">0</span>/5000 · Ctrl/⌘ + Enter to send</small></form></div>`;
    const input = document.querySelector('#msg-body'); input.value = state.drafts.get(state.selected.id) || '';
    input.oninput = () => { state.drafts.set(state.selected.id, input.value); composerState(); };
    input.onkeydown = event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); document.querySelector('#msg-composer').requestSubmit(); } };
    document.querySelector('#msg-composer').onsubmit = event => { event.preventDefault(); void send(); };
    document.querySelector('#msg-older').onclick = () => void older();
    feed(true); composerState();
  }
  function composerState() {
    if (!current() || !state.selected || !document.querySelector('#msg-body')) return;
    const input = document.querySelector('#msg-body');
    const busy = state.sending.has(state.selected.id) || state.chatLoading;
    input.disabled = busy;
    document.querySelector('#msg-send').disabled = busy || !input.value.trim();
    document.querySelector('#msg-send').textContent = state.chatLoading ? 'Loading…' : busy ? 'Sending…' : state.pending.has(state.selected.id) ? 'Retry' : 'Send';
    document.querySelector('#msg-char-count').textContent = String(input.value.length);
  }
  function mergeMessages(rows) {
    const all = new Map(state.messages.map(message => [message.id, message])); rows.forEach(row => all.set(row.id, row));
    state.messages = [...all.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id));
    const pending = state.pending.get(state.selected.id);
    if (pending && rows.some(row => row.senderId === user.id && row.clientMessageId === pending.id)) {
      if ((state.drafts.get(state.selected.id) || '').trim() === pending.body) { state.drafts.delete(state.selected.id); const input = document.querySelector('#msg-body'); if (input) input.value = ''; }
      state.pending.delete(state.selected.id); status('Message sent.');
    }
  }
  function feed(bottom = false, prepend = false) {
    if (!current()) return;
    const node = document.querySelector('#msg-history'); if (!node) return;
    const previousHeight = node.scrollHeight, previousTop = node.scrollTop;
    const nearBottom = previousHeight - previousTop - node.clientHeight < 70;
    node.querySelector('.msg-history-empty')?.remove();
    const known = new Set([...node.children].map(child => child.dataset.messageId));
    const order = new Map(state.messages.map((row, index) => [row.id, index]));
    for (const row of state.messages) {
      if (known.has(row.id)) continue;
      const element = document.createElement('article'); element.className = `msg-bubble ${row.senderId === user.id ? 'is-mine' : ''}`; element.dataset.messageId = row.id;
      const body = document.createElement('p'); body.textContent = row.body;
      const time = document.createElement('time'); time.dateTime = row.sentAt; time.textContent = `${row.senderId === user.id ? 'You' : state.selected.peer.name} · ${new Date(row.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
      element.append(body, time);
      const next = [...node.children].find(child => order.get(child.dataset.messageId) > order.get(row.id));
      node.insertBefore(element, next || null); known.add(row.id);
    }
    if (!state.messages.length) node.innerHTML = '<p class="msg-empty msg-history-empty">No messages yet. Introduce yourself and your research interests.</p>';
    document.querySelector('#msg-older').hidden = !state.older;
    if (prepend) node.scrollTop = previousTop + node.scrollHeight - previousHeight;
    else if (bottom || nearBottom) node.scrollTop = node.scrollHeight;
  }
  async function select(conversationId, focus = false) {
    const serial = ++state.chatSerial;
    state.chatLoading = true; composerState();
    document.querySelector('#msg-chat').setAttribute('aria-busy', 'true');
    status('Loading conversation…');
    try {
      const result = await api(`conversations/${conversationId}/messages`);
      if (!current() || serial !== state.chatSerial) return;
      state.selected = result.conversation; state.messages = result.messages; state.older = result.hasMore; state.chatLoading = false; document.querySelector('#msg-chat').setAttribute('aria-busy', 'false'); renderChat(); listMarkup(); status(''); if (focus) document.querySelector('#msg-body').focus();
    } catch (error) { if (serial === state.chatSerial) { state.chatLoading = false; if (current()) document.querySelector('#msg-chat')?.setAttribute('aria-busy', 'false'); composerState(); fail(error); } }
  }
  async function older() {
    if (!state.selected || !state.messages.length) return;
    const selectedId = state.selected.id, serial = state.chatSerial;
    const button = document.querySelector('#msg-older'); button.disabled = true;
    try {
      const result = await api(`conversations/${selectedId}/messages?before=${state.messages[0].id}`);
      if (!current() || serial !== state.chatSerial) return;
      mergeMessages(result.messages); state.older = result.hasMore; feed(false, true);
    } catch (error) { fail(error); }
    finally { if (current() && serial === state.chatSerial) button.disabled = false; }
  }
  async function send() {
    if (!state.selected || state.chatLoading) return;
    const selectedId = state.selected.id;
    const body = (state.drafts.get(selectedId) || '').trim();
    if (!body || state.sending.has(selectedId)) return;
    if (body.length > 5000) { status('Messages can contain up to 5,000 characters.', true); return; }
    let pending = state.pending.get(selectedId);
    if (!pending || pending.body !== body) { pending = { id: crypto.randomUUID(), body }; state.pending.set(selectedId, pending); }
    state.sending.add(selectedId); composerState(); status('Sending…');
    try {
      const { message } = await api(`conversations/${selectedId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, clientMessageId: pending.id }) });
      if (!current()) return;
      state.pending.delete(selectedId); state.drafts.delete(selectedId);
      if (state.selected?.id === selectedId) { document.querySelector('#msg-body').value = ''; mergeMessages([message]); feed(true); }
      if (state.tab === 'inbox') await loadList(false, true); status('Message sent.');
    } catch (error) { fail(error); }
    finally { state.sending.delete(selectedId); if (current()) composerState(); }
  }
  let searchTimer;
  document.querySelector('.msg-search').onsubmit = event => { event.preventDefault(); clearTimeout(searchTimer); if (state.tab === 'people') void loadList(); else listMarkup(); };
  document.querySelector('#msg-query').oninput = event => {
    state.query = event.target.value.trim(); state.listSerial += 1;
    clearTimeout(searchTimer);
    if (state.tab === 'people') {
      state.people = []; state.peopleMore = false; document.querySelector('#msg-list-count').textContent = '';
      document.querySelector('#msg-list').innerHTML = '<p class="msg-empty" role="status">Searching…</p>';
      searchTimer = setTimeout(() => { if (current()) void loadList(); }, 250);
    } else listMarkup();
  };
  function tab(value) { clearTimeout(searchTimer); state.tab = value; state.listSerial += 1; listMarkup(); void loadList(); }
  document.querySelector('#msg-back').onclick = event => { event.preventDefault(); tab('inbox'); document.querySelector('#msg-list-title').scrollIntoView({ behavior: 'smooth' }); };
  document.querySelector('#msg-inbox-tab').onclick = () => tab('inbox');
  document.querySelector('#msg-people-tab').onclick = () => tab('people');
  document.querySelector('#msg-new').onclick = () => { tab('people'); document.querySelector('#msg-query').focus(); };
  document.querySelector('#msg-switch').onclick = async () => { try { await api('logout', { method: 'POST' }); if (current()) void renderMessaging(); } catch (error) { fail(error); } };
  await loadList();
  if (!current()) return;
  if (state.conversations.length) await select(state.conversations[0].id);
  if (!current()) return;
  messagingTimer = setInterval(async () => {
    if (!current() || document.hidden || state.polling) return;
    state.polling = true;
    const selectedId = state.selected?.id, serial = state.chatSerial;
    try {
      if (state.tab === 'inbox') await loadList(false, true);
      if (selectedId && serial === state.chatSerial && !state.sending.has(selectedId)) {
        let after = state.messages.at(-1)?.id, more = false;
        for (let page = 0; page < 10; page += 1) {
          const result = await api(`conversations/${selectedId}/messages${after ? `?after=${after}` : ''}`);
          if (!current() || serial !== state.chatSerial) break;
          if (!after && result.hasMore) state.older = true;
          mergeMessages(result.messages); more = result.hasMore; after = result.messages.at(-1)?.id;
          if (!more || !after) break;
        }
        if (current() && serial === state.chatSerial) { feed(); composerState(); }
        if (current() && serial === state.chatSerial && !more) {
          const tail = await api(`conversations/${selectedId}/messages`);
          if (current() && serial === state.chatSerial) { mergeMessages(tail.messages); feed(); composerState(); }
        }
      }
    } catch (error) { fail(error); }
    finally { state.polling = false; }
  }, 4000);
}

function renderMessagingRoute() {
  if (!messagingApp) return;
  if (location.hash !== '#/messages') {
    location.replace('#/messages');
    return;
  }
  void renderMessaging();
}

window.addEventListener('hashchange', renderMessagingRoute);
renderMessagingRoute();
