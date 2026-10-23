const db = require('../db');

// Log de atividades do painel: quem alterou preço, removeu item, cancelou pedido etc.
// Grava o nome de quem fez (além do id), pra continuar legível se o usuário for excluído.

function nomeUsuario(usuario) {
  return usuario.nome || usuario.usuario;
}

function registrar(usuario, acao, detalhe = '') {
  db.prepare('INSERT INTO atividades (usuario_id, usuario_nome, acao, detalhe) VALUES (?, ?, ?, ?)')
    .run(usuario.id, nomeUsuario(usuario), acao, String(detalhe).slice(0, 1000));
}

const reais = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

// Descreve o que mudou entre dois objetos, ex: 'preço: R$ 10,00 → R$ 12,00; nome: "A" → "B"'.
// campos: [[chave, rotulo, formatar?]]
function descreverMudancas(antes, depois, campos) {
  return campos
    .filter(([chave]) => String(antes[chave] ?? '') !== String(depois[chave] ?? ''))
    .map(([chave, rotulo, formatar = v => `"${v ?? ''}"`]) => `${rotulo}: ${formatar(antes[chave])} → ${formatar(depois[chave])}`)
    .join('; ');
}

module.exports = { registrar, nomeUsuario, descreverMudancas, reais };
