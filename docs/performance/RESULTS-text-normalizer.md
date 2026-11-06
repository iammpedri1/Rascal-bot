# Benchmark: normalização de texto

- Node: v26.12.1
- Host: linux x64; Intel(R) Core(TM) i5-3470 CPU @ 3.20GHz
- Corpus: 5 entradas; 20 rodadas de 50000 operações

| Caminho | Throughput | Mediana | P95 | P99 |
|---|---:|---:|---:|---:|
| TypeScript | 1425272 ops/s, mediana 35.081 ms | 35.081 ms | 36.641 ms | 37.076 ms |
| N-API/Rust | 739776 ops/s, mediana 67.588 ms | 67.588 ms | 71.006 ms | 75.013 ms |

O benchmark mede a função e a fronteira N-API, mas não representa sozinho o caminho completo de `messageCreate`.
O resultado não habilita Rust automaticamente; a decisão deve considerar paridade, overhead e o caminho end-to-end.

## Decisão

Neste dataset e host, TypeScript é o caminho recomendado. A chamada individual
N-API não compensa o custo da fronteira; Rust deve ser reavaliado somente com
uma API batch e benchmark end-to-end.
