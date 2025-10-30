(function(){
  const qs = new URLSearchParams(location.search);
  const roomInput = document.getElementById('room');
  if(qs.get('room')) roomInput.value = qs.get('room');

  document.getElementById('join').onclick = ()=>{
    alert('Связь с комнатой добавим на шаге 3 (Firebase). Сейчас демо-режим.');
  };

  // Панель автоподбора появится на шаге 3
})();
