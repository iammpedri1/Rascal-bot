# Plano de Reformulação do Rascal Bot (v4)

Este plano detalha a reestruturação visual, funcional e estrutural do Rascal Bot, focando em uma interface limpa (Clean UI), rankings vitalícios (Lifetime), cargos rotativos mensais e a integração completa dos 169 emojis do Portal, incluindo o suporte a badges de perfil no `/user info`.

## Análise do Estado Atual
- **Comandos Redundantes**: `/rank` e `/menu` serão excluídos.
- **Rankings**: Migração total para o modelo "Lifetime" (vitalício).
- **Interface**: Redução da repetição do ícone/nome do bot e ajuste de espaçamentos.
- **Emojis**: O bot possui 169 emojis no Portal (como `Peep_Money`, `Vip1`, `MegaVip`, `programmer`, `Diamond`), mas muitos não estão sendo aproveitados ou mapeados corretamente.
- **Badges**: O comando `/user info` possui uma lista limitada de badges e não utiliza todos os novos emojis de badges disponíveis no Portal.

## Mudanças Propostas

### 1. Mapeamento de Emojis e Identidade Visual
- **Atualização de `utils/emojis.ts`**:
    - Mapear os 169 emojis descobertos no Portal, incluindo os de VIP, profissões, economia e badges.
    - Adicionar aliases para facilitar o uso (ex: `moneyIcon` -> `Peep_Money`, `vip1` -> `Vip1`).
- **Padronização**: Usar emojis temáticos para cada categoria (ex: `peep_police` para moderação, `Peep_Money` para economia).

### 2. Reformulação do `/user info` e Badges
- **Atualização de `commands/userinfo.ts`**:
    - Mapear corretamente as flags do Discord para os novos emojis do Portal:
        - `Staff` -> `4360discordstaffexperimental`
        - `Partner` -> `4902partner`
        - `Hypesquad` -> `hypesquad`
        - `HypeSquadOnlineHouse1` -> `8495hypesquadhouseofbravery`
        - `HypeSquadOnlineHouse2` -> `7693hypesquadhouseofbrilliance`
        - `HypeSquadOnlineHouse3` -> `1050hypesquadhouseofbalance`
        - `BugHunterLevel2` -> `9148discordgoldbughunter`
        - `VerifiedDeveloper` -> `6587earlyverifiedbotdevelopera`
        - `CertifiedModerator` -> `2731certifiedmoderator`
    - Adicionar suporte a novas badges como `ActiveDeveloper`.
    - **Nota**: Caso faltem emojis no Portal, fornecerei as imagens/links para que você possa adicioná-los (já que não tenho acesso direto para carregar arquivos no Developer Portal).

### 3. Rankings Vitalícios (Lifetime)
- **Banco de Dados**: 
    - Adicionar colunas `voice_seconds_lifetime` e `transmission_seconds_lifetime` na tabela `usuarios` em [db.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/utils/db.ts).
- **Lógica de Estatísticas**:
    - Atualizar [voiceStats.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/utils/voiceStats.ts) para incrementar os contadores vitalícios globalmente.
- **Comandos de Rank**:
    - Alterar [rankmensagens.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/rankmensagens.ts), [rankvoz.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/rankvoz.ts) e [ranktransmissao.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/ranktransmissao.ts) para exibir o Top 10 vitalício por padrão.

### 4. Cargos Rotativos Mensais
- **Automação**: 
    - Em [monthlyTop.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/utils/monthlyTop.ts), identificar os vencedores do mês (Top 1 Mensagens e Voz).
    - Gerenciar a troca dos cargos "Top 1 Mensagens" e "Top 1 Voz" no servidor automaticamente no primeiro dia do mês.

### 5. Reformulação do /transações e Economia
- **Design Profissional**:
    - Layout com thumbnail dinâmica (avatar do usuário) em [transacoes.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/commands/transacoes.ts).
- **Emojis de Profissão**:
    - Em [transactionHistory.ts](file:///home/pedroaugusto/Documentos/GitHub/rascal-bot/utils/transactionHistory.ts), mapear profissões do `/work` para emojis específicos (ex: `programmer` -> 💻, `miner` -> ⛏️).

### 6. Moderação e Logs
- **Novo Comando `/modlog`**:
    - Exibir histórico de punições com layout "Peepo Police" usando os novos emojis de moderação (`peep_police`, `blobBan`, `Castigo`).
- **Melhoria no `/ticket`**:
    - Embed de abertura mais limpo e focado, utilizando `4645reportmessage` ou `ticket` como ícone principal.

### 7. Informação e VIPs
- **Subcomando `/info cargos`**:
    - Criar interface detalhada em `commands/info.ts` usando os emojis `Vip1`, `Vip2`, `MegaVip` para distinguir os níveis de benefício.

### 8. Entretenimento e Clean UI
- **Refinamento do `/meme`**:
    - Fontes: `r/diretozap`, `r/HUEstation`, `r/eu_nvr`.
- **Ajustes de Espaçamento**: Revisão geral para garantir que textos não fiquem "grudados" (uso correto de `\n\n`).
- **Gramática**: Correção de erros de português em todas as interações.

## Suposições e Decisões
- **Fallback de Emojis**: Se um emoji específico da aplicação falhar, o bot usará o fallback Unicode definido em `utils/emojis.ts`.
- **Exclusão de Comandos**: O comando `/rank` será removido pois cada categoria já possui seu comando próprio.

## Passos de Verificação
1. **Badges**: Verificar se as badges aparecem corretamente no `/user info`.
2. **Rankings**: Validar se os dados exibidos são os totais (Lifetime).
3. **Cargos**: Testar a lógica de atribuição/remoção de cargos rotativos.
4. **Visual**: Comparar `/transacoes` e `/punir` com as referências visuais do usuário.
5. **Comandos**: `npm run register` e testar a disponibilidade de todos os novos recursos.
