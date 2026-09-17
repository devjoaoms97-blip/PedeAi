const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- Criação das tabelas ----------
db.exec(`
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS mesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ativa INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  imagem TEXT
);

CREATE TABLE IF NOT EXISTS itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  preco REAL NOT NULL DEFAULT 0,
  disponivel INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  imagem TEXT
);

CREATE TABLE IF NOT EXISTS opcao_grupos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES itens(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'single', -- 'single' | 'multiple' | 'quantidade'
  obrigatorio INTEGER NOT NULL DEFAULT 0,
  qtd_min INTEGER NOT NULL DEFAULT 0,
  qtd_max INTEGER NOT NULL DEFAULT 10,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS opcao_valores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL REFERENCES opcao_grupos(id),
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mesa_id INTEGER NOT NULL REFERENCES mesas(id),
  status TEXT NOT NULL DEFAULT 'novo',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  impresso INTEGER NOT NULL DEFAULT 0,
  erro_impressao TEXT
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  item_id INTEGER NOT NULL REFERENCES itens(id),
  nome_item TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario REAL NOT NULL,
  observacao TEXT DEFAULT '',
  opcoes_texto TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL
);
`);

// ---------- Migração leve (para quem já tinha o banco criado antes desta versão) ----------
function colunaExiste(tabela, coluna) {
  return db.prepare(`PRAGMA table_info(${tabela})`).all().some(c => c.name === coluna);
}
if (!colunaExiste('pedido_itens', 'opcoes_texto')) {
  db.exec(`ALTER TABLE pedido_itens ADD COLUMN opcoes_texto TEXT DEFAULT ''`);
}
if (!colunaExiste('categorias', 'imagem')) {
  db.exec(`ALTER TABLE categorias ADD COLUMN imagem TEXT`);
}
if (!colunaExiste('itens', 'imagem')) {
  db.exec(`ALTER TABLE itens ADD COLUMN imagem TEXT`);
}

// ---------- Seed inicial (só roda se não existir nada) ----------
function seed() {
  const configDefaults = {
    printer_ip: '',
    printer_port: '9100',
    base_url: 'http://192.168.0.100:3000',
    nome_restaurante: 'Pesqueiro São José'
  };
  const insertConfig = db.prepare('INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)');
  for (const [chave, valor] of Object.entries(configDefaults)) {
    insertConfig.run(chave, valor);
  }

  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get().c;
  if (adminCount === 0) {
    const senhaPadrao = process.env.ADMIN_SENHA_INICIAL || 'admin123';
    const hash = bcrypt.hashSync(senhaPadrao, 10);
    db.prepare('INSERT INTO admin_users (usuario, senha_hash) VALUES (?, ?)').run('admin', hash);
    console.log('>> Usuário admin criado. Login: admin | Senha: ' + senhaPadrao + '  (troque depois!)');
  }

  const catCount = db.prepare('SELECT COUNT(*) AS c FROM categorias').get().c;
  if (catCount === 0) {
    const catId = db.prepare('INSERT INTO categorias (nome, ordem) VALUES (?, ?)').run('Bebidas', 0).lastInsertRowid;
    const exemplos = [
      ['Água Mineral', 'Sem gás, 500ml', 6.0],
      ['Refrigerante Lata', 'Coca-Cola, Guaraná, Fanta', 7.0],
      ['Cerveja Long Neck', 'Gelada', 10.0],
      ['Suco Natural', 'Peça o sabor na observação', 9.0]
    ];
    const insertItem = db.prepare('INSERT INTO itens (categoria_id, nome, descricao, preco, ordem) VALUES (?,?,?,?,?)');
    exemplos.forEach((it, i) => insertItem.run(catId, it[0], it[1], it[2], i));
  }

  const mesaCount = db.prepare('SELECT COUNT(*) AS c FROM mesas').get().c;
  if (mesaCount === 0) {
    const insertMesa = db.prepare('INSERT INTO mesas (nome, token) VALUES (?, ?)');
    for (let i = 1; i <= 10; i++) {
      insertMesa.run('Mesa ' + i, nanoid(24));
    }
    console.log('>> 10 mesas de teste criadas (Mesa 1 a Mesa 10), cada uma com token único.');
  }
}
seed();

module.exports = db;
