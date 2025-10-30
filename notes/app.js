// /notes/app.js
(function(){
  const db = window.firebaseDb;

  const qs = new URLSearchParams(location.search);
  const roomInput = document.getElementById('room');
  const joinBtn = document.getElementById('join');
  const noteEl = document.getElementById('note');
  const connectUI = document.getElementById('connectUI');

  const autobar = document.getElementById('autobar');
  const centerWordEl = document.getElementById('centerWord');

  let roomId = null;
  let roomRef = null;
  let spectatorRef = null;

  let autofillActive = false;
  let targetWord = '';
  let prefixLen = 3;

  let applyingRemote = false;

  function hideConnectUi(){ if (connectUI) connectUI.style.display = 'none'; }
  function showConnectUi(){ if (connectUI) connectUI.style.display = ''; }

  // --- Подключение к комнате ---
  function joinRoom(id, {persist=true} = {}){
    roomId = (id || '').toUpperCase();
    if (!roomId) return;
    roomRef = db.ref(`rooms/${roomId}`);
    spectatorRef = roomRef.child('spectator');

    // Сохраняем выбор комнаты, чтобы PWA из ярлыка открывалась сразу в неё
    if (persist) localStorage.setItem('magic_notes_last_room', roomId);

    hideConnectUi();

    // Проверим активность
    roomRef.child('active').once('value').then(s=>{
      if(!s.val()){
        alert('Комната закрыта или не существует.');
        showConnectUi();
        return;
      }

      // Подписка на удалённый текст
      spectatorRef.child('text').on('value', snap=>{
        const remote = snap.val() ?? "";
        if (remote !== noteEl.value) {
          applyingRemote = true;
          noteEl.value = remote;
          applyingRemote = false;
        }
      });

      // Подписка на настройки автоподбора
      roomRef.child('autofill').on('value', snap=>{
        const v = snap.val() || {};
        autofillActive = !!v.active;
        targetWord = v.targetWord || '';
        prefixLen = typeof v.prefixLen === 'number' ? v.prefixLen : 3;

        centerWordEl.textContent = targetWord || 'слово';
        autobar.style.display = autofillActive ? 'flex' : 'none';
      });
    });
  }

  joinBtn && (joinBtn.onclick = ()=>{
    const id = (roomInput.value || "").trim();
    if (!id) return alert('Введите код комнаты');
    joinRoom(id);
  });

  // 1) Если пришёл ?room= — автологин + скрыть UI
  if (qs.get('room')) {
    const id = qs.get('room').trim();
    joinRoom(id, {persist:true});
  } else {
    // 2) Иначе, если есть сохранённая — подцепиться к ней (для ярлыка на Домой)
    const last = localStorage.getItem('magic_notes_last_room');
    if (last) {
      joinRoom(last, {persist:false}); // уже сохранена
    } else {
      showConnectUi();
    }
  }

  // --- Вспомогательные функции для автоподбора ---
  function currentWordBounds(text, caret){
    const re = /[0-9A-Za-zА-Яа-яЁё_]/;
    let s = caret - 1; while (s >= 0 && re.test(text[s])) s--; s++;
    let e = caret; while (e < text.length && re.test(text[e])) e++;
    return {start:s, end:e};
  }

  centerWordEl.addEventListener('click', ()=>{
    if (!autofillActive || !targetWord) return;
    const t = noteEl.value;
    const caret = noteEl.selectionStart || 0;
    const {start, end} = currentWordBounds(t, caret);
    const newText = t.slice(0,start) + targetWord + ' ' + t.slice(end);
    noteEl.value = newText;
    const newCaret = start + targetWord.length + 1;
    noteEl.setSelectionRange(newCaret, newCaret);
    queueSave();
  });

  function applyAutofillOnInput(){
    if (!autofillActive || !targetWord || prefixLen <= 0) return false;
    const t = noteEl.value;
    const caret = noteEl.selectionStart || 0;
    const {start, end} = currentWordBounds(t, caret);
    const word = t.slice(start, end);
    if (word.length === 0) return false;

    const k = Math.min(prefixLen, targetWord.length);
    if (word.length <= k) {
      const forced = targetWord.slice(0, word.length);
      if (word !== forced) {
        const newText = t.slice(0,start) + forced + t.slice(end);
        const shift = forced.length - word.length;
        noteEl.value = newText;
        const newCaret = caret + shift;
        noteEl.setSelectionRange(newCaret, newCaret);
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
      spectatorRef.update({
        text: noteEl.value,
        cursor: noteEl.selectionStart || 0
      });
    }, 120);
  }

  noteEl.addEventListener('input', ()=>{
    if (applyingRemote) return;
    applyAutofillOnInput();
    queueSave();
  });

})();
