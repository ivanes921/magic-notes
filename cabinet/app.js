// /cabinet/app.js
(function(){
  const db = window.firebaseDb;

  const roomCodeEl = document.getElementById('roomCode');
  const spectatorLinkEl = document.getElementById('spectatorLink');
  const copyHintEl = document.getElementById('copyHint');
  const liveTextEl = document.getElementById('liveText');

  const roomInputEl = document.getElementById('roomInput');
  const joinByCodeBtn = document.getElementById('joinByCode');
  const genCodeBtn = document.getElementById('genCode');
  const qrBtn = document.getElementById('qrButton');
  const qrOverlay = document.getElementById('qrOverlay');
  const qrImage = document.getElementById('qrImage');
  const qrCloseBtn = document.getElementById('qrClose');

  const peekBtn = document.getElementById('peekToggle');
  const targetWordInput = document.getElementById('targetWord');
  const prefixLenInput = document.getElementById('prefixLen');
  const autofillOnBtn = document.getElementById('autofillOn');
  const autofillOffBtn = document.getElementById('autofillOff');

  let roomId = null;
  let roomRef = null;
  let spectatorRef = null;

  // PEEK overlay
  let peekOverlay = null, peekText = null, peekOn = false, peekVisible = false;
  let lastSpectatorText = "—";
  let copyHintTimer = null;
  let lastFocusBeforeQr = null;

  function makeRoomId(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

  function setUiForRoom(id){
    const link = new URL('../notes/', location.href);
    link.searchParams.set('room', id);
    roomCodeEl.textContent = id;
    spectatorLinkEl.textContent = link.toString();
    spectatorLinkEl.dataset.href = link.toString();
    spectatorLinkEl.disabled = false;
    spectatorLinkEl.removeAttribute('aria-disabled');
    showCopyHint('Нажмите на ссылку, чтобы скопировать');
  }

  function resetSpectatorLink(){
    spectatorLinkEl.textContent = '—';
    delete spectatorLinkEl.dataset.href;
    spectatorLinkEl.disabled = true;
    spectatorLinkEl.setAttribute('aria-disabled', 'true');
    showCopyHint('');
    roomCodeEl.textContent = '—';
    liveTextEl.textContent = '—';
  }

  resetSpectatorLink();

  async function ensureRoomExists(id){
    // если комнаты нет — создаём каркас; если есть — не трогаем данные
    const ref = db.ref(`rooms/${id}`);
    const snap = await ref.once('value');
    if (!snap.exists()) {
      await ref.set({
        createdAt: Date.now(),
        active: true,
        spectator: { text: "", cursor: 0 },
        peek: { enabled: false },
        autofill: { targetWord: "", prefixLen: 3, active: false }
      });
    } else {
      await ref.child('active').set(true);
    }
    return ref;
  }

  async function joinRoomById(id){
    if (!id) return alert('Введите код комнаты');
    roomId = id.toUpperCase();
    if (spectatorRef) spectatorRef.off();
    roomRef = await ensureRoomExists(roomId);
    spectatorRef = roomRef.child('spectator');
    setUiForRoom(roomId);
    roomInputEl.value = '';

    spectatorRef.on('value', (snap)=>{
      const v = snap.val() || {};
      lastSpectatorText = v.text || "";
      liveTextEl.textContent = lastSpectatorText || "—";
      if (peekText) peekText.textContent = lastSpectatorText || "";
    });
  }

  joinByCodeBtn.onclick = ()=> joinRoomById((roomInputEl.value||'').trim());
  roomInputEl.addEventListener('keydown', (evt)=>{
    if (evt.key === 'Enter') {
      evt.preventDefault();
      joinRoomById((roomInputEl.value||'').trim());
    }
  });
  genCodeBtn.onclick = ()=> {
    const id = makeRoomId();
    roomInputEl.value = id;
    joinRoomById(id);
  };

  spectatorLinkEl.addEventListener('click', ()=>{
    const href = spectatorLinkEl.dataset.href;
    if (!href) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(href).then(()=>{
        showCopyHint('Ссылка скопирована');
      }).catch(()=>{
        showCopyHint('Не удалось скопировать :(');
      });
    } else {
      const tmp = document.createElement('textarea');
      tmp.value = href;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.focus();
      tmp.select();
      try {
        document.execCommand('copy');
        showCopyHint('Ссылка скопирована');
      } catch (err) {
        showCopyHint('Не удалось скопировать :(');
      }
      document.body.removeChild(tmp);
    }
  });

  function showCopyHint(text){
    copyHintEl.textContent = text || '';
    if (copyHintTimer) clearTimeout(copyHintTimer);
    if (text) {
      copyHintTimer = setTimeout(()=>{
        copyHintEl.textContent = '';
        copyHintTimer = null;
      }, 3000);
    }
  }

  qrBtn.addEventListener('click', ()=>{
    const href = spectatorLinkEl.dataset.href;
    if (!href) {
      alert('Сначала подключитесь к комнате');
      return;
    }
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(href)}`;
    qrImage.src = qrSrc;
    lastFocusBeforeQr = document.activeElement;
    qrOverlay.hidden = false;
    qrCloseBtn.focus();
  });

  function closeQr(){
    qrOverlay.hidden = true;
    qrImage.removeAttribute('src');
    if (lastFocusBeforeQr && typeof lastFocusBeforeQr.focus === 'function') {
      try { lastFocusBeforeQr.focus(); }
      catch (e) { /* ignore focus restore errors */ }
    }
    lastFocusBeforeQr = null;
  }
  qrCloseBtn.addEventListener('click', closeQr);
  qrOverlay.addEventListener('click', (evt)=>{
    if (evt.target === qrOverlay) closeQr();
  });
  document.addEventListener('keydown', (evt)=>{
    if (!qrOverlay.hidden && evt.key === 'Escape') closeQr();
  });

  // --- PEEK ---
  function enterPeek(){
    if (!roomRef) return alert('Сначала подключитесь к комнате');
    if (peekOn) return;
    peekOn = true;
    roomRef.child('peek').update({ enabled: true }).catch(()=>{});

    peekOverlay = document.createElement('div');
    Object.assign(peekOverlay.style, {
      position:'fixed', inset:'0', background:'#000', color:'#fff', zIndex:'9999',
      touchAction:'none', userSelect:'none', padding:'0'
    });
    peekOverlay.style.setProperty('padding-top', 'env(safe-area-inset-top)');
    peekOverlay.style.setProperty('padding-right', 'env(safe-area-inset-right)');
    peekOverlay.style.setProperty('padding-bottom', 'env(safe-area-inset-bottom)');
    peekOverlay.style.setProperty('padding-left', 'env(safe-area-inset-left)');

    const statusBarFill = document.createElement('div');
    Object.assign(statusBarFill.style, {
      position:'absolute', top:'0', left:'0', right:'0', height:'0', background:'#000'
    });
    statusBarFill.style.setProperty('height', 'env(safe-area-inset-top)');
    peekOverlay.appendChild(statusBarFill);

    peekText = document.createElement('div');
    peekText.textContent = lastSpectatorText || "";
    Object.assign(peekText.style, {
      position:'absolute', left:'50%', bottom:'16px',
      transform:'translateX(-50%)', fontSize:'14px', lineHeight:'1.4',
      color:'#fff', textAlign:'center', letterSpacing:'0.02em',
      display:'none'
    });
    peekText.style.setProperty('bottom', 'calc(16px + env(safe-area-inset-bottom))');
    peekOverlay.appendChild(peekText);

    peekOverlay.addEventListener('click', ()=>{
      peekVisible = !peekVisible;
      peekText.style.display = peekVisible ? 'block' : 'none';
    });

    let pressT = 0;
    peekOverlay.addEventListener('pointerdown', ()=>{ pressT = Date.now(); });
    peekOverlay.addEventListener('pointerup', ()=>{ if (Date.now()-pressT > 600) exitPeek(); });

    document.body.appendChild(peekOverlay);
  }
  function exitPeek(){
    if (!peekOn) return;
    peekOn = false; peekVisible = false;
    if (peekOverlay && peekOverlay.parentNode) peekOverlay.parentNode.removeChild(peekOverlay);
    peekOverlay = null; peekText = null;
    roomRef && roomRef.child('peek').update({ enabled: false }).catch(()=>{});
  }
  peekBtn.onclick = ()=> peekOn ? exitPeek() : enterPeek();

  // --- Автоподбор ---
  function enableAutofill(){
    if (!roomRef) return alert('Сначала подключитесь к комнате');
    const word = (targetWordInput.value || '').trim();
    const pref = Math.max(0, Math.min(5, parseInt(prefixLenInput.value || '3', 10)));
    roomRef.child('autofill').update({ targetWord: word, prefixLen: pref, active: true });
    alert('Автоподбор включён');
  }
  function disableAutofill(){
    if (!roomRef) return alert('Сначала подключитесь к комнате');
    roomRef.child('autofill').update({ active: false });
    alert('Автоподбор выключен');
  }
  autofillOnBtn.onclick = enableAutofill;
  autofillOffBtn.onclick = disableAutofill;

  window.addEventListener('beforeunload', ()=>{ if (roomRef) roomRef.child('active').set(false); });

})();
