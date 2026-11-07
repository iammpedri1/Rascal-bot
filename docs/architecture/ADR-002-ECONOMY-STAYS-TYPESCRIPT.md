# ADR-002: economia, SQLite e cooldowns continuam em TypeScript

- **Status:** aceita
- **Data:** 2026-11-06
- **Relacionada:** ADR-001-RUST-NAPI-BOUNDARY.md

## Contexto

Um plano de migração mais amplo (doc "Rascal Bot Hybrid Architecture") propôs
mover o motor de economia (`/trabalhar`, `/daily`, loja, apostas) e o acesso
ao SQLite para um addon Rust via napi-rs, com o Rust passando a ser dono da
conexão SQLite. Esse plano contradiz a ADR-001, decidida no mesmo dia, que
mantém economia/SQLite/cooldowns em TypeScript até haver evidência de ganho.

Auditoria feita antes de agir:

- `utils/cookieEconomy.ts` (1197 linhas): `work()` e as demais funções de
  economia são transacionais (`db.transaction`), dependem de
  `getUser/getById/addBalance/updateStats/pushTransaction` e de
  `utils/cooldowns.ts`, todos acoplados ao `better-sqlite3` síncrono em
  `utils/db.ts`. Mover só `work()` exigiria o Rust também possuir a conexão
  SQLite, cooldowns e todo o schema de `usuarios`/`transacoes` — não é uma
  função pura isolável.
- `utils/automod.ts` (315 linhas): estado em memória (`Map`) + efeitos
  colaterais Discord (embeds, timeouts, DB). Núcleo de decisão não está
  isolado de I/O hoje.
- `utils/imageModeration.ts`: delega a moderação a uma API externa da OpenAI;
  não há processamento de imagem local nem custo de CPU a reduzir.
- `commands/mines.ts`: lógica de jogo determinística, mas de baixo custo
  computacional; não há evidência de ser um gargalo de CPU.

Nenhum candidato encontrado é uma função pura, determinística e com custo de
CPU medido que justifique, hoje, o overhead de uma fronteira N-API — o mesmo
critério que já reprovou o piloto `normalizeContent` em chamada única
(ver ADR-001).

## Decisão

- Mantemos a ADR-001: SQLite, cooldowns e economia (`work`, `daily`, loja,
  apostas, roubo) permanecem 100% em TypeScript. O plano "Hybrid
  Architecture" anexado ao projeto é tratado como aspiracional/rejeitado
  nesse ponto, não como next step.
- O plano de migração do `/trabalhar` para Rust (item 4 do documento
  original) **não é executado**.
- Novos candidatos a Rust só avançam com uma função pura isolada do SQLite e
  do estado do Discord, e só depois de um benchmark no mesmo formato de
  `scripts/benchmark-text-normalizer.ts` mostrando ganho líquido (incluindo
  custo de N-API) sobre a implementação TypeScript — mesmo critério da
  ADR-001.

## Consequências

- Nenhuma mudança de schema ou de runtime nesta ADR; é um registro de
  decisão.
- `rascal-native` continua expondo só `normalize_content`, atrás da flag
  `RASCAL_NATIVE_TEXT`, sem uso em produção por padrão.
- Revisar esta decisão se: (a) o acesso ao SQLite for migrado para um motor
  assíncrono (item 7 do backlog em `docs/handoff.md`), ou (b) profiling em
  produção apontar um gargalo de CPU real em algum módulo.
