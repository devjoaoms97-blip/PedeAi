const fs = require('fs');
const path = require('path');
const db = require('../db');
const { getConfig, setConfig } = require('./config');

const PASTA_PADRAO = path.join(__dirname, '..', '..', 'backups');
const PASTA_UPLOADS = path.join(__dirname, '..', 'public', 'img', 'uploads');
const PREFIXO = 'backup-';
const INTERVALO_HORAS = 24;

function pastaBackup() {
  return getConfig('backup_pasta', '') || PASTA_PADRAO;
}

function carimbo(data = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}_${p(data.getHours())}${p(data.getMinutes())}${p(data.getSeconds())}`;
}

/**
 * Cria uma cópia completa: banco de dados (via API de backup do SQLite, segura
 * mesmo com o sistema em uso) + imagens enviadas (logo, ícones de itens/categorias).
 * Cada backup vira uma pasta "backup-AAAA-MM-DD_HHMMSS"; só as últimas N são mantidas.
 */
async function fazerBackup() {
  const raiz = pastaBackup();
  const destino = path.join(raiz, PREFIXO + carimbo());

  try {
    fs.mkdirSync(destino, { recursive: true });
    await db.backup(path.join(destino, 'database.sqlite'));
    if (fs.existsSync(PASTA_UPLOADS)) {
      fs.cpSync(PASTA_UPLOADS, path.join(destino, 'uploads'), { recursive: true });
    }
    limparAntigos(raiz);
    setConfig('backup_ultimo', new Date().toISOString());
    setConfig('backup_erro', '');
    return destino;
  } catch (err) {
    setConfig('backup_erro', `${new Date().toLocaleString('pt-BR')}: ${err.message}`);
    throw err;
  }
}

function limparAntigos(raiz) {
  const manter = Math.max(1, parseInt(getConfig('backup_manter', '14'), 10) || 14);
  const pastas = fs
    .readdirSync(raiz)
    .filter(nome => nome.startsWith(PREFIXO))
    .sort(); // o carimbo no nome ordena do mais antigo pro mais novo
  pastas.slice(0, Math.max(0, pastas.length - manter)).forEach(nome => {
    fs.rmSync(path.join(raiz, nome), { recursive: true, force: true });
  });
}

function backupAtrasado() {
  const ultimo = Date.parse(getConfig('backup_ultimo', ''));
  return isNaN(ultimo) || Date.now() - ultimo >= INTERVALO_HORAS * 60 * 60 * 1000;
}

// Confere de hora em hora (e logo ao ligar) se já passou um dia desde o último
// backup. Assim funciona mesmo se o notebook ficar desligado em alguns dias.
function agendarBackups() {
  const verificar = () => {
    if (!backupAtrasado()) return;
    fazerBackup()
      .then(destino => console.log(`>> Backup salvo em ${destino}`))
      .catch(err => console.error(`>> Falha no backup automático: ${err.message}`));
  };
  setTimeout(verificar, 10 * 1000);
  setInterval(verificar, 60 * 60 * 1000);
}

function statusBackup() {
  return {
    pasta: pastaBackup(),
    pastaPadrao: PASTA_PADRAO,
    usandoPastaPadrao: !getConfig('backup_pasta', ''),
    manter: getConfig('backup_manter', '14'),
    ultimo: getConfig('backup_ultimo', ''),
    erro: getConfig('backup_erro', ''),
    atrasado: backupAtrasado()
  };
}

module.exports = { fazerBackup, agendarBackups, statusBackup };
