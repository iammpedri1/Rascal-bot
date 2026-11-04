# Debug Guide

## Como reproduzir os principais bugs

1. **Recompensa por voz paga mesmo fora do canal**
   - Entre em um canal de voz, espere 10 min e saia antes do intervalo de recompensa.
   - Verifique o log `logs/voice.log` (ou console) para confirmar que a recompensa não foi aplicada.

2. **Erro `playerFor` no comando `/jogodavelha`**
   - Execute `/jogodavelha` e tente jogar. O bot falha com `ReferenceError: playerFor is not defined`.
   - O stack trace aparece nos logs do bot.

## Ferramentas de depuração

- **VS Code Debugger**: use a configuração `launch.json` que inicia o bot com `npm start` e permite breakpoints nos arquivos de `utils` e `commands`.
- **Logs**: todos os módulos utilizam `utils/logger.ts`. O nível `debug` pode ser ativado via `process.env.LOG_LEVEL=debug`.

## Passos para depurar

1. Abra a pasta raiz no VS Code.
2. Pressione `F5` (ou `Run > Start Debugging`).
3. Defina breakpoints nas funções `payVoiceRewards` (utils/voiceStats.ts) e `playerFor` (a ser criada).
4. Observe as variáveis `session`, `member` e `activeSessions`.
5. Use a aba **Debug Console** para inspecionar valores.

---

# Notas de depuração

- As sessões de voz são armazenadas em `activeSessions` (Map). Quando o usuário sai, a sessão deve ser removida.
- O bug original ocorria porque a verificação de presença no canal não era feita.
- A correção adiciona verificação de `member?.voice?.channelId` e limpa sessões órfãs.
