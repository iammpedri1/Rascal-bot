# Spec de Overhaul da Economia e Correções

## Por que
O usuário deseja uma reformulação visual nos comandos `/daily` e `/trabalhar` para que fiquem mais profissionais e sigam referências visuais específicas. Além disso, foram reportados bugs no sistema de transações (falta de histórico global) e recompensas de voz (pagamento indevido).

## O que muda
- **Interface do /daily**: Novo layout com barra de progresso, emojis específicos e formatação de valores com vírgula.
- **Interface do /trabalhar**: Novo layout com thumbnail do Peepo, trabalhos aleatórios com emojis e textos mais limpos.
- **Comando /transacoes**: Adição de funcionalidade para visualizar o histórico global do servidor.
- **Recompensas de Voz**: Correção na lógica de verificação para garantir que apenas usuários em call recebam cookies.

## Impacto
- Afeta: `commands/daily.ts`, `commands/work.ts`, `commands/transacoes.ts`, `utils/cookieViews.ts`, `utils/voiceStats.ts`.

## Requisitos ADICIONADOS
### Requisito: UI Premium para Daily e Trabalho
O sistema DEVE fornecer embeds visualmente ricos e informativos conforme as capturas de tela.

#### Cenário: Sucesso no /daily
- **QUANDO** o usuário executa `/daily`
- **ENTÃO** o embed mostra a barra de progresso `[🟩🟩⬜⬜⬜]`, o saldo formatado e a dica de voto.

#### Cenário: Sucesso no /trabalhar
- **QUANDO** o usuário executa `/trabalhar`
- **ENTÃO** o embed mostra o trabalho aleatório (ex: Médico(a) 🏥) e o saldo atualizado.

### Requisito: Histórico Global de Transações
O comando `/transacoes` DEVE permitir visualizar todas as movimentações de cookies do servidor.

### Requisito: Validação Estrita de Voz
O agendador de recompensas DEVE verificar a presença física do usuário no canal de voz antes de processar o pagamento.

## Requisitos MODIFICADOS
### Requisito: Lógica de Trabalho
A lista de trabalhos e motivos de falha deve ser expandida e incluir emojis.
