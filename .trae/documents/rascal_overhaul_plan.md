# Plano de Melhoria e Refatoração - Rascal Bot

Este plano detalha as melhorias visuais, funcionais e estruturais solicitadas para o Rascal Bot, focando em um design mais "clean", um sistema de moderação profissional e uma economia mais envolvente.

## 1. Resumo das Alterações

As mudanças abrangem desde a correção de espaçamentos em comandos até a implementação de um sistema rotativo de cargos para os rankings mensais. O objetivo é tornar o bot mais profissional, alinhado à estética "Pepe/Peepo" e com uma interface de usuário impecável.

## 2. Análise do Estado Atual

- **Moderação**: O comando `/punir` existe mas não segue o layout específico solicitado. Não há um comando `/modlog`.
- **Economia**: O histórico de `/transações` é funcional, mas falta o polimento visual e os emojis de profissão.
- **Rankings**: O sistema mensal publica o leaderboard, mas não gerencia a atribuição e remoção automática de cargos.
- **Interface**: Muitos comandos possuem textos aglomerados e repetem excessivamente informações de rodapé e autor.
- **Memes**: Estão vindo de fontes genéricas que incluem notícias.

## 3. Mudanças Propostas

### 3.1. Interface e Identidade Visual (Clean UI)
- **Global**: Revisar `utils/embedStyle.ts` para padronizar o `setBrandFooter`. Remover repetições do nome do bot e ícone em cada comando.
- **Espaçamentos**: Ajustar os `\n` em todos os comandos principais (ex: `daily`, `work`, `rank`, `loja`) para evitar textos "grudados".
- **Emojis**: Padronizar o uso de emojis personalizados do servidor onde combinam, e usar emojis padrão do Discord onde não há correspondente customizado de qualidade.

### 3.2. Moderação e Logs
- **[punir.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/punir.ts)**: Refatorar o Embed para o layout exato da imagem:
  - Autor: `User • Tipo(a)`
  - Thumbnail: GIF do Pepe correspondente à punição.
  - Campos inline: Tag, ID, Staff.
  - Campos bloco: Motivo, Data formatada.
  - Rodapé: `Driscord Brasil™ • Central de Moderação` com ícone Peepo Police.
- **[modlog.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/modlog.ts) (Novo)**: Criar comando para exibir o histórico de punições de um usuário de forma elegante.
- **[ticket.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/ticket.ts)**: Melhorar os logs de quando um ticket é assumido ou fechado pela staff.

### 3.3. Economia e Profissões
- **[transacoes.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/transacoes.ts)** e **[transactionHistory.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/utils/transactionHistory.ts)**:
  - Layout profissional conforme a segunda imagem.
  - Thumbnail dinâmica com o avatar do usuário.
  - Mapeamento de emojis para cada trabalho no `/work` (ex: 💻 para Técnico, 🛍️ para Vendedor).
  - Paginação clara: `Página X de Y | Quantidade de Transações (Z)`.
- **[loja.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/loja.ts)**: Overhaul visual nas categorias e botões.

### 3.4. Rankings Mensais e Cargos Rotativos
- **[db.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/utils/db.ts)**: Criar tabela `monthly_role_assignments` para rastrear quem deve ter qual cargo e quando expira.
- **[monthlyTop.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/utils/monthlyTop.ts)**:
  - Implementar lógica para identificar o Top 1 de Mensagens e Top 1 de Voz.
  - Atribuir o cargo de prestígio por 30 dias.
  - Remover automaticamente o cargo do vencedor do mês anterior (sistema de cadeia).

### 3.5. VIPs e Informações
- **[info.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/info.ts)**: Adicionar subcomando `/info cargos`.
- **Benefícios Criativos**:
  - **Star VIP**: Bônus de 1.2x no Daily, -50% de taxa de inatividade.
  - **Elite VIP**: Bônus de 1.5x no Daily, -75% de taxa, badge exclusiva no perfil.
  - **Super VIP**: Bônus de 2.0x no Daily, Isenção total de taxas, acesso prioritário.

### 3.6. Diversão e Jogos
- **[meme.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/meme.ts)**: Mudar fontes para `r/diretozap`, `r/HUEstation` e `r/eu_nvr`.
- **Minigames**: Revisar e equilibrar as recompensas/perdas em `apostar.ts` e `roletarussa.ts`.

## 4. Decisões e Premissas

- **Thumbnail do /transações**: Será o avatar dinâmico do usuário, conforme solicitado.
- **Cargos de Ranking**: Foco inicial em Top Mensagens e Top Voz.
- **Português**: Revisão ortográfica em todas as strings de resposta.
- **Branch**: As alterações serão feitas em uma nova branch `feat/rascal-overhaul`.

## 5. Passos de Verificação

1. **Build e Testes**: Rodar `npm run build` e `npm test` para garantir que nada quebrou.
2. **Registro de Comandos**: Executar `npm run register` para atualizar as definições de slash commands.
3. **Validação Visual**: Testar `/punir`, `/transações` e `/loja` no Discord para confirmar a fidelidade aos prints.
4. **Simulação de Rank**: Forçar o fechamento do mês no banco para testar a atribuição/remoção de cargos.
