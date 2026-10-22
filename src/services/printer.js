const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');
const { getConfig } = require('./config');
const { formatarDataHora } = require('./datas');

/**
 * Imprime um pedido no formato de comanda para o bar.
 * Não lança erro pra fora sem necessidade: quem chama decide o que fazer
 * (ex: marcar pedido como "erro de impressão" pra reimprimir manualmente depois).
 */
async function imprimirPedido({ mesaNome, itens, pedidoId, criadoEm }) {
  const ip = getConfig('printer_ip', '');
  const port = getConfig('printer_port', '9100');

  if (!ip) {
    throw new Error('IP da impressora não configurado. Configure em /admin/config.');
  }

  const thermalPrinter = new ThermalPrinter({
    type: PrinterTypes.EPSON, // V320L segue conjunto de comandos ESC/POS padrão
    interface: `tcp://${ip}:${port}`,
    removeSpecialCharacters: false,
    options: { timeout: 5000 }
  });

  const conectado = await thermalPrinter.isPrinterConnected().catch(() => false);
  if (!conectado) {
    throw new Error(`Não foi possível conectar na impressora em ${ip}:${port}`);
  }

  thermalPrinter.alignCenter();
  thermalPrinter.bold(true);
  thermalPrinter.println(getConfig('nome_restaurante', 'Restaurante').toUpperCase());
  thermalPrinter.bold(false);
  thermalPrinter.drawLine();

  thermalPrinter.setTextDoubleHeight();
  thermalPrinter.bold(true);
  thermalPrinter.println('PEDIDO - BAR');
  thermalPrinter.bold(false);
  thermalPrinter.setTextNormal();

  thermalPrinter.setTextDoubleHeight();
  thermalPrinter.println(mesaNome.toUpperCase());
  thermalPrinter.setTextNormal();

  thermalPrinter.alignLeft();
  thermalPrinter.drawLine();
  thermalPrinter.println(`Pedido #${pedidoId}`);
  thermalPrinter.println(`Horário: ${formatarDataHora(criadoEm)}`);
  thermalPrinter.drawLine();

  itens.forEach(it => {
    thermalPrinter.bold(true);
    thermalPrinter.println(`${it.quantidade}x ${it.nome_item}`);
    thermalPrinter.bold(false);
    if (it.opcoes_texto) {
      thermalPrinter.println(`   ${it.opcoes_texto}`);
    }
    if (it.observacao) {
      thermalPrinter.println(`   obs: ${it.observacao}`);
    }
  });

  thermalPrinter.drawLine();
  thermalPrinter.alignCenter();
  thermalPrinter.println('Levar até a mesa após preparo');
  thermalPrinter.newLine();
  thermalPrinter.cut();

  await thermalPrinter.execute();
}

module.exports = { imprimirPedido };
