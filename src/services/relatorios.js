const db = require('../db');

// Os relatórios só enxergam pedidos feitos pelo QR Code. O valor é estimado
// pelo preço do item no momento do pedido (o que é cobrado no caixa pode diferir).
// Pedidos cancelados ficam de fora (só aparecem na contagem de cancelados).

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NO_PERIODO = `date(p.criado_em, 'localtime') BETWEEN @de AND @ate`;
const FILTRO = `${NO_PERIODO} AND p.status != 'cancelado'`;

function dataIso(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const PERIODOS = {
  hoje: { rotulo: 'Hoje', dias: 1 },
  '7d': { rotulo: '7 dias', dias: 7 },
  '30d': { rotulo: '30 dias', dias: 30 },
  '90d': { rotulo: '90 dias', dias: 90 }
};

// Converte os parâmetros da URL num intervalo de datas (padrão: últimos 7 dias)
function resolverPeriodo(query) {
  const valida = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  if (query.periodo === 'custom' && valida(query.de) && valida(query.ate)) {
    let [de, ate] = query.de <= query.ate ? [query.de, query.ate] : [query.ate, query.de];
    // Limita a 1 ano, pra o gráfico por dia continuar legível
    const limite = new Date(ate + 'T12:00:00');
    limite.setDate(limite.getDate() - 365);
    if (de < dataIso(limite)) de = dataIso(limite);
    return { chave: 'custom', de, ate };
  }
  const chave = PERIODOS[query.periodo] ? query.periodo : '7d';
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - (PERIODOS[chave].dias - 1));
  return { chave, de: dataIso(inicio), ate: dataIso(new Date()) };
}

function gerarRelatorio({ de, ate }) {
  const params = { de, ate };

  const totais = db.prepare(`
    SELECT COUNT(DISTINCT p.id) AS pedidos,
           COALESCE(SUM(pi.quantidade), 0) AS itens,
           COALESCE(SUM(pi.quantidade * pi.preco_unitario), 0) AS valor
    FROM pedidos p JOIN pedido_itens pi ON pi.pedido_id = p.id
    WHERE ${FILTRO}`).get(params);
  totais.ticketMedio = totais.pedidos ? totais.valor / totais.pedidos : 0;
  totais.cancelados = db
    .prepare(`SELECT COUNT(*) c FROM pedidos p WHERE ${NO_PERIODO} AND p.status = 'cancelado'`)
    .get(params).c;

  const porDiaDb = db.prepare(`
    SELECT date(p.criado_em, 'localtime') AS dia,
           COUNT(DISTINCT p.id) AS pedidos,
           SUM(pi.quantidade * pi.preco_unitario) AS valor
    FROM pedidos p JOIN pedido_itens pi ON pi.pedido_id = p.id
    WHERE ${FILTRO}
    GROUP BY dia`).all(params);
  // Preenche os dias sem pedido com zero, pra o gráfico não "pular" dias
  const porDia = [];
  for (let d = new Date(de + 'T12:00:00'); dataIso(d) <= ate; d.setDate(d.getDate() + 1)) {
    const dia = dataIso(d);
    const achado = porDiaDb.find(r => r.dia === dia);
    porDia.push({ dia, pedidos: achado ? achado.pedidos : 0, valor: achado ? achado.valor : 0 });
  }

  const porHoraDb = db.prepare(`
    SELECT CAST(strftime('%H', p.criado_em, 'localtime') AS INTEGER) AS hora, COUNT(*) AS pedidos
    FROM pedidos p WHERE ${FILTRO} GROUP BY hora`).all(params);
  const porHora = Array.from({ length: 24 }, (_, hora) => ({
    hora,
    pedidos: (porHoraDb.find(r => r.hora === hora) || { pedidos: 0 }).pedidos
  }));

  const porSemanaDb = db.prepare(`
    SELECT CAST(strftime('%w', p.criado_em, 'localtime') AS INTEGER) AS dia, COUNT(*) AS pedidos
    FROM pedidos p WHERE ${FILTRO} GROUP BY dia`).all(params);
  // Semana começando na segunda, que é como o restaurante pensa a semana
  const porDiaSemana = [1, 2, 3, 4, 5, 6, 0].map(dia => ({
    dia: DIAS_SEMANA[dia],
    pedidos: (porSemanaDb.find(r => r.dia === dia) || { pedidos: 0 }).pedidos
  }));

  const itens = db.prepare(`
    SELECT pi.nome_item AS nome, SUM(pi.quantidade) AS quantidade,
           SUM(pi.quantidade * pi.preco_unitario) AS valor
    FROM pedidos p JOIN pedido_itens pi ON pi.pedido_id = p.id
    WHERE ${FILTRO}
    GROUP BY pi.nome_item ORDER BY quantidade DESC, valor DESC`).all(params);

  const mesas = db.prepare(`
    SELECT m.nome AS nome, COUNT(DISTINCT p.id) AS pedidos,
           SUM(pi.quantidade * pi.preco_unitario) AS valor
    FROM pedidos p
    JOIN mesas m ON m.id = p.mesa_id
    JOIN pedido_itens pi ON pi.pedido_id = p.id
    WHERE ${FILTRO}
    GROUP BY m.id ORDER BY pedidos DESC, valor DESC`).all(params);

  return { totais, porDia, porHora, porDiaSemana, itens, mesas };
}

module.exports = { resolverPeriodo, gerarRelatorio, PERIODOS };
