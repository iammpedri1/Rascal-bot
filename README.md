# Rascal Bot

Bot Discord modular em TypeScript com `discord.js` 14.

## Execução

1. Instale Node.js em uma versão suportada pelas dependências nativas do projeto.
2. Copie `.env.example` para `.env` e preencha `DISCORD_TOKEN`, `CLIENT_ID` e `GUILD_ID`.
3. Execute `npm install`.
4. Registre os comandos com `npm run register`.
5. Inicie o bot com `npm start`.

Todo o código do projeto foi convertido para arquivos TypeScript. `npm run build`
compila os arquivos para `dist/`; os scripts de início, registro e instalação
do serviço usam essa saída compilada. Alguns módulos legados mantêm
`@ts-nocheck` temporariamente porque usam respostas dinâmicas do Discord ou
resultados sem esquema do SQLite; eles continuam sendo candidatos às próximas
etapas de tipagem estrita.

`OWNER_ID` identifica o proprietário da aplicação para operações de nível 5. O
`LOG_LEVEL` aceita `silent`, `error`, `warn`, `info` ou `debug`.

## Organização

- `commands/`: comandos slash e handlers de componentes em TypeScript.
- `events/`: eventos do Discord em TypeScript.
- `handlers/`: carregamento de comandos e eventos.
- `utils/`: persistência, permissões, economia, XP e integrações.
- `data/database.sqlite`: persistência principal em SQLite.
- `data/tickets.json` e `data/reminders.json`: armazenamentos auxiliares JSON
  com leitura validada, backup de arquivos corrompidos e escrita temporária.

Os níveis de acesso são definidos em `utils/permissions.ts`: público, membro,
VIP, moderador, administrador e proprietário. Comandos administrativos também
mantêm as verificações nativas de permissões do Discord.

## Validação local

- `npm test`: executa os testes de persistência e autorização.
- `npm run build`: verifica e compila a camada TypeScript.
- `npm run security:check`: verifica arquivos rastreados (ou todos os arquivos
  do projeto quando o executável `git` não estiver disponível).

O registro de comandos e a conexão com o Discord exigem credenciais e não são
executados pelos testes locais. O `better-sqlite3` também precisa ser instalado
com binário compatível com a versão de Node em uso.
