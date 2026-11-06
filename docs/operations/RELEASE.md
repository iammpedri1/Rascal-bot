# Build e release nativo

O deployment atual continua sendo Node/TypeScript. Para construir o addon
Linux x64 no host de deployment:

```bash
npm ci
npm run native:build
```

O artefato em `native/` é gerado localmente e não deve ser compartilhado entre
arquiteturas ou sistemas operacionais. A compatibilidade Node-API não elimina
as diferenças de libc, sistema operacional e arquitetura.

O addon experimental só é selecionado com `RASCAL_NATIVE_TEXT=true`. Para
produção, mantenha a flag desligada até existir benchmark batch e validação no
target real.
