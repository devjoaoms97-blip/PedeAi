const { getAllConfig } = require('./config');

const COR_PRIMARIA_PADRAO = '#1b5e20';
const COR_DESTAQUE_PADRAO = '#c62828';
const LOGO_PADRAO = '/img/logo-pesqueiro.jpg';

function corValida(valor) {
  return /^#[0-9a-f]{6}$/i.test(valor || '');
}

// Mistura a cor com branco (pct = quanto de branco, 0 a 1). Usado pra gerar
// os tons claros de fundo/borda a partir da cor principal escolhida.
function clarear(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(c => Math.round(c + (255 - c) * pct));
  return '#' + canais.map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Identidade visual do restaurante (nome, logo e cores), lida da configuração.
 * Fica disponível em todas as views como `marca` (ver app.js).
 */
function getMarca() {
  const config = getAllConfig();
  const primaria = corValida(config.cor_primaria) ? config.cor_primaria : COR_PRIMARIA_PADRAO;
  const destaque = corValida(config.cor_destaque) ? config.cor_destaque : COR_DESTAQUE_PADRAO;

  return {
    nome: config.nome_restaurante || 'Restaurante',
    logo: config.logo_url || LOGO_PADRAO,
    corPrimaria: primaria,
    corPrimariaMedia: clarear(primaria, 0.15),
    corFundo: clarear(primaria, 0.9),
    corBorda: clarear(primaria, 0.85),
    corDestaque: destaque
  };
}

module.exports = { getMarca, corValida, LOGO_PADRAO };
