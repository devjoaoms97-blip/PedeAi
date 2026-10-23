const express = require('express');
const db = require('../db');
const { imprimirPedido } = require('../services/printer');
const { usaImpressora, usaTela } = require('../services/config');

const router = express.Router();

// Middleware: resolve o token da URL para uma mesa ativa real
function carregarMesa(req, res, next) {
  const { token } = req.params;
  const mesa = db.prepare('SELECT * FROM mesas WHERE token = ? AND ativa = 1').get(token);
  if (!mesa) {
    return res.status(404).render('customer/nao-encontrado');
  }
  req.mesa = mesa;
  next();
}

// GET /pedido/:token -> mostra o cardápio
router.get('/pedido/:token', carregarMesa, (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY ordem, nome').all();
  const itens = db.prepare('SELECT * FROM itens WHERE disponivel = 1 ORDER BY ordem, nome').all();

  const grupoStmt = db.prepare('SELECT * FROM opcao_grupos WHERE item_id = ? ORDER BY ordem, id');
  const valorStmt = db.prepare('SELECT * FROM opcao_valores WHERE grupo_id = ? ORDER BY ordem, id');

  const itensComOpcoes = itens.map(it => ({
    ...it,
    grupos: grupoStmt.all(it.id).map(g => ({ ...g, valores: valorStmt.all(g.id) }))
  }));

  const categoriasComItens = categorias
    .map(cat => ({
      ...cat,
      itens: itensComOpcoes.filter(it => it.categoria_id === cat.id)
    }))
    .filter(cat => cat.itens.length > 0);

  res.render('customer/menu', {
    mesa: req.mesa,
    categorias: categoriasComItens,
    // Acompanhar o pedido e chamar o garçom dependem de alguém olhando o painel do bar
    painelAtivo: usaTela()
  });
});

// GET /pedido/:token/acompanhar?ids=1,2 -> status dos pedidos que este celular fez
// (os ids ficam guardados no próprio celular). Só devolve pedidos desta mesa e das
// últimas 12h, então trocar ids na URL não mostra pedido de outra mesa.
router.get('/pedido/:token/acompanhar', carregarMesa, (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map(id => parseInt(id, 10))
    .filter(Boolean)
    .slice(0, 20);

  const pedidos = ids.length === 0 ? [] : db
    .prepare(
      `SELECT id, status, criado_em FROM pedidos
       WHERE mesa_id = ? AND id IN (${ids.map(() => '?').join(',')}) AND criado_em >= datetime('now', '-12 hours')
       ORDER BY id DESC`
    )
    .all(req.mesa.id, ...ids);
  const itensStmt = db.prepare('SELECT quantidade, nome_item FROM pedido_itens WHERE pedido_id = ?');

  res.json({
    pedidos: pedidos.map(p => ({ ...p, itens: itensStmt.all(p.id) })),
    chamadoAberto: !!chamadoAberto(req.mesa.id)
  });
});

function chamadoAberto(mesaId) {
  return db
    .prepare("SELECT * FROM chamados WHERE mesa_id = ? AND atendido_em IS NULL AND criado_em >= datetime('now', '-12 hours')")
    .get(mesaId);
}

// POST /pedido/:token/chamar -> "Chamar garçom". Se a mesa já tem um chamado
// esperando, não cria outro (tocar várias vezes não enche o painel).
router.post('/pedido/:token/chamar', carregarMesa, (req, res) => {
  if (!usaTela()) return res.status(400).json({ erro: 'Chamar o garçom pelo cardápio não está disponível.' });
  if (!chamadoAberto(req.mesa.id)) {
    db.prepare('INSERT INTO chamados (mesa_id) VALUES (?)').run(req.mesa.id);
  }
  res.json({ ok: true });
});

// POST /pedido/:token -> recebe o carrinho e cria o pedido
router.post('/pedido/:token', carregarMesa, express.json(), async (req, res) => {
  const { itens } = req.body; // [{ item_id, quantidade, observacao }]

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio.' });
  }

  const itemIds = itens.map(i => i.item_id);
  const placeholders = itemIds.map(() => '?').join(',');
  const itensDb = db
    .prepare(`SELECT * FROM itens WHERE id IN (${placeholders}) AND disponivel = 1`)
    .all(...itemIds);

  if (itensDb.length === 0) {
    return res.status(400).json({ erro: 'Itens inválidos ou indisponíveis.' });
  }

  // Monta um texto legível das opções escolhidas (usado no ticket e no histórico),
  // validando contra os grupos/valores reais cadastrados no banco (nunca confia no que veio do cliente).
  const grupoStmt = db.prepare('SELECT * FROM opcao_grupos WHERE item_id = ?');
  const valorStmt = db.prepare('SELECT * FROM opcao_valores WHERE id = ? AND grupo_id = ?');

  function montarTextoOpcoes(itemId, opcoesEnviadas) {
    const grupos = grupoStmt.all(itemId);
    if (grupos.length === 0) return '';
    const partes = [];

    grupos.forEach(g => {
      const escolha = opcoesEnviadas ? opcoesEnviadas[g.id] : undefined;

      if (g.tipo === 'quantidade') {
        const n = parseInt(escolha, 10);
        if (!isNaN(n) && n >= g.qtd_min) {
          partes.push(`${g.nome}: ${Math.min(n, g.qtd_max)}`);
        }
        return;
      }

      const idsEscolhidos = Array.isArray(escolha) ? escolha : escolha != null ? [escolha] : [];
      const nomesValidos = idsEscolhidos
        .map(vid => valorStmt.get(parseInt(vid, 10), g.id))
        .filter(Boolean)
        .map(v => v.nome);

      if (nomesValidos.length > 0) {
        partes.push(`${g.nome}: ${nomesValidos.join(', ')}`);
      }
    });

    return partes.join(' | ');
  }

  const criarPedido = db.transaction(() => {
    const pedidoId = db
      .prepare('INSERT INTO pedidos (mesa_id, status) VALUES (?, ?)')
      .run(req.mesa.id, 'novo').lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO pedido_itens (pedido_id, item_id, nome_item, quantidade, preco_unitario, observacao, opcoes_texto)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    itens.forEach(pedidoItem => {
      const itemDb = itensDb.find(i => i.id === pedidoItem.item_id);
      if (!itemDb) return;
      const qtd = Math.max(1, parseInt(pedidoItem.quantidade, 10) || 1);
      const opcoesTexto = montarTextoOpcoes(itemDb.id, pedidoItem.opcoes);
      insertItem.run(
        pedidoId,
        itemDb.id,
        itemDb.nome,
        qtd,
        itemDb.preco,
        (pedidoItem.observacao || '').slice(0, 200),
        opcoesTexto
      );
    });

    return pedidoId;
  });

  const pedidoId = criarPedido();

  // Modo "só tela": o pedido aparece no painel do bar, sem imprimir
  if (!usaImpressora()) return res.json({ ok: true, pedidoId });

  const itensParaImpressao = db
    .prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?')
    .all(pedidoId);
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);

  try {
    await imprimirPedido({
      mesaNome: req.mesa.nome,
      itens: itensParaImpressao,
      pedidoId,
      criadoEm: pedido.criado_em
    });
    db.prepare('UPDATE pedidos SET impresso = 1 WHERE id = ?').run(pedidoId);
  } catch (err) {
    db.prepare('UPDATE pedidos SET erro_impressao = ? WHERE id = ?').run(err.message, pedidoId);
    // O pedido fica salvo mesmo se a impressão falhar - pode reimprimir pelo admin.
    // Com o painel do bar ligado, a equipe já vê o pedido na tela: não precisa assustar o cliente.
    if (usaTela()) return res.json({ ok: true, pedidoId });
    return res.json({
      ok: true,
      pedidoId,
      avisoImpressao: 'Pedido registrado, mas houve um problema ao imprimir. A equipe foi avisada.'
    });
  }

  res.json({ ok: true, pedidoId });
});

module.exports = router;
