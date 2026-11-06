# Runbook de debugging

## Validação local

```bash
npm ci
npm run build
npm test
npm run security:check
cargo fmt --all --check --manifest-path rust/Cargo.toml
cargo clippy --manifest-path rust/Cargo.toml --workspace --all-targets --all-features -- -D warnings
cargo test --manifest-path rust/Cargo.toml --workspace --locked
```

## Benchmark

```bash
npm run benchmark:text
```

O comando compila o addon release, executa TypeScript e N-API com o mesmo
corpus e grava dados sanitizados em `docs/performance/`. Ele não conecta ao
Discord nem envia mensagens.

## Diagnóstico do addon

Se o addon falhar ao carregar, mantenha `RASCAL_NATIVE_TEXT=false` e verifique
`npm run native:build`. O adaptador registra o erro e retorna ao TypeScript;
nenhuma decisão de AutoMod, escrita SQLite ou resposta Discord depende do
addon.

Para profiling do processo completo, use somente ambiente de teste:

```bash
npm run build
mkdir -p profiles
node --cpu-prof --cpu-prof-dir=profiles --heap-prof --heap-prof-dir=profiles dist/index.js
```

Não versionar perfis, banco, logs privados ou tokens.
