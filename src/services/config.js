const db = require('../db');

function getConfig(chave, padrao = '') {
  const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave);
  return row ? row.valor : padrao;
}

function setConfig(chave, valor) {
  db.prepare(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
  ).run(chave, String(valor));
}

function getAllConfig() {
  const rows = db.prepare('SELECT chave, valor FROM config').all();
  const out = {};
  rows.forEach(r => (out[r.chave] = r.valor));
  return out;
}

module.exports = { getConfig, setConfig, getAllConfig };
