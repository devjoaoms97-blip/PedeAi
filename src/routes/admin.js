const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { nanoid } = require('nanoid');
const db = require('../db');
const { getAllConfig, setConfig, usaTela, MODOS_PEDIDOS } = require('../services/config');
const { imprimirPedido } = require('../services/printer');
const { salvarImagemQuadrada, excluirImagem } = require('../services/uploads');
const { corValida, LOGO_PADRAO } = require('../services/marca');
const { fazerBackup, statusBackup } = require('../services/backup');
const { formatarDataHora } = require('../services/datas');

const router = express.Router();
router.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  }
});

const PERFIS = { gerente: 'Gerente', funcionario: 'Funcionário' };

// O que o perfil "funcionário" pode acessar; todo o resto é só do gerente.
const ROTAS_FUNCIONARIO = [
  /^\/pedidos$/,
  /^\/pedidos\/\d+\/reimprimir$/,
  /^\/painel(\/dados|\/\d+\/(entregue|reabrir))?$/,
  /^\/minha-senha$/
];

// Recarrega o usuário do banco a cada requisição, pra que desativar alguém
// ou trocar o perfil valha na hora (sem esperar a sessão expirar).
function exigirLogin(req, res, next) {
  const id = req.session && req.session.usuarioId;
  const usuario = id && db.prepare('SELECT * FROM admin_users WHERE id = ? AND ativo = 1').get(id);
  if (!usuario) {
    if (req.session) req.session.usuarioId = null;
    return res.redirect('/admin/login');
  }
  req.usuario = usuario;
  res.locals.usuario = { ...usuario, nomeExibicao: usuario.nome || usuario.usuario, ehGerente: usuario.perfil === 'gerente' };
  res.locals.perfis = PERFIS;
  res.locals.painelAtivo = usaTela();
  next();
}

function exigirPerfilPermitido(req, res, next) {
  if (req.usuario.perfil === 'gerente') return next();
  if (ROTAS_FUNCIONARIO.some(rx => rx.test(req.path))) return next();
  if (req.method === 'GET' && req.path === '/') return res.redirect(usaTela() ? '/admin/painel' : '/admin/pedidos');
  res.status(403).render('admin/sem-permissao');
}

// ---------- Login ----------
router.get('/login', (req, res) => {
  res.render('admin/login', { erro: null });
});

router.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE usuario = ? AND ativo = 1').get((usuario || '').trim());
  if (!user || !bcrypt.compareSync(senha || '', user.senha_hash)) {
    return res.render('admin/login', { erro: 'Usuário ou senha inválidos.' });
  }
  req.session.regenerate(() => {
    req.session.usuarioId = user.id;
    req.session.senhaPadrao = senha === 'admin123';
    res.redirect('/admin');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(exigirLogin);
router.use(exigirPerfilPermitido);

// ---------- Minha senha (qualquer perfil) ----------
router.get('/minha-senha', (req, res) => {
  res.render('admin/minha-senha', { erro: null, salvo: req.query.salvo === '1' });
});

router.post('/minha-senha', (req, res) => {
  const { senha_atual, senha_nova, senha_confirma } = req.body;
  const erro = !bcrypt.compareSync(senha_atual || '', req.usuario.senha_hash)
    ? 'Senha atual incorreta.'
    : validarSenha(senha_nova, senha_confirma);
  if (erro) return res.render('admin/minha-senha', { erro, salvo: false });

  db.prepare('UPDATE admin_users SET senha_hash = ? WHERE id = ?').run(bcrypt.hashSync(senha_nova, 10), req.usuario.id);
  req.session.senhaPadrao = false;
  res.redirect('/admin/minha-senha?salvo=1');
});

function validarSenha(senha, confirma) {
  if (!senha || senha.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (senha !== confirma) return 'A confirmação não confere com a senha nova.';
  return null;
}

// ---------- Usuários (só gerente) ----------
function gerentesAtivos(excetoId = 0) {
  return db
    .prepare("SELECT COUNT(*) c FROM admin_users WHERE perfil = 'gerente' AND ativo = 1 AND id != ?")
    .get(excetoId).c;
}

function voltarUsuarios(res, msg, erro = false) {
  res.redirect(`/admin/usuarios?${erro ? 'erro' : 'msg'}=${encodeURIComponent(msg)}`);
}

router.get('/usuarios', (req, res) => {
  const usuarios = db.prepare('SELECT id, usuario, nome, perfil, ativo FROM admin_users ORDER BY ativo DESC, perfil, usuario').all();
  res.render('admin/usuarios', { usuarios, msg: req.query.msg || null, erro: req.query.erro || null });
});

router.post('/usuarios/novo', (req, res) => {
  const usuario = (req.body.usuario || '').trim().toLowerCase();
  const nome = (req.body.nome || '').trim();
  const perfil = PERFIS[req.body.perfil] ? req.body.perfil : 'funcionario';
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
    return voltarUsuarios(res, 'Usuário deve ter de 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou _.', true);
  }
  const erroSenha = validarSenha(req.body.senha, req.body.senha_confirma);
  if (erroSenha) return voltarUsuarios(res, erroSenha, true);
  if (db.prepare('SELECT 1 FROM admin_users WHERE usuario = ?').get(usuario)) {
    return voltarUsuarios(res, `Já existe um usuário "${usuario}".`, true);
  }
  db.prepare('INSERT INTO admin_users (usuario, nome, perfil, senha_hash) VALUES (?, ?, ?, ?)')
    .run(usuario, nome || null, perfil, bcrypt.hashSync(req.body.senha, 10));
  voltarUsuarios(res, `Usuário "${usuario}" criado.`);
});

router.post('/usuarios/:id/editar', (req, res) => {
  const alvo = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.params.id);
  if (!alvo) return voltarUsuarios(res, 'Usuário não encontrado.', true);
  const perfil = PERFIS[req.body.perfil] ? req.body.perfil : alvo.perfil;
  const ativo = req.body.ativo === '1' ? 1 : 0;

  const deixaDeSerGerenteAtivo = alvo.perfil === 'gerente' && alvo.ativo && (perfil !== 'gerente' || !ativo);
  if (deixaDeSerGerenteAtivo && gerentesAtivos(alvo.id) === 0) {
    return voltarUsuarios(res, 'Precisa existir pelo menos um gerente ativo.', true);
  }
  if (alvo.id === req.usuario.id && !ativo) {
    return voltarUsuarios(res, 'Você não pode desativar o próprio usuário.', true);
  }

  db.prepare('UPDATE admin_users SET nome = ?, perfil = ?, ativo = ? WHERE id = ?')
    .run((req.body.nome || '').trim() || null, perfil, ativo, alvo.id);
  voltarUsuarios(res, `Usuário "${alvo.usuario}" atualizado.`);
});

router.post('/usuarios/:id/senha', (req, res) => {
  const alvo = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.params.id);
  if (!alvo) return voltarUsuarios(res, 'Usuário não encontrado.', true);
  const erroSenha = validarSenha(req.body.senha, req.body.senha_confirma);
  if (erroSenha) return voltarUsuarios(res, erroSenha, true);
  db.prepare('UPDATE admin_users SET senha_hash = ? WHERE id = ?').run(bcrypt.hashSync(req.body.senha, 10), alvo.id);
  voltarUsuarios(res, `Senha de "${alvo.usuario}" alterada.`);
});

router.post('/usuarios/:id/excluir', (req, res) => {
  const alvo = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.params.id);
  if (!alvo) return voltarUsuarios(res, 'Usuário não encontrado.', true);
  if (alvo.id === req.usuario.id) return voltarUsuarios(res, 'Você não pode excluir o próprio usuário.', true);
  if (alvo.perfil === 'gerente' && alvo.ativo && gerentesAtivos(alvo.id) === 0) {
    return voltarUsuarios(res, 'Precisa existir pelo menos um gerente ativo.', true);
  }
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(alvo.id);
  voltarUsuarios(res, `Usuário "${alvo.usuario}" excluído.`);
});

// ---------- Dashboard ----------
router.get('/', (req, res) => {
  const totalMesas = db.prepare('SELECT COUNT(*) c FROM mesas WHERE ativa = 1').get().c;
  const totalItens = db.prepare('SELECT COUNT(*) c FROM itens').get().c;
  const pedidosHoje = db
    .prepare("SELECT COUNT(*) c FROM pedidos WHERE date(criado_em, 'localtime') = date('now', 'localtime')")
    .get().c;
  const pedidosComErro = db
    .prepare('SELECT COUNT(*) c FROM pedidos WHERE erro_impressao IS NOT NULL AND impresso = 0')
    .get().c;
  res.render('admin/dashboard', {
    totalMesas,
    totalItens,
    pedidosHoje,
    pedidosComErro,
    backup: statusBackup(),
    senhaPadrao: !!req.session.senhaPadrao
  });
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
  const templates = db.prepare('SELECT * FROM opcao_templates ORDER BY ordem, id').all();
  res.render('admin/opcoes-item', { item, grupos, templates });
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

// Aplica um modelo de "opção padrão" num item: copia o grupo (e os valores)
// do modelo pra dentro do item. Depois disso o grupo é independente — editar
// o modelo não muda o que já foi aplicado, e editar num item não muda os outros.
router.post('/cardapio/itens/:id/opcoes/aplicar-padrao', (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  const template = db.prepare('SELECT * FROM opcao_templates WHERE id = ?').get(req.body.template_id);
  if (item && template) {
    const grupoId = db
      .prepare(
        `INSERT INTO opcao_grupos (item_id, nome, tipo, obrigatorio, qtd_min, qtd_max)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(item.id, template.nome, template.tipo, template.obrigatorio, template.qtd_min, template.qtd_max)
      .lastInsertRowid;

    const valoresTemplate = db
      .prepare('SELECT * FROM opcao_template_valores WHERE template_id = ? ORDER BY ordem, id')
      .all(template.id);
    const insertValor = db.prepare('INSERT INTO opcao_valores (grupo_id, nome, ordem) VALUES (?, ?, ?)');
    valoresTemplate.forEach((v, i) => insertValor.run(grupoId, v.nome, i));
  }
  res.redirect(`/admin/cardapio/itens/${req.params.id}/opcoes`);
});

// ---------- Opções padrão (modelos reutilizáveis) ----------
router.get('/opcoes-padrao', (req, res) => {
  const templates = db
    .prepare('SELECT * FROM opcao_templates ORDER BY ordem, id')
    .all()
    .map(t => ({
      ...t,
      valores: db.prepare('SELECT * FROM opcao_template_valores WHERE template_id = ? ORDER BY ordem, id').all(t.id)
    }));
  res.render('admin/opcoes-padrao', { templates });
});

router.post('/opcoes-padrao/novo', (req, res) => {
  const { nome, tipo, obrigatorio, qtd_min, qtd_max } = req.body;
  if (!nome) return res.redirect('/admin/opcoes-padrao');
  db.prepare(
    `INSERT INTO opcao_templates (nome, tipo, obrigatorio, qtd_min, qtd_max)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    nome.trim(),
    ['single', 'multiple', 'quantidade'].includes(tipo) ? tipo : 'single',
    obrigatorio ? 1 : 0,
    parseInt(qtd_min, 10) || 0,
    parseInt(qtd_max, 10) || 10
  );
  res.redirect('/admin/opcoes-padrao');
});

router.post('/opcoes-padrao/:id/excluir', (req, res) => {
  db.prepare('DELETE FROM opcao_template_valores WHERE template_id = ?').run(req.params.id);
  db.prepare('DELETE FROM opcao_templates WHERE id = ?').run(req.params.id);
  res.redirect('/admin/opcoes-padrao');
});

router.post('/opcoes-padrao/:id/novo-valor', (req, res) => {
  const nome = (req.body.nome || '').trim();
  const template = db.prepare('SELECT * FROM opcao_templates WHERE id = ?').get(req.params.id);
  if (template && nome) {
    db.prepare('INSERT INTO opcao_template_valores (template_id, nome) VALUES (?, ?)').run(template.id, nome);
  }
  res.redirect('/admin/opcoes-padrao');
});

router.post('/opcoes-padrao/valores/:valorId/excluir', (req, res) => {
  db.prepare('DELETE FROM opcao_template_valores WHERE id = ?').run(req.params.valorId);
  res.redirect('/admin/opcoes-padrao');
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
    criado_em_local: formatarDataHora(p.criado_em),
    itens: db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(p.id)
  }));
  res.render('admin/pedidos', { pedidos: pedidosComItens });
});

// ---------- Painel do bar (pedidos em tempo real) ----------
router.get('/painel', (req, res) => {
  res.render('admin/painel');
});

// Consultado pela tela do painel a cada poucos segundos. Mostra só pedidos das
// últimas 12h, pra pedidos antigos nunca marcados como entregues não poluírem a tela.
router.get('/painel/dados', (req, res) => {
  const buscar = (status, ordem, limite) =>
    db.prepare(
      `SELECT p.id, p.status, p.criado_em, p.entregue_em, p.impresso, p.erro_impressao, m.nome AS mesa_nome
       FROM pedidos p JOIN mesas m ON m.id = p.mesa_id
       WHERE p.status = ? AND p.criado_em >= datetime('now', '-12 hours')
       ORDER BY ${ordem} LIMIT ${limite}`
    ).all(status);
  const itensStmt = db.prepare(
    'SELECT quantidade, nome_item, opcoes_texto, observacao FROM pedido_itens WHERE pedido_id = ?'
  );
  const completar = p => ({ ...p, itens: itensStmt.all(p.id) });

  res.json({
    agora: new Date().toISOString(),
    novos: buscar('novo', 'p.id ASC', 100).map(completar),
    entregues: buscar('entregue', 'p.entregue_em DESC', 8).map(completar)
  });
});

router.post('/painel/:id/entregue', (req, res) => {
  db.prepare("UPDATE pedidos SET status = 'entregue', entregue_em = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.post('/painel/:id/reabrir', (req, res) => {
  db.prepare("UPDATE pedidos SET status = 'novo', entregue_em = NULL WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
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
  res.render('admin/config', {
    config: getAllConfig(),
    salvo: req.query.salvo === '1',
    logoPadrao: LOGO_PADRAO,
    backup: statusBackup(),
    backupMsg: req.query.backup || null
  });
});

router.post('/config/backup', (req, res) => {
  const pasta = (req.body.backup_pasta || '').trim();
  if (pasta) {
    if (!path.isAbsolute(pasta)) {
      return res.redirect('/admin/config?backup=' + encodeURIComponent('Informe o caminho completo da pasta, ex: C:\\Users\\Nome\\Google Drive\\Backups'));
    }
    try {
      fs.mkdirSync(pasta, { recursive: true });
      fs.accessSync(pasta, fs.constants.W_OK);
    } catch (err) {
      return res.redirect('/admin/config?backup=' + encodeURIComponent(`Não foi possível usar a pasta: ${err.message}`));
    }
  }
  setConfig('backup_pasta', pasta);
  const manter = Math.min(365, Math.max(1, parseInt(req.body.backup_manter, 10) || 14));
  setConfig('backup_manter', manter);
  res.redirect('/admin/config?salvo=1');
});

router.post('/config/backup/agora', async (req, res) => {
  try {
    const destino = await fazerBackup();
    res.redirect('/admin/config?backup=' + encodeURIComponent(`Backup feito: ${destino}`));
  } catch (err) {
    res.redirect('/admin/config?backup=' + encodeURIComponent(`Falha no backup: ${err.message}`));
  }
});

router.post('/config', (req, res) => {
  const { printer_ip, printer_port, base_url, modo_pedidos } = req.body;
  if (MODOS_PEDIDOS.includes(modo_pedidos)) setConfig('modo_pedidos', modo_pedidos);
  setConfig('printer_ip', (printer_ip || '').trim());
  setConfig('printer_port', (printer_port || '9100').trim());
  setConfig('base_url', (base_url || '').trim().replace(/\/$/, ''));
  res.redirect('/admin/config?salvo=1');
});

router.post('/config/marca', upload.single('logo'), async (req, res) => {
  const { nome_restaurante, cor_primaria, cor_destaque, restaurar_logo } = req.body;
  setConfig('nome_restaurante', (nome_restaurante || '').trim() || 'Restaurante');
  if (corValida(cor_primaria)) setConfig('cor_primaria', cor_primaria);
  if (corValida(cor_destaque)) setConfig('cor_destaque', cor_destaque);

  const logoAtual = getAllConfig().logo_url;
  if (req.file) {
    excluirImagem(logoAtual);
    setConfig('logo_url', await salvarImagemQuadrada(req.file.buffer));
  } else if (restaurar_logo === '1') {
    excluirImagem(logoAtual);
    setConfig('logo_url', LOGO_PADRAO);
  }

  res.redirect('/admin/config?salvo=1');
});

module.exports = router;
