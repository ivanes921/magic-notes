// /notes/app.js
(function(){
  const db = window.firebaseDb;

  const qs = new URLSearchParams(location.search);
  const roomInput = document.getElementById('room');
  const joinBtn = document.getElementById('join');
  const noteEl = document.getElementById('note');

  const autobar = document.getElementById('autobar');
  const centerWordEl = document.getElementById('centerWord');

  if(qs.get('room')) roomInput.value = qs.get('room');

  let roomId = null;
  let roomRef = null;
  let spectatorRef = null;

  // Состояние автоподбора
  let autofillActive = false;
  let targetWord = '';
  let prefixLen = 3;

  // Флаг, чтобы не зациклить при приёме удалённых правок
  let applyingRemote = false;

  function joinRoom(id){
    roomId = id.toUpperCase();
    roomRef = db.ref(`rooms/${roomId}`);
    spectatorRef = roomRef.child('spectator');

    // Проверка активности комнаты
    roomRef.child('active').once('value').then(s=>{
      if(!s.val()){
        alert('Комната закрыта или не существует.');
        return;
      }

      // Подписка на текст (если кабинет отредактирует)
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

  joinBtn.onclick = ()=>{
    const id = (roomInput.value || "").trim();
    if (!id) return alert('Введите код комнаты');
    joinRoom(id);
  };

  if (roomInput.value) joinRoom(roomInput.value);

  // ВСПОМОГАТЕЛЬНОЕ: получить границы текущего слова (по курсору)
  function currentWordBounds(text, caret){
    // слово: буквы/цифры/подчёркивание/кириллица/латиница
    const re = /[0-9A-Za-zА-Яа-яЁё_]/;
    let s = caret - 1;
    while (s >= 0 && re.test(text[s])) s--;
    s++;
    let e = caret;
    while (e < text.length && re.test(text[e])) e++;
    return {start:s, end:e};
  }

  // Подстановка центрального слова (тап по капсуле)
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

  // Автоподмена первых N символов текущего слова
  function applyAutofillOnInput(){
    if (!autofillActive || !targetWord || prefixLen <= 0) return false;

    const t = noteEl.value;
    const caret = noteEl.selectionStart || 0;
    const {start, end} = currentWordBounds(t, caret);
    const word = t.slice(start, end);

    // Только если курсор внутри слова и длина слова <= prefixLen
    if (word.length === 0) return false;

    const k = Math.min(prefixLen, targetWord.length);
    if (word.length <= k) {
      const forced = targetWord.slice(0, word.length); // ровно столько, сколько ввёл
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

  // Отправка текста в БД (debounce)
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

  // Основной обработчик ввода
  noteEl.addEventListener('input', ()=>{
    if (applyingRemote) return;
    const changed = applyAutofillOnInput(); // может поправить текст/каретку
    queueSave();
  });

})();
