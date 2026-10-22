// Botão de tema (partials/botao-tema.ejs): alterna Automático → Claro → Escuro.
// A escolha fica guardada só neste aparelho. A aplicação do tema em si está em
// partials/marca-estilo.ejs, que roda antes de a página aparecer.
(function () {
  var ORDEM = ['auto', 'claro', 'escuro'];
  var NOMES = { auto: 'Automático', claro: 'Claro', escuro: 'Escuro' };

  function atualizarBotoes() {
    var pref = window.pedeaiTema.preferencia();
    document.querySelectorAll('[data-alternar-tema]').forEach(function (btn) {
      var texto = btn.querySelector('.btn-tema-texto');
      if (texto) texto.textContent = 'Tema: ' + NOMES[pref];
      btn.setAttribute('aria-label', 'Tema: ' + NOMES[pref] + '. Toque para mudar.');
      btn.title = 'Tema: ' + NOMES[pref];
    });
  }

  document.querySelectorAll('[data-alternar-tema]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var atual = window.pedeaiTema.preferencia();
      var proximo = ORDEM[(ORDEM.indexOf(atual) + 1) % ORDEM.length];
      try {
        if (proximo === 'auto') localStorage.removeItem('pedeai-tema');
        else localStorage.setItem('pedeai-tema', proximo);
      } catch (e) {}
      window.pedeaiTema.aplicar();
      atualizarBotoes();
    });
  });

  atualizarBotoes();
})();
