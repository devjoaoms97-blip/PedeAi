// O SQLite grava datas com datetime('now'), que é UTC ("2026-10-21 23:15:00").
// Estas funções convertem para o horário local do computador antes de mostrar.

function dataUtc(texto) {
  return new Date(String(texto).replace(' ', 'T') + 'Z');
}

function formatarDataHora(texto) {
  if (!texto) return '';
  return dataUtc(texto).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

module.exports = { dataUtc, formatarDataHora };
