# Arquitetura híbrida

O TypeScript continua sendo o plano de controle: Discord.js, Gateway, REST,
interações, permissões, SQLite, economia e efeitos colaterais permanecem no
processo Node. Rust só recebe funções puras, determinísticas e medidas.

```text
Discord Gateway/REST
        |
        v
TypeScript (RascalClient, handlers, comandos, SQLite)
        |
        +--> fallback TypeScript (padrão)
        |
        `--> adaptador opcional -> N-API -> rascal-core (Rust puro)
                                      |
                                      `--> resultado simples para TS
```

O primeiro piloto é `normalizeContent`. O benchmark diferencial mostrou que a
chamada N-API individual é mais lenta que TypeScript neste workload; por isso
TypeScript continua sendo o padrão e `RASCAL_NATIVE_TEXT=true` permanece
experimental. Uma próxima tentativa só deve usar uma API batch que amortize a
fronteira N-API.

Rust não controla Client, cache Discord.js, Gateway, banco, timers ou
permissões. O contrato deve permanecer puro para permitir rollback removendo a
flag.
