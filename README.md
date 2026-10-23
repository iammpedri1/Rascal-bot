# Rascal Bot

Rascal é um bot Discord modular, desenvolvido em TypeScript com
`discord.js` v14. Ele reúne ferramentas de moderação, utilidades, economia,
minijogos, níveis, rankings, tickets, lembretes e integrações com presença do
Spotify.

## Principais recursos

- Economia com cookies, `/daily`, `/streak`, loja, VIPs, boosts e inventário.
- Minijogos e comandos sociais para interação entre os membros.
- Moderação, proteção, tickets e ferramentas para a equipe.
- Rankings de cookies, XP, mensagens e tempo em canais de voz.
- `/tocando` com card visual da música atual do Spotify.
- Emojis personalizados carregados do Developer Portal.
- Persistência local em SQLite e arquivos auxiliares com validação.

## Como executar

1. Use Node.js 22 ou superior.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Copie `.env.example` para `.env` e preencha o token e os identificadores da
   aplicação.
4. Registre os comandos:

   ```bash
   npm run register
   ```

5. Inicie o bot:

   ```bash
   npm start
   ```

## Estrutura

- `commands/`: comandos slash.
- `events/`: eventos do Discord.
- `handlers/`: carregamento de comandos e eventos.
- `utils/`: economia, persistência, permissões, emojis e integrações.
- `test/`: testes automatizados.
- `scripts/`: tarefas de segurança e instalação do serviço.

## Verificação

```bash
npm run build
npm test
npm run security:check
```

Nunca versionem `.env`, tokens ou os bancos de dados locais. Use o
`.env.example` como referência para a configuração.
