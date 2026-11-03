# 🛠️ Guia de Manutenção e Evolução: Economia & Jogos do Rascal

Este documento serve como a "fonte da verdade" para a manutenção, revisão e expansão dos sistemas de economia e minigames do bot.

## 🎯 Princípios de Design (Core)
Para qualquer nova funcionalidade ou alteração, siga estes pilares:
1. **Estética Clean**: Sem footers poluídos. Use o marcador `»` para listas. Embeds apenas para resultados principais; mensagens efêmeras de texto para erros simples.
2. **Matemática Rigorosa**: Todo jogo de aposta deve ter uma *House Edge* (Vantagem da Casa) definida entre 4% e 8%. Nunca use `Math.random()` puro para prêmios; utilize distribuições probabilísticas (ex: Hipergeométrica para Mines).
3. **Segurança de Interação**: 
    - Use `deferReply()` imediatamente em comandos complexos.
    - Implemente travas de autor (`component.user.id === interaction.user.id`) em todos os botões.
    - Sempre libere jogos ativos em blocos `finally { activeGames.releaseGame(id) }`.
4. **Tipagem Forte**: Utilize as interfaces em `types/` e evite `any`.

## 📈 Roadmap de Melhorias Sugeridas

### 🔹 Economia & Social
- [ ] **Sistema de Impostos**: Implementar uma taxa progressiva sobre transferências de grandes valores via `/pix`.
- [ ] **Mercado Negro**: Implementar itens consumíveis (ex: "Sorte Extra") que aumentem a chance de vitória em jogos por tempo limitado.
- [ ] **Ranking Sazonal**: Adicionar a possibilidade de "resetar" o ranking mensalmente e dar prêmios aos top 3.

### 🔹 Minigames
- [ ] **Mines Expandido**: Adicionar diferentes tamanhos de tabuleiro (ex: 3x3, 5x5).
- [ ] **Novos Jogos**: Implementar um sistema de "Crash" (estilo Aviator) baseado em curvas exponenciais.
- [ ] **Raspadinha Visual**: Integrar a `raspadinha.ts` com imagens dinâmicas via `@napi-rs/canvas`.

## 🛡️ Checklist de Segurança e Revisão
Sempre que alterar um comando de economia, verifique:
- [ ] O saldo do usuário é verificado **antes** de iniciar a aposta?
- [ ] A aposta é reservada no banco de dados para evitar *double-spending*?
- [ ] O jogo libera o usuário no `activeGames` mesmo em caso de erro crítico?
- [ ] O multiplicador está limitado por `MAX_PAYOUT` para evitar overflow de inteiros?

## 🤖 Prompt Estruturado para IAs (Contexto de Manutenção)
Se você for pedir a uma IA para alterar este sistema, use o seguinte prompt:

> "Atue como um Engenheiro de Software Sênior especialista em Discord.js v14 e TypeScript. Estou trabalhando no sistema de economia do Rascal Bot. O projeto segue a arquitetura de `commands/`, `utils/` e `types/`. 
> 
> **Requisitos Obrigatórios:**
> 1. **Visual**: Estilo minimalista, sem footers, uso de `»` para itens.
> 2. **Performance**: Uso de `deferReply` imediato e mensagens efêmeras para erros.
> 3. **Matemática**: Manter House Edge entre 4-8% e usar distribuições estatísticas reais.
> 4. **Segurança**: Implementar travas de autor em botões e gerenciamento rigoroso de jogos ativos via `activeGames`.
> 
> **Tarefa**: [INSERIR TAREFA AQUI]. Revise o código buscando por race conditions e erros de tipagem antes de entregar."

---
*Última revisão: Novembro de 2026*
