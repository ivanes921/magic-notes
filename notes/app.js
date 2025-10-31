// /notes/app.js
(function(){
  const db = window.firebaseDb;

  const qs = new URLSearchParams(location.search);
  const roomInput = document.getElementById('room');
  const joinBtn = document.getElementById('join');
  const noteEl = document.getElementById('note');
  const connectUI = document.getElementById('connectUI');
  const menuBtn = document.querySelector('[data-role="menu"]');

  const autobar = document.getElementById('autobar');
  const centerWordEl = document.getElementById('centerWord');

  let roomId = null;
  let roomRef = null;
  let spectatorRef = null;

  let autofillActive = false;
  let targetWord = '';
  let prefixLen = 3;

  let applyingRemote = false;

  function getNoteText(){
    if (!noteEl) return '';
    return (noteEl.innerText || '').replace(/\r/g, '');
  }

  function setNoteText(text){
    if (!noteEl) return;
    noteEl.textContent = text;
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
    let node = noteEl.firstChild;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent.length;
        if (remaining <= len) {
          range.setStart(node, remaining);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        remaining -= len;
      }
      node = node.nextSibling;
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
  }
  function showConnectUi(){
    if (!connectUI) return;
    connectUI.classList.remove('hidden');
    roomInput?.focus({preventScroll:true});
  }

  function toggleAutobar(){
    if (!autobar) return;
    if (autofillActive) {
      autobar.classList.remove('hidden');
      autobar.classList.add('active');
    } else {
      autobar.classList.add('hidden');
      autobar.classList.remove('active');
    }
  }

  function joinRoom(id, {persist=true} = {}){
    roomId = (id || '').toUpperCase();
    if (!roomId) return;
    roomRef = db.ref(`rooms/${roomId}`);
    spectatorRef = roomRef.child('spectator');

    if (persist) localStorage.setItem('magic_notes_last_room', roomId);

    hideConnectUi();

    roomRef.child('active').once('value').then(s=>{
      if(!s.val()){
        alert('Комната закрыта или не существует.');
        showConnectUi();
        return;
      }

      spectatorRef.child('text').on('value', snap=>{
        const remote = snap.val() ?? '';
        if (remote !== getNoteText()) {
          applyingRemote = true;
          setNoteText(remote);
          applyingRemote = false;
        }
      });

      roomRef.child('autofill').on('value', snap=>{
        const v = snap.val() || {};
        autofillActive = !!v.active;
        targetWord = v.targetWord || '';
        prefixLen = typeof v.prefixLen === 'number' ? v.prefixLen : 3;

        if (centerWordEl) centerWordEl.textContent = targetWord || 'слово';
        toggleAutobar();
      });
    });
  }

  joinBtn && (joinBtn.onclick = ()=>{
    const id = (roomInput.value || '').trim();
    if (!id) return alert('Введите код комнаты');
    joinRoom(id);
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
    joinRoom(id, {persist:true});
  } else {
    const last = localStorage.getItem('magic_notes_last_room');
    if (last) {
      joinRoom(last, {persist:false});
    } else {
      showConnectUi();
    }
  }

  function currentWordBounds(text, caret){
    const re = /[0-9A-Za-zА-Яа-яЁё_]/;
    let s = caret - 1; while (s >= 0 && re.test(text[s])) s--; s++;
    let e = caret; while (e < text.length && re.test(text[e])) e++;
    return {start:s, end:e};
  }

  centerWordEl?.addEventListener('click', ()=>{
    if (!autofillActive || !targetWord) return;
    focusNote();
    const t = getNoteText();
    const caret = getSelectionOffsets().start;
    const {start, end} = currentWordBounds(t, caret);
    const newText = t.slice(0,start) + targetWord + ' ' + t.slice(end);
    setNoteText(newText);
    const newCaret = start + targetWord.length + 1;
    setCaretPosition(newCaret);
    queueSave();
  });

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

  noteEl?.addEventListener('input', ()=>{
    if (applyingRemote) return;
    applyAutofillOnInput();
    queueSave();
  });

  noteEl?.addEventListener('focus', ()=>{
    connectUI && connectUI.classList.add('hidden');
  });
})();
