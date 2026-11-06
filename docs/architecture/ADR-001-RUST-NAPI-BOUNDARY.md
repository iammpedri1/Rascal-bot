# ADR-001: fronteira Rust/N-API

- **Status:** piloto opt-in
- **Data:** 2026-11-06

## Contexto

O bot é predominantemente I/O-bound: Discord.js, SQLite e APIs externas não
ganham confiabilidade ou latência ao serem reescritos em Rust. A única
candidata inicial isolada no caminho de mensagens é a normalização Unicode.

## Decisão

Manter o domínio puro em `rust/crates/rascal-core` e expor somente
`normalize_content(String) -> String` em `rascal-native`. O carregamento é
feito por um adaptador TypeScript opt-in com fallback explícito.

## Não migrado

Gateway, REST, comandos, embeds, AutoMod com punições, economia, SQLite,
cooldowns, schedulers e estatísticas permanecem em TypeScript. Não há evidência
de que sejam CPU-bound, e vários têm efeitos colaterais ou contratos de
consistência.

## Critério para ativação

Só ativar Rust após comparar TypeScript e addon release incluindo o custo
N-API, usando o mesmo dataset, e confirmar paridade de Unicode. Se o ganho
medido não compensar o overhead ou aumentar p95/p99, manter a implementação
TypeScript.
