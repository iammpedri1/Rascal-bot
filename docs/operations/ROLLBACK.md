# Rollback do caminho nativo

O caminho Rust é desligado por padrão. Para rollback em staging ou produção:

```bash
RASCAL_NATIVE_TEXT=false npm start
```

Se a variável já estiver configurada no ambiente, remova-a ou defina `false` e
reinicie o processo. A implementação TypeScript não foi removida e não há
escritas duplicadas. Um erro de carregamento do addon também cai para
TypeScript, registrando o erro.

Não remova o banco SQLite nem altere schema para operar o rollback.
