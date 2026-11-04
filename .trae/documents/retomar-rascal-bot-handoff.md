# Plano: retomar o rascal-bot a partir dos chats (Codex + Claude)

## 1. Resumo

O usuário pediu que eu lesse os históricos de conversa com o **Codex** e com o **Claude** para entender o projeto e saber **como continuar**. Foco definido pelo usuário: (a) **concluir o trabalho em andamento**, (b) **levantar bugs e pendências conhecidas**, (c) **produzir um documento de handoff**.

Este plano entrega, em ordem:

1. Concluir e validar o refactor de `/transacoes` que está **pronto mas não commitado** no repositório.
2. Registrar (e ao menos validar) os bugs/pendências conhecidas apontadas nos chats.
3. Criar um documento de handoff em `docs/handoff.md` com estado atual, decisões, pendências priorizadas e onde retomar.

Nada de reescrita visual dos comandos nem correção "às cegas" do `/ship` neste passo — isso depende de decisões de design do usuário e fica no backlog documentado (ver §6).

---

## 2. Fontes consultadas (o que eu li)

**Codex** — `~/.codex/sessions/` (formato rollout JSONL, extraído com `python3`, sem usar `Read` em arquivos de até 90 MB):

- `2026/10/23/rollout-...01a16aaf...` — thread "Configure Discord Developer" (configuração inicial do portal/intents).
- `2026/10/24/rollout-2026-10-24T11-14-28-01a16e43...jsonl` — **thread principal** "Continue conversa do Copilot" (~90 MB), mais as continuações do mesmo `session_id` (`12-12-46`, `12-26-17`, `16-59-15`, `17-50-10`, `17-57-39`, `18-24-15`, `18-41-03`, `18-48-36`, `19-05-03`).
- `2026/10/25/rollout-2026-10-25T14-03-49-01a17404...` — thread "Create repository contributor guide".
- Threads de `guardian_review` (subagente de revisão de segurança automática) foram ignoradas por serem ruído.

**Claude** — dados locais do app Claude Desktop (`~/.config/Claude/IndexedDB/https_claude.ai_0.indexeddb.leveldb/000003.log`, LevelDB), conforme escolha do usuário. A conversa está fragmentada (serialização interna do Chrome), mas foram recuperados trechos reais:

- Pedido do usuário: *"Leia o AGENTS.MD no vscode e faça o que se pede, melhore, teste, revise meu código"*.
- Resposta/entrega do Claude: *"Entreguei 3 arquivos: `utils/transactionHistory.ts` (novo), `test/transactionHistory.test.ts` (novo) e `commands/transacoes.ts`"*; commits sugeridos `fix: handle malformed history button ids` e `refactor: extract transaction history formatting`; instrução *"Pelo AGENTS.md, adicione `utils/transactionHistory.ts` ao `tsconfig.strict.json`"*.
- Limitação registrada: no plano gratuito o Claude Desktop não acessa arquivos locais do VS Code — é preciso anexar os arquivos no chat.

**Repositório** — `git log`, `git status`, `package.json`, `tsconfig.json`, `tsconfig.strict.json`, `docs/linux-24h.md`, `AGENTS.md`, `.vscode/AGENTS.MD`, `commands/transacoes.ts`, `utils/transactionHistory.ts`, `test/transactionHistory.test.ts`.

---

## 3. Estado atual do projeto (verificado)

- Bot **Discord.js v14 + TypeScript**, ~47 slash commands em `commands/`, eventos em `events/`, loaders em `handlers/`, núcleo em `core/`, lógica compartilhada em `utils/`, contratos em `types/`, testes em `test/` (`node:test`), dados persistentes em `data/` (SQLite via `better-sqlite3` + JSONs).
- Scripts: `npm run build` (limpa `dist/`, compila, roda `typecheck:strict`), `npm test`, `npm start`, `npm run register`, `npm run security:check`, `npm run service:install`.
- Git: branch `main` sincronizada com `origin/main`, último commit `1ce5957 test: validate slash command registry`.
- **Trabalho não commitado** (`git status`):
  - `M commands/transacoes.ts` (−138/+23 linhas): passou a usar `utils/transactionHistory.ts`, com tratamento de botão malformado (`"Este botão expirou. Use /transacoes novamente."`) e checagem de dono do histórico.
  - `?? utils/transactionHistory.ts` (novo, 206 linhas): estilos de transação, formatação, paginação e IDs de botão (`transacoes|next|<owner>|<page>`), tudo em funções puras.
  - `?? test/transactionHistory.test.ts` (novo): 19 testes cobrindo `safeNote`, estilos, preposições, paginação, IDs de botão e `describeTransaction`.
  - `?? AGENTS.md` (novo, 2464 bytes): guia de contribuição criado na thread de 25/10 que foi **interrompida** por `Fatal error: application network permission was revoked`.
  - `?? .vscode/AGENTS.MD` (1756 bytes): prompt pessoal de revisão multi-agente do usuário — **não** é a documentação do repositório.

**Verificações já feitas neste plano (somente leitura):**

- `npx tsc --noEmit --strict utils/transactionHistory.ts` → **passa** (o util é strict-clean de forma isolada).
- `utils/transactionHistory.ts` **não está** no `include` de `tsconfig.strict.json` (confirmado lendo o arquivo).
- `events/interactionCreate.ts` já roteia botões por `command.handleButton` a partir do prefixo do `customId` (`transacoes|...`), então o novo formato de ID continua resolvendo o comando.

---

## 4. Decisões e pendências registradas nos chats

**Decisões/convenções (a manter):**

- Preservar os **47 comandos** e os **nomes slash** atuais; **não** quebrar o schema do SQLite (compatibilidade retroativa).
- Emojis vindos do **Discord Developer** (163 emojis carregados na aplicação) com **cache** para não travar o bot; cores **aleatórias** nos embeds.
- Seguir `AGENTS.md`: 2 espaços, aspas duplas, ponto e vírgula; testes com `node:test` + `node:assert/strict`; Conventional Commits.
- `.vscode/AGENTS.MD` registra intenção futura de **migrar de SQLite para PostgreSQL/MySQL**.

**Pendências / bugs conhecidos (backlog):**

| # | Item | Origem | Situação |
|---|------|--------|----------|
| 1 | `/ship`: badge com identidade do Rascal + **erro 10062** (interação desconhecida/expirada) | Codex 24/10 | Canvas entregue; badge e erro pendentes |
| 2 | Revisão visual de `/menu`, `/userinfo`, `/ping`, `/botinfo`, `/serverinfo` ("tudo muito feio"); `/streak`; `/daily` notificando "trabalhar" (deveria ser botão de notificar por ação) | Codex 24/10 | Iniciado, não concluído |
| 3 | Confirmar no **Discord Developer Portal** os intents *Server Members* e *Message Content* (sessão ficou aguardando o login do usuário) | Codex 23/10 | Aguardando confirmação |
| 4 | **Duas instâncias do bot** competindo pelas interações (usuário roda no VS Code) | Codex 24/10 | Alerta dado, sem correção |
| 5 | **Guia de contribuição** (25/10) interrompido por erro de rede → `AGENTS.md` existe mas não foi commitado | Codex 25/10 | A concluir |
| 6 | Migração futura SQLite → PostgreSQL/MySQL | `.vscode/AGENTS.MD` | Só intenção |
| 7 | Claude Desktop (plano gratuito) não lê arquivos locais → precisa anexar arquivos no chat | Claude | Limitação de ferramenta |
| 8 | Testes: nas sessões do Codex o agente registrou não ter rodado a suíte completa | Codex 24/10 | Validar agora |

---

## 5. Mudanças propostas

### 5.1 Concluir o refactor de `/transacoes` (trabalho em andamento)

Nenhuma reescrita: o código já está pronto e coerente (verificação feita por leitura). Falta **1 ajuste + validação**.

- **`tsconfig.strict.json`** — adicionar `"utils/transactionHistory.ts"` ao array `include`.
  - **Por quê:** é a instrução registrada no chat do Claude e a convenção do repo (os utils de lógica pura já listados lá, ex. `utils/gameEconomy.ts`, `utils/scratchCards.ts`, entram no strict).
  - **Como:** inserir a linha junto das demais entradas `utils/*.ts` (após `"utils/primaryGuild.ts"`), mantendo vírgulas válidas.
  - **Não incluir** `commands/transacoes.ts` no strict: ele usa `require(...)` + `any` (padrão legado da maioria dos comandos) e sairia do estilo dos módulos strict atuais.

### 5.2 Validar

- Rodar `npm test` (faz `npm run build` → limpa `dist/`, compila com `noEmitOnError`, roda `typecheck:strict` e executa `node --test dist/test`). Deve passar incluindo os novos testes.
- Conferir que `npm run typecheck:strict` continua limpo com o util adicionado ao include.
- Não é necessário `npm run register`: o **schema** do slash command `/transacoes` (nome/descrição) não mudou.

### 5.3 Commitar (Conventional Commits, sem push)

- **Commit 1 — `refactor: extract transaction history formatting`**
  Arquivos: `utils/transactionHistory.ts` (novo), `commands/transacoes.ts` (modificado), `test/transactionHistory.test.ts` (novo), `tsconfig.strict.json`.
  Inclui, de forma coesa, o tratamento do botão malformado (a correção sugerida `fix: handle malformed history button ids` está dentro do mesmo refactor, então não vale um commit separado sobre o mesmo arquivo).
- **Commit 2 — `docs: add repository contributor guide`**
  Arquivo: `AGENTS.md` (conclui a thread de 25/10 interrompida).
- **` .vscode/AGENTS.MD` fica fora do commit** (é prompt pessoal do usuário, escrito em 1ª pessoa, não documentação do repo). Continua untracked.
- **Sem `git push`** (não solicitado).

### 5.4 Criar o documento de handoff

- **`docs/handoff.md`** (novo, em português, alinhado ao estilo de `docs/linux-24h.md`).
- Conteúdo:
  1. Visão geral e arquitetura de pastas do bot.
  2. Como rodar/testar/publicar (`npm ci`, `npm run build`, `npm test`, `npm start`, `npm run register`, `npm run service:install`).
  3. Estado atual: o que está pronto (economia de cookies, rankings, sorteios, emojis do Discord Developer com cache, `/transacoes` refatorado).
  4. Backlog priorizado = tabela da §4, cada item com "próximo passo concreto".
  5. Decisões/convenções da §4 (preservar comandos e SQLite, estilo, Conventional Commits).
  6. Onde retomar: caminhos dos históricos (`~/.codex/sessions/...`, dados do Claude Desktop) e a limitação de anexar arquivos no Claude.
- **Por quê:** foi um dos focos pedidos pelo usuário e é o artefato que evita perder o contexto das conversas.

---

## 6. Premissas e decisões

- **Escopo enxuto:** o plano conclui o refactor, valida, commita e documenta. Não refaz a revisão visual dos comandos nem o badge do `/ship`, porque dependem de escolhas de design do usuário (imagens de referência que ele enviou no Codex) — ficam como backlog no handoff.
- **Erro 10062 do `/ship`:** apenas documentar com hipótese (resposta além do tempo de 3 s da interação) e um passo de diagnóstico; **não** alterar código sem reproduzir.
- **Strict:** adicionar somente `utils/transactionHistory.ts`, seguindo a instrução do chat do Claude.
- **`.vscode/AGENTS.MD`** permanece untracked.
- **Sem** `git push` e **sem** `npm run register`.
- **Não** mexer em `data/` (estado persistente) nem em schemas do SQLite.

---

## 7. Verificação (o que rodar ao final)

```bash
npm ci                 # só se node_modules estiver ausente
npm test               # build + typecheck:strict + node --test dist/test
npm run typecheck:strict
git status             # confirmar o que foi commitado e o que ficou untracked
git log --oneline -3   # confirmar as 2 mensagens de commit
```

Critérios de sucesso:

- `npm test` e `npm run typecheck:strict` passam, incluindo `test/transactionHistory.test.ts`.
- `utils/transactionHistory.ts` presente no `include` de `tsconfig.strict.json`.
- Dois commits criados com as mensagens acima; `data/` intacto; nada enviado ao remoto.
- `docs/handoff.md` criado, com backlog priorizado e apontando o estado real do repo.
