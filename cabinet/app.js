// /cabinet/app.js
(function(){
  const db = window.firebaseDb;

  const roomCodeEl = document.getElementById('roomCode');
  const spectatorLinkEl = document.getElementById('spectatorLink');
  const liveTextEl = document.getElementById('liveText');

  const roomInputEl = document.getElementById('roomInput');
  const joinByCodeBtn = document.getElementById('joinByCode');
  const genCodeBtn = document.getElementById('genCode');

  const peekBtn = document.getElementById('peekToggle');
  const targetWordInput = document.getElementById('targetWord');
  const prefixLenInput = document.getElementById('prefixLen');
  const autofillOnBtn = document.getElementById('autofillOn');
  const autofillOffBtn = document.getElementById('autofillOff');

  let roomId = null;
  let roomRef = null;
  let spectatorRef = null;

  // PEEK overlay
  let peekOverlay = null, peekCorner = null, peekOn = false, cornerVisible = false;
  let lastSpectatorText = "—";

  function makeRoomId(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

  function setUiForRoom(id){
    const link = new URL('../notes/', location.href);
    link.searchParams.set('room', id);
    roomCodeEl.textContent = id;
    spectatorLinkEl.textContent = link.toString();
  }

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
    roomRef = await ensureRoomExists(roomId);
    spectatorRef = roomRef.child('spectator');
    setUiForRoom(roomId);

    spectatorRef.on('value', (snap)=>{
      const v = snap.val() || {};
      lastSpectatorText = v.text || "";
      liveTextEl.textContent = lastSpectatorText || "—";
      if (peekCorner) peekCorner.textContent = lastSpectatorText || "";
    });
  }

  joinByCodeBtn.onclick = ()=> joinRoomById((roomInputEl.value||'').trim());
  genCodeBtn.onclick = ()=> {
    const id = makeRoomId();
    roomInputEl.value = id;
    joinRoomById(id);
  };

  // --- PEEK ---
  function enterPeek(){
    if (!roomRef) return alert('Сначала подключитесь к комнате');
    if (peekOn) return;
    peekOn = true;
    roomRef.child('peek').update({ enabled: true }).catch(()=>{});

    peekOverlay = document.createElement('div');
    Object.assign(peekOverlay.style, {
      position:'fixed', inset:'0', background:'#000', color:'#fff', zIndex:'9999',
      touchAction:'none', userSelect:'none'
    });

    const hint = document.createElement('div');
    hint.textContent = 'Тап — показать/скрыть уголок. Долгий тап — выйти.';
    Object.assign(hint.style, { position:'absolute', left:'50%', top:'18px', transform:'translateX(-50%)', fontSize:'12px', opacity:'.5' });
    peekOverlay.appendChild(hint);

    peekCorner = document.createElement('div');
    peekCorner.textContent = lastSpectatorText || "";
    Object.assign(peekCorner.style, {
      position:'absolute', right:'16px', bottom:'16px',
      width:'220px', height:'120px', borderRadius:'12px',
      padding:'10px', background:'rgba(255,255,255,.06)', color:'#fff',
      border:'1px solid rgba(255,255,255,.15)', overflow:'hidden',
      fontSize:'12px', lineHeight:'1.25', boxShadow:'0 8px 30px rgba(0,0,0,.6)',
      display:'none'
    });
    peekOverlay.appendChild(peekCorner);

    peekOverlay.addEventListener('click', ()=>{
      cornerVisible = !cornerVisible;
      peekCorner.style.display = cornerVisible ? 'block' : 'none';
    });

    let pressT = 0;
    peekOverlay.addEventListener('pointerdown', ()=>{ pressT = Date.now(); });
    peekOverlay.addEventListener('pointerup', ()=>{ if (Date.now()-pressT > 600) exitPeek(); });

    document.body.appendChild(peekOverlay);
  }
  function exitPeek(){
    if (!peekOn) return;
    peekOn = false; cornerVisible = false;
    if (peekOverlay && peekOverlay.parentNode) peekOverlay.parentNode.removeChild(peekOverlay);
    peekOverlay = null; peekCorner = null;
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
