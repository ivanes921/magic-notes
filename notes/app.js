// /notes/app.js
(function(){
  const db = window.firebaseDb;

  const qs = new URLSearchParams(location.search);
  const noteEl = document.getElementById('note');
  const connectUI = document.getElementById('connectUI');
  const menuBtn = document.querySelector('[data-role="menu"]');
  const quickMenuToggle = document.querySelector('[data-role="quick-menu-toggle"]');
  const quickMenu = document.getElementById('quickMenu');
  const quickMenuBackdrop = document.getElementById('quickMenuBackdrop');
  const sheetEl = document.querySelector('.sheet');
  const cameraTool = document.querySelector('.tool[aria-label="Камера"]');
  const cameraInput = document.getElementById('cameraInput');
  const shareBtn = document.querySelector('[data-role="share"]');
  const doneBtn = document.querySelector('[data-role="done"]');
  const cancelBtn = document.querySelector('[data-role="cancel"]');
  const statusBarMeta = document.getElementById('status-bar-style');
  const currentRoomEl = document.getElementById('connectionStatus');

  const autobar = document.getElementById('autobar');
  const leftWordEl = document.getElementById('leftWord');
  const centerWordEl = document.getElementById('centerWord');
  const rightWordEl = document.getElementById('rightWord');

  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const TEXT_BLOCK_SELECTOR = '.title, .body';
  const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

  let roomId = null;
  let roomRef = null;
  let spectatorRef = null;
  let spectatorTextHandler = null;
  let autofillHandler = null;
  let searchHandler = null;

  let autofillActive = false;
  let targetWord = '';
  let prefixLen = 3;

  let applyingRemote = false;
  let cancelEverShown = false;
  let initialAutoJoinResolved = false;
  let lastSearchTrigger = 0;

  const LAST_SEARCH_STORAGE_KEY_PREFIX = 'magicNotes:lastSearch:';

  function getSearchStorageKey(room){
    return `${LAST_SEARCH_STORAGE_KEY_PREFIX}${room || ''}`;
  }

  function loadLastSearchTrigger(room){
    if (!room) return 0;
    try {
      const raw = localStorage.getItem(getSearchStorageKey(room));
      return raw ? Number(raw) || 0 : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveLastSearchTrigger(room, value){
    if (!room) return;
    try {
      localStorage.setItem(getSearchStorageKey(room), String(value || 0));
    } catch (err) {
      // ignore storage errors
    }
  }

  const AUTOFILL_DICTIONARY = [
    'автомат', 'автор', 'авторитет', 'авторы', 'акция', 'алгоритм', 'анализ', 'ангел', 'апрель', 'аромат',
    'база', 'баланс', 'банкир', 'батарея', 'бизнес', 'богатство', 'бонус', 'борода', 'браслет', 'бренд',
    'вдохновение', 'вежливость', 'вектор', 'велосипед', 'весна', 'взгляд', 'вкусный', 'внимание', 'внутренний', 'возможность',
    'встреча', 'выбор', 'выгода', 'выступление', 'выход',
    'гармония', 'гарантия', 'герой', 'глобальный', 'глубина', 'город', 'граница', 'гранит', 'график', 'группа',
    'движение', 'двойник', 'двора', 'дворец', 'девушка', 'доверие', 'документ', 'долина', 'должен', 'домашний',
    'достаточно', 'доступ', 'друг', 'дружелюбие', 'дымка',
    'ежедневник', 'ежик', 'единство', 'ежемесячно', 'ежегодно',
    'желание', 'женщина', 'живописный', 'жизнь', 'журнал',
    'забота', 'задача', 'заклинание', 'замок', 'запись', 'заря', 'звонок', 'зеркало', 'зима', 'знание',
    'игра', 'идея', 'издание', 'изюминка', 'изящный', 'иллюзия', 'император', 'имя', 'инициатива', 'инструмент',
    'информация', 'искра', 'искусство', 'истина', 'источник',
    'кабинет', 'кадр', 'камень', 'карета', 'картина', 'карточка', 'качество', 'кейс', 'клиент', 'клуб',
    'коллекция', 'команда', 'компас', 'конспект', 'контакт', 'контроль', 'конфета', 'коридор', 'космос', 'кристалл',
    'круг', 'купол', 'курс',
    'лаборатория', 'легенда', 'лидер', 'личность', 'логика', 'локон', 'лунный', 'лучший',
    'магия', 'май', 'мастер', 'маяк', 'мелодия', 'мечта', 'милый', 'минутка', 'модель', 'момент',
    'море', 'мудрость', 'музыка', 'мурашки',
    'награда', 'надежда', 'напиток', 'настройка', 'начало', 'нежность', 'незабудка', 'некоторый', 'нектар', 'нескучный',
    'новость', 'ночь', 'нравится',
    'обаяние', 'облако', 'образ', 'образец', 'объект', 'огни', 'ограда', 'огромный', 'одежда', 'озеро',
    'океан', 'оливка', 'описание', 'оптимизм', 'опыт', 'орбита', 'орнамент', 'осень', 'ощущение',
    'павлин', 'павильон', 'пакет', 'пальто', 'панорама', 'парк', 'партнер', 'песни', 'письмо', 'планета',
    'победа', 'подарок', 'поддержка', 'подробность', 'поезд', 'пойдем', 'поиск', 'пойман', 'позиция', 'показать',
    'поколение', 'покупка', 'поле', 'помощник', 'порядок', 'послание', 'поток', 'поэзия', 'правда', 'праздник',
    'предел', 'предмет', 'представление', 'прежний', 'прекрасный', 'пример', 'приоритет', 'приход', 'привет', 'приветик',
    'привычка', 'призрак', 'приключение', 'приложение', 'принцесса', 'природа', 'приходите', 'прицел', 'причина', 'пришел',
    'проектор', 'программа', 'продолжение', 'проект', 'профиль', 'прочитать', 'путешествие',
    'радость', 'район', 'ракурс', 'рассвет', 'рассказ', 'раунд', 'реальность', 'революция', 'результат', 'рекомендация',
    'ритм', 'ровный', 'романтика', 'роспись', 'рукопись', 'ручей',
    'сад', 'самоцвет', 'свет', 'свеча', 'секрет', 'семейный', 'сентябрь', 'сердце', 'сигнал', 'сила',
    'сказка', 'скрипка', 'след', 'слово', 'случай', 'смысл', 'событие', 'совет', 'создание', 'созвездие',
    'соната', 'сонет', 'соревнование', 'спектакль', 'спокойствие', 'спорт', 'способность', 'справедливость', 'среда', 'стиль',
    'страница', 'строка', 'структура', 'студия', 'счастье', 'символ',
    'талант', 'танец', 'творчество', 'текст', 'тембр', 'терраса', 'технология', 'тишина', 'традиция', 'тренировка',
    'тропинка', 'турнир',
    'уверенность', 'угол', 'узор', 'улыбка', 'умение', 'университет', 'уровень', 'успех', 'утро',
    'фантазия', 'февраль', 'фестиваль', 'философия', 'форма', 'фортепиано', 'фотография', 'фраза', 'фреска',
    'хитрость', 'хобби', 'хрусталь', 'художник',
    'цветок', 'цель', 'церемония', 'центр', 'цепочка',
    'чарующий', 'частица', 'чернила', 'чудо', 'чувство',
    'шанс', 'шарм', 'школа', 'шляпа', 'шоу',
    'щедрость',
    'экзамен', 'эксперт', 'экспозиция', 'эксперимент',
    'юмор', 'юность',
    'яркость', 'январь', 'язык', 'ясность'
  ];

  const isSpectator = (qs.get('mode') || '').toLowerCase() === 'spectator';

  function hasQuickMenuElements(){
    return Boolean(quickMenu && quickMenuBackdrop && quickMenuToggle);
  }

  function isQuickMenuVisible(){
    return hasQuickMenuElements() && !quickMenu.classList.contains('hidden');
  }

  function setQuickMenuVisibility(visible, options){
    if (!hasQuickMenuElements()) return;
    const restoreFocus = options && options.restoreFocus;
    quickMenu.classList.toggle('hidden', !visible);
    quickMenuBackdrop.classList.toggle('hidden', !visible);
    quickMenuToggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
    if (!visible && restoreFocus && typeof quickMenuToggle.focus === 'function'){
      try {
        quickMenuToggle.focus({ preventScroll: true });
      } catch (err) {
        quickMenuToggle.focus();
      }
    }
  }

  function showQuickMenu(){
    setQuickMenuVisibility(true);
  }

  function hideQuickMenu(options){
    setQuickMenuVisibility(false, options);
  }

  function toggleQuickMenu(){
    if (!hasQuickMenuElements()) return;
    const willShow = quickMenu.classList.contains('hidden');
    setQuickMenuVisibility(willShow);
  }

  function applyStatusBarStyle(){
    if (!statusBarMeta) return;
    statusBarMeta.setAttribute('content', darkScheme.matches ? 'black-translucent' : 'default');
  }

  applyStatusBarStyle();
  if (typeof darkScheme.addEventListener === 'function'){
    darkScheme.addEventListener('change', applyStatusBarStyle);
  } else if (typeof darkScheme.addListener === 'function'){
    darkScheme.addListener(applyStatusBarStyle);
  }
  window.addEventListener('pageshow', applyStatusBarStyle);
  document.addEventListener('visibilitychange', applyStatusBarStyle);

  function createBlock(type){
    const block = document.createElement('div');
    block.classList.add(type);
    return block;
  }

  function ensureBlocks(){
    if (!noteEl) return;
    const children = Array.from(noteEl.children);
    if (!children.length){
      noteEl.appendChild(createBlock('title'));
    }

    let textIndex = 0;
    Array.from(noteEl.children).forEach(child => {
      if (child.classList.contains('photo-block')){
        return;
      }

      const desired = textIndex === 0 ? 'title' : 'body';
      textIndex += 1;

      child.classList.remove('title', 'body');
      child.classList.add(desired);

      if (child.innerHTML === '<br>' || child.innerHTML === '<br />'){
        child.innerHTML = '';
      }
    });

    if (!textIndex){
      noteEl.appendChild(createBlock('title'));
    }
  }

  function placeCaretInside(element){
    if (!element) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function focusEnd(){
    ensureBlocks();
    if (!noteEl) return;
    const textBlocks = Array.from(noteEl.querySelectorAll(TEXT_BLOCK_SELECTOR));
    const target = textBlocks.length ? textBlocks[textBlocks.length - 1] : noteEl;
    noteEl.focus({ preventScroll: true });
    placeCaretInside(target);
  }

  function insertBlockAfter(reference, block){
    if (!noteEl || !block) return;
    if (reference && reference.parentElement === noteEl){
      noteEl.insertBefore(block, reference.nextSibling);
    } else {
      noteEl.appendChild(block);
    }
  }

  function getCurrentBlock(){
    if (!noteEl) return null;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const anchorNode = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
    return anchorNode ? anchorNode.closest('.title, .body, .photo-block') : null;
  }

  function hasTypedContent(){
    if (!noteEl) return false;
    return Array.from(noteEl.querySelectorAll(TEXT_BLOCK_SELECTOR)).some(block => {
      const text = block.textContent || '';
      return text.replace(/[\s\u200B]+/g, '').length > 0;
    });
  }

  function hasMediaContent(){
    return !!noteEl?.querySelector('.photo-block');
  }

  function updateActionState(){
    const hasText = hasTypedContent();
    const hasMedia = hasMediaContent();
    const shareActive = hasText || hasMedia;

    if (shareBtn){
      shareBtn.classList.toggle('muted', !shareActive);
      shareBtn.setAttribute('aria-disabled', shareActive ? 'false' : 'true');
    }

    if (doneBtn){
      const showDone = hasText;
      doneBtn.classList.toggle('hidden', !showDone);
      doneBtn.setAttribute('aria-hidden', showDone ? 'false' : 'true');
      doneBtn.setAttribute('tabindex', showDone ? '0' : '-1');
    }

    if (cancelBtn){
      if (hasText){
        cancelEverShown = true;
      }

      const shouldShowCancel = hasText || cancelEverShown;
      const cancelDisabled = !hasText;

      cancelBtn.classList.toggle('hidden', !shouldShowCancel);
      cancelBtn.classList.toggle('muted', cancelDisabled);
      cancelBtn.setAttribute('aria-hidden', shouldShowCancel ? 'false' : 'true');
      cancelBtn.setAttribute('aria-disabled', cancelDisabled ? 'true' : 'false');
      cancelBtn.setAttribute('tabindex', shouldShowCancel ? '0' : '-1');
    }
  }

  function attachButton(element, handler){
    if (!element) return;
    element.addEventListener('click', event => {
      event.preventDefault();
      handler();
    });

    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
        event.preventDefault();
        handler();
      }
    });
  }

  function removeLastWord(){
    ensureBlocks();
    if (!noteEl) return;
    const textBlocks = Array.from(noteEl.querySelectorAll(TEXT_BLOCK_SELECTOR));
    if (!textBlocks.length){
      updateActionState();
      return;
    }

    const wasEditing = document.activeElement === noteEl;
    let target = getCurrentBlock();

    if (!target || target.classList.contains('photo-block')){
      target = [...textBlocks].reverse().find(block => (block.textContent || '').replace(/[\s\u200B]+/g, '').length > 0) || null;
    }

    let index = textBlocks.indexOf(target);
    if (index === -1){
      index = textBlocks.length - 1;
    }

    let caretBlock = null;

    while (index >= 0){
      const candidate = textBlocks[index];
      const original = candidate.textContent || '';
      const trimmed = original.replace(/\s+$/u, '');

      if (!trimmed){
        candidate.textContent = '';
        index -= 1;
        continue;
      }

      const newText = trimmed.replace(/\S+$/u, '');
      if (newText === trimmed){
        index -= 1;
        continue;
      }

      candidate.textContent = newText.replace(/\s+$/u, '');
      caretBlock = candidate;
      break;
    }

    ensureBlocks();
    updateActionState();

    if (!wasEditing){
      queueSave();
      return;
    }

    if (caretBlock && caretBlock.isConnected){
      noteEl.focus({ preventScroll: true });
      placeCaretInside(caretBlock);
    } else {
      focusEnd();
    }

    queueSave();
  }

  ensureBlocks();
  updateActionState();

  function getNoteText(){
    if (!noteEl) return '';
    ensureBlocks();
    const blocks = Array.from(noteEl.querySelectorAll(TEXT_BLOCK_SELECTOR));
    return blocks.map(block => (block.textContent || '').replace(/[\r\u200B]+/g, '')).join('\n');
  }

  function setNoteText(text){
    if (!noteEl) return;
    const normalized = String(text || '').replace(/\r/g, '');
    const lines = normalized.split('\n');
    const fragments = lines.length ? lines : [''];

    noteEl.innerHTML = '';
    fragments.forEach((line, idx) => {
      const block = createBlock(idx === 0 ? 'title' : 'body');
      if (line) {
        block.textContent = line;
      }
      noteEl.appendChild(block);
    });

    if (fragments.some(line => line.trim().length > 0)){
      cancelEverShown = true;
    }

    ensureBlocks();
    updateActionState();
  }

  function getSelectionOffsets(){
    const text = getNoteText();
    if (!noteEl) return {start:text.length, end:text.length};
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return {start:text.length, end:text.length};
    const range = selection.getRangeAt(0);
    const preStart = range.cloneRange();
    preStart.selectNodeContents(noteEl);
    preStart.setEnd(range.startContainer, range.startOffset);
    const start = preStart.toString().length;
    const preEnd = range.cloneRange();
    preEnd.selectNodeContents(noteEl);
    preEnd.setEnd(range.endContainer, range.endOffset);
    const end = preEnd.toString().length;
    return {start, end};
  }

  function setCaretPosition(pos){
    if (!noteEl) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    let remaining = Math.max(0, pos);
    const walker = document.createTreeWalker(noteEl, NodeFilter.SHOW_TEXT, null, false);
    let node = walker.nextNode();
    while (node) {
      const len = node.textContent.length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= len;
      node = walker.nextNode();
    }
    range.selectNodeContents(noteEl);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function focusNote(){
    if (!noteEl) return;
    noteEl.focus({preventScroll:true});
  }

  function hideConnectUi(){
    if (!connectUI) return;
    connectUI.classList.add('hidden');
    connectUI.setAttribute('aria-hidden', 'true');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  }
  function showConnectUi(){
    if (!connectUI) return;
    connectUI.classList.remove('hidden');
    connectUI.setAttribute('aria-hidden', 'false');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'true');
    }
  }

  function toggleAutobar(){
    if (!autobar) return;
    if (autofillActive && !isSpectator) {
      autobar.classList.remove('hidden');
      autobar.classList.add('active');
    } else {
      autobar.classList.add('hidden');
      autobar.classList.remove('active');
    }
  }

  function determineCaseMode(sample){
    if (!sample) return 'lower';
    const trimmed = sample.trim();
    if (!trimmed) return 'lower';
    if (trimmed === trimmed.toUpperCase()) return 'upper';
    const rest = trimmed.slice(1);
    if (trimmed[0] === trimmed[0].toUpperCase() && rest === rest.toLowerCase()) return 'capitalized';
    return 'lower';
  }

  function applyCase(word, mode){
    if (!word) return '';
    switch(mode){
      case 'upper':
        return word.toUpperCase();
      case 'capitalized':
        return word.charAt(0).toUpperCase() + word.slice(1);
      default:
        return word.toLowerCase();
    }
  }

  function assignSuggestion(el, value, display){
    if (!el) return;
    if (!value){
      el.textContent = '';
      el.dataset.value = '';
      el.setAttribute('data-empty', 'true');
      return;
    }
    el.textContent = display ?? value;
    el.dataset.value = value;
    el.setAttribute('data-empty', 'false');
  }

  function clearAutobarSuggestions(){
    assignSuggestion(leftWordEl, '');
    if (centerWordEl){
      centerWordEl.textContent = 'слово';
      centerWordEl.dataset.value = '';
      centerWordEl.setAttribute('data-empty', 'true');
    }
    assignSuggestion(rightWordEl, '');
  }

  clearAutobarSuggestions();

  function updateAutobarSuggestions(currentWord){
    if (!autobar || !centerWordEl || isSpectator){
      return;
    }
    if (!autofillActive || !targetWord){
      clearAutobarSuggestions();
      return;
    }

    const caretWord = currentWord || '';
    const forcedPrefix = targetWord.slice(0, Math.min(prefixLen, targetWord.length));
    const forcedLowerPrefix = forcedPrefix.toLowerCase();
    const targetLower = targetWord.toLowerCase();
    const caretLower = caretWord.toLowerCase();
    const caseModeSource = caretWord || targetWord;
    const caseMode = determineCaseMode(caseModeSource);
    const searchBase = forcedLowerPrefix || caretLower;
    const hasSearch = searchBase.length > 0;

    assignSuggestion(centerWordEl, targetWord, targetWord);

    let fallbackLower = '';

    if (caretWord){
      assignSuggestion(leftWordEl, caretWord, caretWord);
    } else {
      if (hasSearch){
        const fallback = AUTOFILL_DICTIONARY.find(word => word.startsWith(searchBase)) || '';
        fallbackLower = fallback;
        const formattedFallback = fallback ? applyCase(fallback, caseMode) : '';
        assignSuggestion(leftWordEl, formattedFallback, formattedFallback);
      } else {
        assignSuggestion(leftWordEl, '', '');
      }
    }

    const alternatives = hasSearch ? AUTOFILL_DICTIONARY.filter(word => {
      if (!word.startsWith(searchBase)) return false;
      if (word === targetLower) return false;
      if (word === caretLower) return false;
      if (!caretWord && fallbackLower && word === fallbackLower) return false;
      return true;
    }) : [];

    const alt = alternatives[0] || '';
    const formattedAlt = alt ? applyCase(alt, caseMode) : '';
    assignSuggestion(rightWordEl, formattedAlt, formattedAlt);
  }

  function updateCurrentRoomDisplay(code){
    if (!currentRoomEl) return;
    currentRoomEl.textContent = '';
    if (code && code.length) {
      currentRoomEl.append('Подключено к комнате: ');
      const codeEl = document.createElement('span');
      codeEl.className = 'code';
      codeEl.textContent = code;
      currentRoomEl.appendChild(codeEl);
      currentRoomEl.setAttribute('data-connected', 'true');
    } else {
      currentRoomEl.textContent = 'Не подключено';
      currentRoomEl.setAttribute('data-connected', 'false');
    }
  }

  function notifyServiceWorker(room){
    if (!('serviceWorker' in navigator)) return;
    const message = { type: 'notes:set-last-room', room };
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage(message);
      return;
    }

    navigator.serviceWorker.ready
      .then(reg => {
        (reg.active || reg.waiting)?.postMessage(message);
      })
      .catch(()=>{});
  }

  function rememberLastRoom(room){
    if (!room) return;
    try {
      localStorage.setItem('magic_notes_last_room', room);
    } catch (e) {}
    notifyServiceWorker(room);
  }

  function syncLastRoom(room){
    if (!room) return;
    notifyServiceWorker(room);
  }

  function getStoredLastRoom(){
    try {
      return localStorage.getItem('magic_notes_last_room') || '';
    } catch (e) {
      return '';
    }
  }

  function requestLastRoomFromServiceWorker(){
    if (initialAutoJoinResolved) return;
    if (!('serviceWorker' in navigator)) return;

    const message = { type: 'notes:request-last-room' };

    const send = target => {
      if (!target) return false;
      try {
        target.postMessage(message);
        return true;
      } catch (e) {
        return false;
      }
    };

    if (send(navigator.serviceWorker.controller)) {
      return;
    }

    navigator.serviceWorker.ready
      .then(reg => {
        send(reg.active || reg.waiting);
      })
      .catch(()=>{});
  }

  if ('serviceWorker' in navigator && typeof navigator.serviceWorker.addEventListener === 'function') {
    navigator.serviceWorker.addEventListener('message', event => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type !== 'notes:last-room') return;
      const room = typeof event.data.room === 'string' ? event.data.room.trim() : '';
      if (!room || initialAutoJoinResolved) return;
      initialAutoJoinResolved = true;
      joinRoom(room, {persist:true});
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      requestLastRoomFromServiceWorker();
    });
  }

  function detachRoomListeners(){
    if (spectatorRef && spectatorTextHandler){
      spectatorRef.child('text').off('value', spectatorTextHandler);
    }
    if (roomRef && autofillHandler){
      roomRef.child('autofill').off('value', autofillHandler);
    }
    if (roomRef && searchHandler){
      roomRef.child('search').off('value', searchHandler);
    }
    spectatorTextHandler = null;
    autofillHandler = null;
    searchHandler = null;
    autofillActive = false;
    targetWord = '';
    prefixLen = 3;
    lastSearchTrigger = 0;
    clearAutobarSuggestions();
    toggleAutobar();
  }

  function joinRoom(id, {persist=true} = {}){
    const normalized = (id || '').toUpperCase();
    if (!normalized) return;

    detachRoomListeners();

    roomId = normalized;
    roomRef = db.ref(`rooms/${roomId}`);
    spectatorRef = roomRef.child('spectator');
    lastSearchTrigger = loadLastSearchTrigger(roomId);

    if (persist) {
      rememberLastRoom(roomId);
    } else {
      syncLastRoom(roomId);
    }

    hideConnectUi();
    cancelEverShown = false;
    updateActionState();

    roomRef.child('active').once('value').then(s=>{
      if(!s.val()){
        alert('Комната закрыта или не существует.');
        roomId = null;
        roomRef = null;
        spectatorRef = null;
        updateCurrentRoomDisplay(null);
        showConnectUi();
        return;
      }

      updateCurrentRoomDisplay(roomId);

      spectatorTextHandler = snap=>{
        const remote = snap.val() ?? '';
        if (remote !== getNoteText()) {
          applyingRemote = true;
          setNoteText(remote);
          applyingRemote = false;
          if (autofillActive && !isSpectator) {
            updateAutobarSuggestions(getCurrentWord());
          }
        }
      };

      spectatorRef.child('text').on('value', spectatorTextHandler);

      autofillHandler = snap=>{
        const v = snap.val() || {};
        autofillActive = !!v.active;
        targetWord = v.targetWord || '';
        prefixLen = typeof v.prefixLen === 'number' ? v.prefixLen : 3;
        toggleAutobar();
        if (!autofillActive){
          clearAutobarSuggestions();
        } else {
          updateAutobarSuggestions(getCurrentWord());
        }
      };

      roomRef.child('autofill').on('value', autofillHandler);

      searchHandler = snap=>{
        const v = snap.val() || {};
        const trigger = Number(v.trigger) || 0;
        const query = (v.query || '').trim();
        if (!trigger || trigger <= lastSearchTrigger) {
          return;
        }
        lastSearchTrigger = trigger;
        saveLastSearchTrigger(roomId, lastSearchTrigger);
        if (!query) {
          return;
        }
        const url = `https://yandex.ru/images/search?from=tabbar&text=${encodeURIComponent(query)}`;
        location.href = url;
      };

      roomRef.child('search').on('value', searchHandler);
    });
  }

  if (quickMenuToggle){
    quickMenuToggle.addEventListener('click', event => {
      event.preventDefault();
      toggleQuickMenu();
    });

    quickMenuToggle.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
        event.preventDefault();
        toggleQuickMenu();
      }
    });
  }

  if (quickMenuBackdrop){
    quickMenuBackdrop.addEventListener('click', () => {
      hideQuickMenu({ restoreFocus: true });
    });
  }

  if (quickMenu){
    quickMenu.addEventListener('click', event => {
      const target = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('.quick-menu__item')
        : null;
      if (target){
        hideQuickMenu();
      }
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isQuickMenuVisible()){
      hideQuickMenu({ restoreFocus: true });
    }
  });

  menuBtn && menuBtn.addEventListener('click', ()=>{
    if (!connectUI) return;
    const willShow = connectUI.classList.contains('hidden');
    if (willShow) {
      showConnectUi();
    } else {
      hideConnectUi();
    }
  });

  if (qs.get('room')) {
    const id = qs.get('room').trim();
    if (id) {
      initialAutoJoinResolved = true;
      joinRoom(id, {persist:true});
    }
  } else {
    const last = getStoredLastRoom();
    if (last) {
      initialAutoJoinResolved = true;
      joinRoom(last, {persist:false});
    } else {
      updateCurrentRoomDisplay(null);
      hideConnectUi();
      requestLastRoomFromServiceWorker();
    }
  }

  function currentWordBounds(text, caret){
    const re = /[0-9A-Za-zА-Яа-яЁё_]/;
    let s = caret - 1; while (s >= 0 && re.test(text[s])) s--; s++;
    let e = caret; while (e < text.length && re.test(text[e])) e++;
    return {start:s, end:e};
  }

  function getCurrentWord(){
    const text = getNoteText();
    const caret = getSelectionOffsets().start;
    const {start, end} = currentWordBounds(text, caret);
    return text.slice(start, end);
  }

  function applySuggestionWord(word){
    if (!word) return;
    focusNote();
    const t = getNoteText();
    const caret = getSelectionOffsets().start;
    const {start, end} = currentWordBounds(t, caret);
    const newText = t.slice(0, start) + word + ' ' + t.slice(end);
    setNoteText(newText);
    const newCaret = start + word.length + 1;
    setCaretPosition(newCaret);
    queueSave();
    updateAutobarSuggestions(getCurrentWord());
  }

  function bindSuggestionClick(el){
    el?.addEventListener('click', ()=>{
      const value = el.dataset.value || '';
      if (!value) return;
      applySuggestionWord(value);
    });
  }

  bindSuggestionClick(leftWordEl);
  bindSuggestionClick(centerWordEl);
  bindSuggestionClick(rightWordEl);

  function applyAutofillOnInput(){
    if (!autofillActive || !targetWord || prefixLen <= 0) return false;
    const t = getNoteText();
    const caret = getSelectionOffsets().start;
    const {start, end} = currentWordBounds(t, caret);
    const word = t.slice(start, end);
    if (word.length === 0) return false;

    const k = Math.min(prefixLen, targetWord.length);
    if (word.length <= k) {
      const forced = targetWord.slice(0, word.length);
      if (word !== forced) {
        const newText = t.slice(0,start) + forced + t.slice(end);
        const shift = forced.length - word.length;
        setNoteText(newText);
        const newCaret = caret + shift;
        setCaretPosition(newCaret);
        return true;
      }
    }
    return false;
  }

  let saveT = null;
  function queueSave(){
    if (!spectatorRef) return;
    if (saveT) clearTimeout(saveT);
    saveT = setTimeout(()=>{
      const text = getNoteText();
      const caret = getSelectionOffsets().start;
      spectatorRef.update({
        text,
        cursor: caret
      });
    }, 120);
  }

  noteEl?.addEventListener('focus', ()=>{
    ensureBlocks();
    updateActionState();
    hideConnectUi();
  });

  noteEl?.addEventListener('blur', ()=>{
    updateActionState();
  });

  noteEl?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey){
      event.preventDefault();
      ensureBlocks();
      const currentBlock = getCurrentBlock();
      const newBlock = createBlock('body');
      insertBlockAfter(currentBlock, newBlock);
      noteEl.focus({ preventScroll: true });
      placeCaretInside(newBlock);
      ensureBlocks();
      updateActionState();
    }
  });

  noteEl?.addEventListener('input', ()=>{
    if (applyingRemote) return;
    ensureBlocks();
    updateActionState();
    applyAutofillOnInput();
    updateAutobarSuggestions(getCurrentWord());
    queueSave();
  });

  document.addEventListener('selectionchange', ()=>{
    if (!autofillActive || isSpectator) return;
    if (!noteEl) return;
    const sel = window.getSelection();
    if (!sel) return;
    const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    if (!anchor || !noteEl.contains(anchor)) return;
    updateAutobarSuggestions(getCurrentWord());
  });

  attachButton(doneBtn, () => {
    if (!noteEl) return;
    const candidate = getNoteText().trim().toUpperCase();
    if (candidate && ROOM_CODE_PATTERN.test(candidate)) {
      initialAutoJoinResolved = true;
      joinRoom(candidate);
      setNoteText('');
    }
    noteEl.blur();
  });

  attachButton(cancelBtn, () => {
    if (!hasTypedContent()) return;
    removeLastWord();
  });

  sheetEl?.addEventListener('pointerdown', event => {
    if (event.target.closest('.note') || event.target.closest('.toolbar')){
      return;
    }
    event.preventDefault();
    focusEnd();
  });

  cameraTool?.addEventListener('click', () => {
    focusNote();
    cameraInput?.click();
  });

  cameraInput?.addEventListener('change', () => {
    const file = cameraInput.files && cameraInput.files[0];
    if (!file){
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (!noteEl) return;
      const block = document.createElement('div');
      block.className = 'photo-block';
      const img = document.createElement('img');
      img.src = String(reader.result);
      img.alt = 'Добавленное фото';
      block.appendChild(img);

      const currentBlock = getCurrentBlock();
      insertBlockAfter(currentBlock, block);

      ensureBlocks();
      updateActionState();

      let nextEditable = block.nextElementSibling;
      while (nextEditable && nextEditable.classList.contains('photo-block')){
        nextEditable = nextEditable.nextElementSibling;
      }

      if (!nextEditable){
        nextEditable = createBlock('body');
        noteEl.insertBefore(nextEditable, block.nextSibling);
      }

      noteEl.focus({ preventScroll: true });
      placeCaretInside(nextEditable);
      queueSave();
    });

    reader.readAsDataURL(file);
    cameraInput.value = '';
  });
})();
