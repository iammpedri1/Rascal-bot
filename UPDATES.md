# Resumo de Alterações

## O que foi implementado

- **UI Premium** para os comandos `/daily` e `/trabalhar`
  - Barra de progresso visual
  - Emojis e thumbnails personalizados
  - Formatação de valores com separador de milhar
- **Correção de bug de recompensas por voz**
  - Verificação se o usuário ainda está no canal antes de pagar
  - Limpeza de sessões órfãs no cache e no banco
- **Histórico global de transações**
  - Nova opção `servidor` no comando `/transacoes` para exibir todas as transações do servidor
  - Funções `getHistory` e `getHistoryCount` agora aceitam `guildId` opcional
- **Eventos aleatórios em `/trabalhar`**
  - Lista ampliada de trabalhos e motivos de falha, com emojis aleatórios
- **Especificação e checklist**
  - Arquivos `.trae/specs/economy-overhaul/spec.md`, `tasks.md` e `checklist.md` criados para documentação oficial
- **Ajustes menores**
  - Atualização de imports e inicialização do scheduler de voz em `events/ready.ts`
  - Atualizações de comentários e mensagens de log

## Pendências históricas concluídas

- `playerFor` foi implementada em `/jogodavelha`.
- `TransactionDetails` foi adicionada a `cookieEconomy.ts`.
- A UI dos minijogos recebeu melhorias, incluindo canvas na raspadinha e GIFs na roleta.
- O comando `/crash` foi adicionado e a documentação pública foi atualizada no README.

---

## Entregas desta revisão

- Adicionado `/crash` com RTP de 95%, reserva atômica e limite de pagamento.
- `/mines` agora aceita tabuleiros 3x3 e 5x5; `/raspadinha` ganhou imagem dinâmica via canvas.
- `/roletarussa` exibe GIF temático de resultado e `/pix` aplica imposto progressivo.
- Atualizado o README com as opções públicas e corrigido o fallback de resposta do `/clear`.

_Este arquivo resume as alterações implementadas e a validação atual do projeto._