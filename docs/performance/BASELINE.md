# Baseline de performance e qualidade

## Ambiente

- Data: 2026-11-06
- Branch: `fix/professional-hardening`
- Node: `v26.12.1`
- npm: `11.20.0`
- Rust: `1.99.0`
- Cargo: `1.99.0`

## Resultado inicial

| Comando | Resultado |
|---|---|
| `npm ci` | passou; 54 pacotes auditados, 0 vulnerabilidades |
| `npm run build` | passou |
| `npm test` | passou; 68/68 testes |
| `npm run security:check` | passou |

O log de JSON inválido durante `npm test` é o cenário de recuperação coberto
por `test/jsonStore.test.ts`, não uma falha da suíte.

## Candidatos avaliados

| Candidato | Classificação | Decisão |
|---|---|---|
| Normalização textual de mensagens | CPU pura, baixo acoplamento | piloto opt-in |
| AutoMod | mistura regex, Discord, DB e punições | manter TS |
| Economia | transações SQLite e integridade | manter TS |
| Rankings/estatísticas | consultas SQLite | medir SQL antes de Rust |
| Canvas/imagens | já usa dependência nativa | manter TS e medir antes |

## Resultado do piloto

No mesmo processo Node 26, com 1.000.000 operações e corpus de cinco entradas:

| Caminho | Mediana por rodada | P95 | Throughput |
|---|---:|---:|---:|
| TypeScript | 35,081 ms | 36,641 ms | 1.425.272 ops/s |
| N-API/Rust | 67,588 ms | 71,006 ms | 739.776 ops/s |

O caminho N-API individual ficou aproximadamente 48% abaixo do throughput
TypeScript neste host. O resultado inclui o custo de conversão da fronteira e
não justifica habilitar Rust para cada mensagem. Os dados completos estão em
[`text-normalizer.json`](./text-normalizer.json).

Decisão: manter TypeScript como padrão e não migrar AutoMod sem medir uma API
batch. O próximo experimento recomendado é normalizar vários textos em uma
única chamada N-API, sem mover política, permissões, Discord ou persistência.
