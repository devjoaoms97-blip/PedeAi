const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const sharp = require('sharp');

const PASTA_UPLOADS = path.join(__dirname, '..', 'public', 'img', 'uploads');
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const TAMANHO_PX = 300; // ícone quadrado pequeno, leve pra carregar no celular

/**
 * Recebe o buffer de uma imagem enviada, corta em quadrado (centralizado),
 * redimensiona e salva como .webp. Retorna o caminho público (ex: /img/uploads/xxx.webp).
 */
async function salvarImagemQuadrada(buffer) {
  const nomeArquivo = `${randomUUID()}.webp`;
  const destino = path.join(PASTA_UPLOADS, nomeArquivo);

  await sharp(buffer)
    .resize(TAMANHO_PX, TAMANHO_PX, { fit: 'cover', position: 'centre' })
    .webp({ quality: 78 })
    .toFile(destino);

  return `/img/uploads/${nomeArquivo}`;
}

function excluirImagem(caminhoPublico) {
  if (!caminhoPublico || !caminhoPublico.startsWith('/img/uploads/')) return;
  const arquivo = path.join(PASTA_UPLOADS, path.basename(caminhoPublico));
  fs.unlink(arquivo, () => {}); // best-effort, ignora erro se não existir
}

module.exports = { salvarImagemQuadrada, excluirImagem };
