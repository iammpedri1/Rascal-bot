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

## Diagnóstico de runtime

- Se `GUILD_ID` não estiver configurado, o evento `ready` registra um aviso e não abandona nenhuma guilda.
- O listener `Client#rateLimit` registra rota, timeout e escopo global para investigar throttling da API.
- Imagens usam cache LRU de até 200 URLs; falhas são removidas do cache para permitir novas tentativas.
- Canvas reutilizável é limitado a 4096x4096 e é limpo antes de cada renderização.
- `/mines` usa 3x3 por padrão; 5x5 é recusado preventivamente porque o tabuleiro ocupa as cinco action rows permitidas pelo Discord e não deixa espaço para os controles.
- Reservas de minijogos possuem expiração de 2 minutos e são liberadas quando um novo jogo é iniciado, evitando avisos falsos após falhas de envio ou encerramentos inesperados.
