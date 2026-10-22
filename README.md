# Autoatendimento por QR Code — Cardápio de Bebidas

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

## 9. Identidade visual (nome, logo e cores)

Em **Configuração → Identidade visual** dá pra trocar o nome do restaurante,
enviar uma logo nova (ou voltar para a original) e escolher duas cores:

- **Cor principal**: topo das telas, títulos, preços e moldura dos QR codes.
- **Cor de destaque**: botão "Fazer pedido" do cliente.

Isso vale para o cardápio do cliente, os cartões de QR impressos das mesas, o
painel admin e a tela de login. O ticket térmico do bar mostra o nome do
restaurante no topo (a impressora é preto e branco, então só o nome).

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
- Múltiplos usuários admin, com senhas próprias.
