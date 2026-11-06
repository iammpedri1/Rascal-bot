# Handoff do Rascal — estado do projeto e como continuar

Documento gerado a partir dos históricos de conversa com o **Codex** (thread principal `01a16e43`, 23–25/10) e com o **Claude** (app Claude Desktop), cruzados com o estado real do repositório. Serve para retomar o trabalho sem perder contexto.

## Visão geral

Bot de Discord em **TypeScript + discord.js v14**, com persistência local em **SQLite** (`better-sqlite3`) e JSONs em `data/`.

| Pasta | Responsabilidade |
| --- | --- |
| `commands/` | Slash commands (um módulo por comando, minúsculo, ex. `commands/ping.ts`) |
| `events/` | Handlers de eventos do Discord (`interactionCreate`, `messageCreate`, `ready`, `voiceStateUpdate`, ...) |
| `handlers/` | Carregamento e despacho de comandos/eventos |
| `core/` | Cliente (`RascalClient`) e formatação de respostas |
| `utils/` | Lógica de negócio compartilhada (economia, loja, rankings, emojis, db, ...) |
| `types/` | Contratos compartilhados (`command`, `event`, `logger`) |
| `test/` | Testes com `node:test` + `node:assert/strict` |
| `scripts/` | Automação (build limpo, serviço systemd, security check) |
| `docs/` | Documentação de operação |
| `data/` | Estado persistente (SQLite + JSON) — **não apagar nem resetar** |

## Como rodar, testar e publicar

```bash
npm ci                    # instala dependências (Node.js 22+)
npm run build             # limpa dist/, compila e roda typecheck:strict
npm test                  # build + testes (node --test dist/test)
npm start                 # compila, publica os slash commands e inicia o bot
npm run register          # publica os slash commands sem iniciar o bot
npm run security:check    # build + varredura de segurança
npm run service:install   # serviço systemd de usuário (Linux)
```

Detalhes de serviço local e hospedagem em [linux-24h.md](linux-24h.md).

## Estado atual

- Economia de cookies com `/daily` (com bônus aleatório a cada 5 dias de sequência), `/streak`, `/work`, `/bonus`, `/roubar`, `/transferir`, `/apostar`, rifa, loteria semanal, raspadinha, mercado negro e loja de cargos.
- Taxas: por inatividade (a cada 25 dias sem `/daily`) e mensal de 2% (isenta Nitro Boost).
- Recompensa por atividade em voz (1–5 cookies a cada 10 minutos sem mute) e rankings (mensagens, voz, transmissões).
- Emojis vindos do **Discord Developer** com cache (a aplicação carregou 163 emojis); embeds com cores aleatórias.
- `/transacoes` refatorado: a formatação, os estilos e a paginação saíram para `utils/transactionHistory.ts` (funções puras, cobertas por `test/transactionHistory.test.ts`), e o botão passou a tratar IDs malformados com mensagem amigável.
- Limpeza de dados de usuários 365 dias após a saída do servidor.

Validado neste handoff: `npm test` → **35 testes, 0 falhas**; `npm run typecheck:strict` limpo.

## Backlog priorizado

| # | Item | Próximo passo concreto |
| --- | --- | --- |
| 1 | `/ship`: badge com a identidade do Rascal | Refazer a badge a partir das imagens de referência que o usuário enviou no Codex e validar o resultado com ele. |
| 2 | `/ship`: erro **10062** (interação desconhecida/expirada) | Reproduzir e medir o tempo até responder; se passar de 3 s, usar `deferReply`/`deferUpdate` antes de gerar o canvas. |
| 3 | Revisão visual de `/menu`, `/userinfo`, `/ping`, `/botinfo`, `/serverinfo`, `/streak` | Padronizar com `core/InteractionResponseFormatter.ts` + `utils/embedStyle.ts`; conferir uso dos emojis do Discord Developer. |
| 4 | `/daily` notificando "trabalhar" | Trocar por botão de notificação por ação (decisão de UX pendente com o usuário). |
| 5 | Confirmar intents no Discord Developer Portal (*Server Members* e *Message Content*) | Verificar no portal que ambos estão habilitados; sem eles, membros/mensagens não chegam aos eventos. |
| 6 | Duas instâncias do bot disputando interações | Definir um único processo (VS Code **ou** serviço systemd) e encerrar o outro antes de testar. |
| 7 | Migração futura SQLite → PostgreSQL/MySQL | Só intenção registrada (ver `.vscode/AGENTS.MD`); manter o SQLite compatível até lá. |
| 8 | Claude Desktop no plano gratuito não lê arquivos locais | Anexar `AGENTS.md` e os arquivos relevantes no chat ao pedir revisão. |

## Decisões e convenções

- **Preservar** os comandos e nomes slash existentes e o **schema do SQLite** (compatibilidade retroativa).
- Emojis do **Discord Developer** com cache; **cores aleatórias** nos embeds.
- Estilo: 2 espaços, aspas duplas, ponto e vírgula; testes em `test/*.test.ts` com `node:test`.
- `npm run typecheck:strict` cobre os módulos listados em `tsconfig.strict.json` — incluir ali os utils de lógica pura novos.
- Commits em **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Convenções completas em [AGENTS.md](../AGENTS.md).

## Onde retomar

- Histórico do Codex: `~/.codex/sessions/2026/10/` (thread principal `rollout-2026-10-24T11-14-28-01a16e43-*.jsonl` e continuações; ignorar as threads `guardian_review`).
- Histórico do Claude: dados locais do app Claude Desktop em `~/.config/Claude/IndexedDB/https_claude.ai_0.indexeddb.leveldb/`.
- Antes de mexer em dinheiro/ranking, rodar `npm test` e conferir `utils/db.ts` para manter o schema compatível.
