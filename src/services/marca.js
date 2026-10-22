const { getAllConfig } = require('./config');

const COR_PRIMARIA_PADRAO = '#1b5e20';
const COR_DESTAQUE_PADRAO = '#c62828';
const LOGO_PADRAO = '/img/logo-pesqueiro.jpg';

function corValida(valor) {
  return /^#[0-9a-f]{6}$/i.test(valor || '');
}

// Mistura a cor com outra (pct = quanto da outra, 0 a 1). Usado pra gerar os
// tons de fundo/borda a partir da cor principal escolhida.
function misturar(hex, alvo, pct) {
  const canais = h => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const destino = canais(alvo);
  return '#' + canais(hex)
    .map((c, i) => Math.round(c + (destino[i] - c) * pct))
    .map(c => c.toString(16).padStart(2, '0'))
    .join('');
}

const clarear = (hex, pct) => misturar(hex, '#ffffff', pct);
// Fundo do modo noturno (o mesmo de --fundo em style.css)
const escurecer = (hex, pct) => misturar(hex, '#0b0d10', pct);

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
    corDestaque: destaque,
    // Modo noturno: a cor principal fica mais clara pra continuar legível no
    // fundo escuro, e os tons de fundo/borda ficam escuros.
    noturno: {
      corPrimaria: clarear(primaria, 0.4),
      corPrimariaMedia: clarear(primaria, 0.55),
      corFundo: escurecer(primaria, 0.8),
      corBorda: escurecer(primaria, 0.65)
    }
  };
}

module.exports = { getMarca, corValida, LOGO_PADRAO };
