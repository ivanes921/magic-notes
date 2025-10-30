(function(){
  // До подключения Firebase — просто демо-логика генерации кода и ссылок.
  const roomCodeEl = document.getElementById('roomCode');
  const spectatorLinkEl = document.getElementById('spectatorLink');

  function makeRoomId(){
    return Math.random().toString(36).slice(2,8).toUpperCase();
  }

  document.getElementById('createRoom').onclick = ()=>{
    const id = makeRoomId();
    const link = new URL('../notes/', location.href);
    link.searchParams.set('room', id);
    roomCodeEl.textContent = id;
    spectatorLinkEl.textContent = link.toString();
  };

  // Заглушки (на шаге 3 свяжем с БД)
  document.getElementById('peekToggle').onclick = ()=> alert('PEEK включим на шаге 3');
  document.getElementById('autofillOn').onclick = ()=> alert('Автоподбор включим на шаге 3');
  document.getElementById('autofillOff').onclick = ()=> alert('Выключим на шаге 3');

})();
