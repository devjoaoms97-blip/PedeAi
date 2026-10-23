# PedeAi — Autoatendimento por QR Code

Fluxo: cliente escaneia QR da mesa → escolhe bebidas → pedido é impresso
automaticamente na impressora do bar → barman prepara → garçom leva à mesa e
lança na comanda (isso continua manual, no outro sistema).

## Se você vem do mundo .NET: como isso funciona aqui

No .NET você compila tudo num `.exe` e clica pra rodar. Em Node.js é
parecido, só muda uma etapa: o **Node.js é tipo o ".NET Runtime"** — instala
uma vez no notebook (você já fez isso). Só que, diferente de compilar um
`.exe`, o "programa" fica sendo essa pasta de arquivos, e ele "roda" através
de um comando de terminal.

Pra não precisar decorar comando nenhum, já deixei dois atalhos prontos
nesta pasta:

- **`instalar.bat`** → dá duplo-clique **uma única vez**, na primeira vez que
  for usar (baixa as "dependências", equivalente aos pacotes NuGet do .NET).
  Precisa de internet nessa etapa.
- **`iniciar.bat`** → dá duplo-clique **toda vez que for ligar o sistema**
  (é o "play"). Abre uma janela preta de terminal — não feche ela, é ela que
  mantém o sistema no ar, igual deixar um `.exe` de servidor rodando em
  segundo plano. Pode minimizar a janela, só não fechar.

## 1. Pré-requisitos no notebook que vai servir de servidor

- Instalar o **Node.js** (versão 18 ou superior): https://nodejs.org (baixe a versão "LTS")
- O notebook precisa estar ligado na mesma rede Wi-Fi do restaurante, sempre que o
  sistema estiver em uso (é ele quem serve o cardápio e manda imprimir).

## 2. Instalação

Dê duplo-clique em **`instalar.bat`** (dentro da pasta do projeto). Ele
baixa tudo sozinho — só acompanhe até aparecer "Pronto!" no final.

<details>
<summary>Prefere fazer manualmente via terminal? (clique pra expandir)</summary>

Abra um terminal (Prompt de Comando / PowerShell no Windows, ou Terminal no Linux/Mac)
dentro da pasta do projeto e rode:

```
npm install
```
</details>

Copie o arquivo `.env.example` para `.env` e, se quiser, troque a senha inicial do
admin e o "segredo" de sessão (opcional — o sistema já funciona com os valores padrão):

```
copy .env.example .env      (Windows)
cp .env.example .env        (Linux/Mac)
```

## 3. Descobrir o IP deste notebook na rede local

- **Windows**: abra o Prompt de Comando → digite `ipconfig` → anote o "Endereço IPv4"
  (algo como `192.168.0.100`).
- **Linux**: no terminal, digite `ip a` ou `hostname -I`.
- **Mac**: Preferências do Sistema → Rede → veja o IP da conexão Wi-Fi.

Esse IP precisa ser **fixo** (não mudar sozinho). Se o roteador do restaurante
permitir, reserve um IP fixo para este notebook (configuração chamada
"DHCP reservation" ou "IP estático" no roteador) — assim o QR code nunca para de
funcionar depois de reiniciar o Wi-Fi.

## 4. Rodar o sistema

Dê duplo-clique em **`iniciar.bat`**. Vai abrir uma janela de terminal
mostrando a URL do sistema e a senha inicial do admin (usuário `admin`,
senha `admin123` por padrão — troque depois criando outro usuário ou
pedindo ajuste).

**Deixe essa janela aberta** (pode minimizar) — é ela que mantém o sistema
no ar, do mesmo jeito que um servidor .exe rodando em segundo plano. Se
fechar essa janela, o cardápio para de funcionar até você abrir de novo.

Se o sistema parar por algum erro, a própria janela religa ele sozinha depois
de 5 segundos. E se você abrir o `iniciar.bat` com o sistema já ligado, ele
avisa e não abre uma segunda cópia.

### Ligar sozinho junto com o Windows

Dê duplo-clique **uma vez** em **`ativar-inicio-automatico.bat`**. A partir daí,
sempre que o notebook ligar e alguém entrar no Windows, o sistema abre sozinho
com a janela minimizada na barra de tarefas. Para desfazer, use
**`desativar-inicio-automatico.bat`**.

Observação: o sistema só liga depois que alguém entra no usuário do Windows. Se
o notebook pede senha ao ligar, alguém precisa digitá-la (ou dá pra configurar
o Windows pra entrar automaticamente, se fizer sentido para vocês).

## 5. Primeiro acesso ao painel admin

No navegador do próprio notebook (ou de qualquer aparelho na mesma rede), acesse:

```
http://<IP_DO_NOTEBOOK>:3000/admin
```

Faça login e vá em **Configuração**:
- Preencha o **IP da impressora** do bar (essa V320L tem interface LAN — veja
  como descobrir o IP dela na própria página de Configuração do painel).
- Preencha o **endereço base**, que deve ser `http://<IP_DO_NOTEBOOK>:3000`
  (o mesmo IP que você usou para acessar o admin agora).
- Salve.

## 6. Gerar e imprimir os QR codes das mesas

Vá em **Mesas** — o sistema já cria 10 mesas de teste (Mesa 1 a Mesa 10), cada
uma com um QR code próprio (o código é aleatório e não aparece na URL, então
ninguém consegue "adivinhar" ou trocar a mesa manualmente).

- Cada mesa tem um botão **"Imprimir"** individual. Também dá pra marcar várias
  com os checkboxes e clicar em **"Imprimir selecionadas"**, ou usar
  **"Imprimir todas"** de uma vez.
- Isso abre uma página já formatada pra **folha A4 comum**, com 4 QR codes por
  página (tamanho ~8cm, grande o bastante pra escanear por baixo do vidro da
  mesa), com linha pontilhada pra recortar. Clique no botão "Imprimir" da
  página (ou Ctrl+P) e mande pra impressora normal (não a térmica — essa
  impressão é em papel comum A4).
- Para adicionar mais mesas: preencha o campo "Nova mesa" — não precisa mexer
  em código.
- Se um adesivo de QR se perder ou você desconfiar de uso indevido, clique em
  **"Gerar novo QR"** daquela mesa: o código antigo para de funcionar na hora.

## 7. Cadastrar o cardápio de bebidas

Vá em **Cardápio** para criar categorias (ex: "Bebidas", "Drinks") e itens
(nome, descrição, preço). Dá pra marcar um item como indisponível a qualquer
momento (ex: acabou o suco de laranja) sem precisar excluir.

### Opções configuráveis por item (ex: "com limão e gelo", "quantos copos")

Clique em **"Opções"** ao lado de qualquer item pra configurar perguntas que o
cliente responde antes de adicionar ao pedido. Três tipos de grupo:

- **Escolha única** (rádio) — ex: "Acompanhamento": com limão e gelo / só gelo / sem nada
- **Múltipla escolha** (checkbox) — cliente pode marcar mais de uma opção
- **Quantidade** (contador) — ex: "Quantos copos?", com mínimo e máximo definidos por você

Cada grupo pode ser marcado como **obrigatório** ou não. Tudo isso é por item —
se 5 bebidas usam a mesma pergunta, configure em cada uma (mantém simples de
mexer, sem grupos compartilhados escondidos). Itens sem nenhuma opção
continuam funcionando do jeito simples (botão +/- direto), sem etapa extra
pro cliente.

O texto das opções escolhidas aparece no ticket impresso e no histórico de
pedidos, junto com a quantidade e a observação livre.

### Tela inicial em grade de categorias, com ícones

O cliente agora vê primeiro uma **grade de categorias** (ex: Cervejas, Sucos,
Chopp, Caipirinhas...) — cada uma vira um "botão" com ícone. Ao tocar, abre
a lista de itens daquela categoria, com um botão "← Todas as categorias"
pra voltar. O carrinho vale entre categorias — dá pra pegar itens de vários
grupos e fechar o pedido de uma vez só (o botão "Fazer pedido" fica sempre
fixo embaixo).

**Imagens (ícones):** tanto categoria quanto item podem ter uma imagem
pequena. No formulário de nova categoria/item (ou na edição), tem um campo
de upload de arquivo — escolhe a foto do computador e pronto, o sistema
corta em quadrado e redimensiona sozinho (não precisa a foto já vir
quadrada nem em tamanho específico). Categoria ou item sem imagem mostra um
ícone genérico no lugar, sem quebrar o layout. Pra trocar ou remover uma
imagem depois, use os botões "Trocar ícone" / "Remover ícone" na tela de
Cardápio.

## 8. Acompanhar pedidos

Em **Pedidos**, você vê o histórico de tudo que foi pedido, e se algum pedido
teve problema pra imprimir (impressora desligada, sem papel, etc.) aparece
destacado com opção de **reimprimir manualmente**.

### Cancelar pedido

O gerente pode cancelar um pedido em **Pedidos → Cancelar pedido**. É obrigatório
escrever o motivo (ex: "cliente desistiu", "pedido duplicado"). O pedido
cancelado:

- sai do painel do bar e dos relatórios (o relatório avisa quantos ficaram de fora);
- continua no histórico, riscado, mostrando **quem cancelou, quando e por quê**;
- aparece como "Cancelado" para o cliente, se ele estiver acompanhando pelo celular.

Funcionários não veem o botão de cancelar.

## 9. Identidade visual (nome, logo e cores)

Em **Configuração → Identidade visual** dá pra trocar o nome do restaurante,
enviar uma logo nova (ou voltar para a original) e escolher duas cores:

- **Cor principal**: topo das telas, títulos, preços e moldura dos QR codes.
- **Cor de destaque**: botão "Fazer pedido" do cliente.

Isso vale para o cardápio do cliente, os cartões de QR impressos das mesas, o
painel admin e a tela de login. O ticket térmico do bar mostra o nome do
restaurante no topo (a impressora é preto e branco, então só o nome).

### Modo noturno

O cardápio e o painel têm tema claro e escuro. Por padrão o tema segue o
aparelho (se o celular do cliente está no modo escuro, o cardápio abre escuro).
O botão de tema — no topo do cardápio e no rodapé do menu lateral do painel —
alterna entre **Automático → Claro → Escuro**, e cada aparelho lembra a sua
escolha. Útil para deixar o tablet do bar sempre no escuro. No modo escuro a cor
principal fica um pouco mais clara para continuar legível. A página de
impressão dos QR codes fica sempre no claro.

## 10. Backup automático

Uma vez por dia (e logo ao ligar, se já passou um dia desde o último), o sistema
copia o banco de dados e as imagens enviadas para a pasta escolhida em
**Configuração → Backup automático**. Cada cópia fica numa pasta com a data
(ex: `backup-2026-10-21_211543`) e só as últimas cópias são mantidas (14 por
padrão). Também tem o botão **"Fazer backup agora"**.

Se nenhuma pasta for escolhida, os backups vão para a pasta `backups` dentro
do projeto, no próprio notebook. Isso protege contra erro no banco, mas não se
o notebook quebrar ou sumir. Por isso, o recomendado é usar uma pasta do
**Google Drive ou OneDrive sincronizada** no notebook (ex:
`C:\Users\<usuário>\Google Drive\Backups Pedidos`) ou um pendrive. O Dashboard
avisa se o backup falhar ou se estiver indo para a pasta padrão.

**Para restaurar um backup:**
1. Feche a janela do sistema.
2. Copie o `database.sqlite` da pasta do backup para a pasta `data` do projeto,
   substituindo o atual (apague também `database.sqlite-shm` e
   `database.sqlite-wal` se existirem).
3. Copie a pasta `uploads` do backup para `src\public\img\uploads`.
4. Ligue o sistema de novo pelo `iniciar.bat`.

## 11. Usuários e perfis

Em **Usuários** (só para gerentes) dá pra criar logins para a equipe, cada um
com sua senha e um perfil:

- **Gerente**: acesso total ao painel.
- **Funcionário**: só vê o **Painel do bar** e a tela de **Pedidos** (e pode
  reimprimir). Não cancela pedidos nem vê o log de atividades. Ideal para o
  tablet ou computador do bar.

Também dá pra desativar um usuário (ele perde o acesso na hora, sem precisar
apagar), trocar a senha de alguém ou excluir. O sistema não deixa ficar sem
nenhum gerente ativo. Cada pessoa pode trocar a própria senha clicando no
nome dela, no canto do topo da tela.

O usuário `admin` que já existia virou gerente. Se ele ainda usa a senha
inicial `admin123`, o Dashboard mostra um aviso para trocar.

## 12. Painel do bar (pedidos na tela)

Em **Configuração → Para onde vão os pedidos novos** dá pra escolher:

- **Só impressora do bar**: como sempre foi.
- **Só painel na tela**: nada é impresso, os pedidos aparecem no painel.
- **Impressora e painel**: os dois. Se a impressora falhar, o pedido continua
  aparecendo no painel (com o aviso "Não foi impresso"), então nada se perde.

Com o painel ligado, aparece o menu **Painel do bar**. Abra num tablet ou no
computador do bar (o ideal é entrar com um usuário **Funcionário**, que já cai
direto no painel). Cada pedido vira um cartão grande com a mesa, os itens e há
quanto tempo está esperando. A borda fica amarela depois de 5 minutos e
vermelha depois de 10. Quando o garçom levar, toque em **"✓ Entregue"**. Se
tocar sem querer, use **"Desfazer"** em "Entregues recentemente".

O botão **"Começar preparo"** é opcional: serve só para o cliente ver no celular
que o bar já está fazendo o pedido. Dá para ir direto para "✓ Entregue".

### Chamar garçom

Com o painel ligado, o cardápio do cliente ganha o botão **"🙋 Chamar garçom"**.
O chamado aparece no topo do painel, em amarelo, com a mesa e há quanto tempo
chamou (toca o mesmo aviso de pedido novo). Quando alguém for até a mesa, toque
em **"Atendido"**. Se o cliente tocar várias vezes, continua sendo um chamado
só. Não existe "pedir a conta": a conta continua sendo fechada só no caixa.

### Cliente acompanha o pedido

Com o painel ligado, depois de fazer o pedido o cliente vê no celular em que pé
ele está: **Recebido → Em preparo → Entregue** (ou "Cancelado"). A tela se
atualiza sozinha. Se ele fechar e abrir o cardápio de novo, os pedidos das
últimas 12 horas feitos naquele celular continuam aparecendo no topo.

No modo **"Só impressora do bar"** não há painel para mudar o status, então o
acompanhamento e o "Chamar garçom" ficam escondidos.

- O painel se atualiza sozinho a cada 4 segundos.
- Toque em **"Ativar som"** uma vez ao abrir para ouvir um aviso a cada pedido
  novo (o navegador só libera som depois de um toque na tela).
- A tela tenta ficar sempre acesa enquanto o painel estiver aberto.

## 13. Relatórios

Em **Relatórios** (só para gerentes), escolha o período no topo (hoje, 7, 30
ou 90 dias, ou um intervalo de datas) e veja:

- **Resumo**: total de pedidos, itens vendidos, valor estimado e média por pedido.
- **Vendas por dia**: gráfico do valor de cada dia.
- **Horários de pico** e **dias da semana**: quando sai mais pedido, útil pra
  planejar a equipe.
- **Itens mais vendidos** e **por mesa**: os 10 primeiros no gráfico e a lista
  completa em "Ver tabela".

Passe o mouse (ou toque) numa coluna ou barra para ver o valor exato. Todo
gráfico tem um "Ver tabela" com os números.

Importante: os relatórios só enxergam os pedidos feitos pelo QR Code. O valor
é uma estimativa pelo preço dos itens na hora do pedido. O que foi lançado
direto na comanda ou ajustado no caixa não aparece. Pedidos cancelados ficam
de fora.

## 14. Log de atividades

Em **Atividades** (só para gerentes) fica registrado quem fez o quê no painel,
com data e hora:

- cardápio: item criado, preço/nome/descrição alterados (mostra o antes → depois),
  item marcado como indisponível, ícones, opções;
- mesas: criada, renomeada, desativada, QR gerado de novo;
- usuários: criado, alterado, senha trocada, excluído, e cada entrada no sistema;
- pedidos: cancelados (com o motivo) e reimpressos;
- configuração, identidade visual e backup.

Dá para filtrar por pessoa. Marcar pedido como entregue ou em preparo não entra
no log, para não encher a lista.

## Estrutura do projeto (caso queira mexer no código depois)

```
src/
  app.js              -> arquivo principal do servidor
  db.js               -> criação das tabelas do banco (SQLite)
  services/
    config.js         -> leitura/gravação das configurações (IP impressora etc.)
    printer.js         -> lógica de impressão ESC/POS via rede
    marca.js           -> nome, logo e cores do restaurante (usados em todas as telas)
    backup.js          -> backup diário do banco e das imagens
    relatorios.js      -> consultas dos relatórios de vendas
    atividades.js      -> log de atividades (quem alterou o quê)
    datas.js           -> conversão das datas do banco (UTC) para o horário local
  routes/
    customer.js        -> páginas que o cliente vê (cardápio + envio de pedido)
    admin.js            -> painel administrativo
  views/                -> páginas HTML (EJS)
  public/css/style.css   -> visual (simples e neutro, como combinado)
data/
  database.sqlite       -> banco de dados (criado automaticamente no 1º uso)
```

## Próximos passos possíveis (quando quiser)

- Adicionar categoria de "Porções" e a segunda impressora (cozinha), seguindo o
  mesmo padrão já construído.
