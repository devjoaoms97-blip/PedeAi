const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { nanoid } = require('nanoid');
const db = require('../db');
const { getAllConfig, setConfig } = require('../services/config');
const { imprimirPedido } = require('../services/printer');
const { salvarImagemQuadrada, excluirImagem } = require('../services/uploads');

const router = express.Router();
router.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  }
});

function exigirLogin(req, res, next) {
  if (req.session && req.session.adminLogado) return next();
  return res.redirect('/admin/login');
}

// ---------- Login ----------
router.get('/login', (req, res) => {
  res.render('admin/login', { erro: null });
});

router.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE usuario = ?').get(usuario);
  if (!user || !bcrypt.compareSync(senha || '', user.senha_hash)) {
    return res.render('admin/login', { erro: 'Usuário ou senha inválidos.' });
  }
  req.session.adminLogado = true;
  req.session.adminUsuario = usuario;
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(exigirLogin);

// ---------- Dashboard ----------
router.get('/', (req, res) => {
  const totalMesas = db.prepare('SELECT COUNT(*) c FROM mesas WHERE ativa = 1').get().c;
  const totalItens = db.prepare('SELECT COUNT(*) c FROM itens').get().c;
  const pedidosHoje = db
    .prepare("SELECT COUNT(*) c FROM pedidos WHERE date(criado_em) = date('now')")
    .get().c;
  const pedidosComErro = db
    .prepare('SELECT COUNT(*) c FROM pedidos WHERE erro_impressao IS NOT NULL AND impresso = 0')
    .get().c;
  res.render('admin/dashboard', { totalMesas, totalItens, pedidosHoje, pedidosComErro });
});

// ---------- Mesas ----------
router.get('/mesas', async (req, res) => {
  const mesas = db.prepare('SELECT * FROM mesas ORDER BY id').all();
  const baseUrl = getAllConfig().base_url;

  const mesasComQr = await Promise.all(
    mesas.map(async m => {
      const url = `${baseUrl}/pedido/${m.token}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
      return { ...m, url, qr };
    })
  );

  res.render('admin/mesas', { mesas: mesasComQr, baseUrl });
});

// Página pronta pra imprimir (uma, várias ou todas) em folha A4, 4 por página
router.get('/mesas/imprimir', async (req, res) => {
  const baseUrl = getAllConfig().base_url;
  let mesas;

  if (req.query.todas === '1') {
    mesas = db.prepare('SELECT * FROM mesas WHERE ativa = 1 ORDER BY id').all();
  } else {
    const ids = [].concat(req.query.ids || []).map(id => parseInt(id, 10)).filter(Boolean);
    if (ids.length === 0) return res.redirect('/admin/mesas');
    const placeholders = ids.map(() => '?').join(',');
    mesas = db.prepare(`SELECT * FROM mesas WHERE id IN (${placeholders})`).all(...ids);
  }

  const mesasComQr = await Promise.all(
    mesas.map(async m => {
      const url = `${baseUrl}/pedido/${m.token}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 500 });
      return { ...m, qr };
    })
  );

  res.render('admin/imprimir-qr', { mesas: mesasComQr });
});

router.post('/mesas/nova', (req, res) => {
  const nome = (req.body.nome || '').trim();
  if (!nome) return res.redirect('/admin/mesas');
  db.prepare('INSERT INTO mesas (nome, token) VALUES (?, ?)').run(nome, nanoid(24));
  res.redirect('/admin/mesas');
});

router.post('/mesas/:id/rotacionar', (req, res) => {
  db.prepare('UPDATE mesas SET token = ? WHERE id = ?').run(nanoid(24), req.params.id);
  res.redirect('/admin/mesas');
});

router.post('/mesas/:id/toggle', (req, res) => {
  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(req.params.id);
  if (mesa) db.prepare('UPDATE mesas SET ativa = ? WHERE id = ?').run(mesa.ativa ? 0 : 1, mesa.id);
  res.redirect('/admin/mesas');
});

router.post('/mesas/:id/renomear', (req, res) => {
  const nome = (req.body.nome || '').trim();
  if (nome) db.prepare('UPDATE mesas SET nome = ? WHERE id = ?').run(nome, req.params.id);
  res.redirect('/admin/mesas');
});

// ---------- Cardápio ----------
router.get('/cardapio', (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY ordem, nome').all();
  const itens = db.prepare('SELECT * FROM itens ORDER BY categoria_id, ordem, nome').all();
  res.render('admin/cardapio', { categorias, itens });
});

router.post('/cardapio/categorias/nova', upload.single('imagem'), async (req, res) => {
  const nome = (req.body.nome || '').trim();
  if (!nome) return res.redirect('/admin/cardapio');
  const imagem = req.file ? await salvarImagemQuadrada(req.file.buffer) : null;
  db.prepare('INSERT INTO categorias (nome, imagem) VALUES (?, ?)').run(nome, imagem);
  res.redirect('/admin/cardapio');
});

router.post('/cardapio/categorias/:id/editar', upload.single('imagem'), async (req, res) => {
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!categoria) return res.redirect('/admin/cardapio');
  const nome = (req.body.nome || categoria.nome).trim();

  let imagem = categoria.imagem;
  if (req.file) {
    excluirImagem(categoria.imagem);
    imagem = await salvarImagemQuadrada(req.file.buffer);
  }

  db.prepare('UPDATE categorias SET nome = ?, imagem = ? WHERE id = ?').run(nome, imagem, categoria.id);
  res.redirect('/admin/cardapio');
});

router.post('/cardapio/categorias/:id/remover-imagem', (req, res) => {
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (categoria) {
    excluirImagem(categoria.imagem);
    db.prepare('UPDATE categorias SET imagem = NULL WHERE id = ?').run(categoria.id);
  }
  res.redirect('/admin/cardapio');
});

router.post('/cardapio/itens/novo', upload.single('imagem'), async (req, res) => {
  const { categoria_id, nome, descricao, preco } = req.body;
  if (categoria_id && nome && preco) {
    const imagem = req.file ? await salvarImagemQuadrada(req.file.buffer) : null;
    db.prepare(
      'INSERT INTO itens (categoria_id, nome, descricao, preco, imagem) VALUES (?, ?, ?, ?, ?)'
    ).run(categoria_id, nome.trim(), (descricao || '').trim(), parseFloat(preco.replace(',', '.')), imagem);
  }
  res.redirect('/admin/cardapio');
});

router.post('/cardapio/itens/:id/editar', upload.single('imagem'), async (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  if (!item) return res.redirect('/admin/cardapio');
  const { nome, descricao, preco } = req.body;

  let imagem = item.imagem;
  if (req.file) {
    excluirImagem(item.imagem);
    imagem = await salvarImagemQuadrada(req.file.buffer);
  }

  db.prepare('UPDATE itens SET nome = ?, descricao = ?, preco = ?, imagem = ? WHERE id = ?').run(
    nome.trim(),
    (descricao || '').trim(),
    parseFloat(String(preco).replace(',', '.')),
    imagem,
    req.params.id
  );
  res.redirect('/admin/cardapio');
});

router.post('/cardapio/itens/:id/remover-imagem', (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  if (item) {
    excluirImagem(item.imagem);
    db.prepare('UPDATE itens SET imagem = NULL WHERE id = ?').run(item.id);
  }
  res.redirect('/admin/cardapio');
});

router.post('/cardapio/itens/:id/toggle', (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  if (item) db.prepare('UPDATE itens SET disponivel = ? WHERE id = ?').run(item.disponivel ? 0 : 1, item.id);
  res.redirect('/admin/cardapio');
});

// ---------- Página de opções de um item específico ----------
router.get('/cardapio/itens/:id/opcoes', (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  if (!item) return res.redirect('/admin/cardapio');
  const grupos = db
    .prepare('SELECT * FROM opcao_grupos WHERE item_id = ? ORDER BY ordem, id')
    .all(item.id)
    .map(g => ({
      ...g,
      valores: db.prepare('SELECT * FROM opcao_valores WHERE grupo_id = ? ORDER BY ordem, id').all(g.id)
    }));
  res.render('admin/opcoes-item', { item, grupos });
});

router.post('/cardapio/itens/:id/opcoes/novo-grupo', (req, res) => {
  const { nome, tipo, obrigatorio, qtd_min, qtd_max } = req.body;
  if (!nome) return res.redirect(`/admin/cardapio/itens/${req.params.id}/opcoes`);
  db.prepare(
    `INSERT INTO opcao_grupos (item_id, nome, tipo, obrigatorio, qtd_min, qtd_max)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    req.params.id,
    nome.trim(),
    ['single', 'multiple', 'quantidade'].includes(tipo) ? tipo : 'single',
    obrigatorio ? 1 : 0,
    parseInt(qtd_min, 10) || 0,
    parseInt(qtd_max, 10) || 10
  );
  res.redirect(`/admin/cardapio/itens/${req.params.id}/opcoes`);
});

router.post('/cardapio/grupos/:grupoId/excluir', (req, res) => {
  const grupo = db.prepare('SELECT * FROM opcao_grupos WHERE id = ?').get(req.params.grupoId);
  if (grupo) {
    db.prepare('DELETE FROM opcao_valores WHERE grupo_id = ?').run(grupo.id);
    db.prepare('DELETE FROM opcao_grupos WHERE id = ?').run(grupo.id);
    return res.redirect(`/admin/cardapio/itens/${grupo.item_id}/opcoes`);
  }
  res.redirect('/admin/cardapio');
});

router.post('/cardapio/grupos/:grupoId/novo-valor', (req, res) => {
  const nome = (req.body.nome || '').trim();
  const grupo = db.prepare('SELECT * FROM opcao_grupos WHERE id = ?').get(req.params.grupoId);
  if (grupo && nome) {
    db.prepare('INSERT INTO opcao_valores (grupo_id, nome) VALUES (?, ?)').run(grupo.id, nome);
  }
  res.redirect(`/admin/cardapio/itens/${grupo.item_id}/opcoes`);
});

router.post('/cardapio/valores/:valorId/excluir', (req, res) => {
  const valor = db.prepare('SELECT * FROM opcao_valores WHERE id = ?').get(req.params.valorId);
  if (valor) {
    const grupo = db.prepare('SELECT * FROM opcao_grupos WHERE id = ?').get(valor.grupo_id);
    db.prepare('DELETE FROM opcao_valores WHERE id = ?').run(valor.id);
    return res.redirect(`/admin/cardapio/itens/${grupo.item_id}/opcoes`);
  }
  res.redirect('/admin/cardapio');
});

// ---------- Pedidos (histórico + reimpressão manual) ----------
router.get('/pedidos', (req, res) => {
  const pedidos = db
    .prepare(
      `SELECT p.*, m.nome AS mesa_nome FROM pedidos p
       JOIN mesas m ON m.id = p.mesa_id
       ORDER BY p.id DESC LIMIT 100`
    )
    .all();
  const pedidosComItens = pedidos.map(p => ({
    ...p,
    itens: db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(p.id)
  }));
  res.render('admin/pedidos', { pedidos: pedidosComItens });
});

router.post('/pedidos/:id/reimprimir', async (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(pedido.mesa_id);
  const itens = db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(pedido.id);
  try {
    await imprimirPedido({
      mesaNome: mesa.nome,
      itens,
      pedidoId: pedido.id,
      criadoEm: pedido.criado_em
    });
    db.prepare('UPDATE pedidos SET impresso = 1, erro_impressao = NULL WHERE id = ?').run(pedido.id);
  } catch (err) {
    db.prepare('UPDATE pedidos SET erro_impressao = ? WHERE id = ?').run(err.message, pedido.id);
  }
  res.redirect('/admin/pedidos');
});

// ---------- Configuração ----------
router.get('/config', (req, res) => {
  res.render('admin/config', { config: getAllConfig(), salvo: req.query.salvo === '1' });
});

router.post('/config', (req, res) => {
  const { printer_ip, printer_port, base_url, nome_restaurante } = req.body;
  setConfig('printer_ip', (printer_ip || '').trim());
  setConfig('printer_port', (printer_port || '9100').trim());
  setConfig('base_url', (base_url || '').trim().replace(/\/$/, ''));
  setConfig('nome_restaurante', (nome_restaurante || 'Restaurante').trim());
  res.redirect('/admin/config?salvo=1');
});

module.exports = router;
