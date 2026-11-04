# Mines System

O sistema Mines é um minijogo de cassino baseado em probabilidades reais, onde o jogador deve encontrar diamantes escondidos em uma grade 5x5.

## Lógica de Multiplicadores

Diferente de sistemas fixos, o multiplicador do Mines é calculado dinamicamente a cada rodada usando a probabilidade inversa:

$$Multiplicador = \left( \frac{Células Disponíveis}{Diamantes Restantes} \right) \times HouseEdge$$

- **House Edge**: Definido em `0.98` (2% de margem para a casa).
- **Células Disponíveis**: Total de células ainda não reveladas.
- **Diamantes Restantes**: Total de diamantes (25 - minas) menos os já encontrados.

## Estrutura de Dados

O estado do jogo é mantido em memória durante a interação e persistido no SQLite apenas no fechamento da partida (`resolveGame`).

```typescript
interface MinesState {
  mines: number[];      // Índices (0-24) das minas
  revealed: number[];   // Índices já revelados pelo jogador
  multiplier: number;   // Multiplicador acumulado
  bet: number;          // Valor da aposta inicial
  mineCount: number;    // Qtd de minas escolhida
  isGameOver: boolean;  // Estado de término
  isVictory: boolean;   // Se terminou em vitória ou bomba
}
```

## Comandos

- `/mines [aposta] [minas]`: Inicia uma nova partida.
- **Botões da Grade**: Revelam uma casa.
- **Cashout**: Encerra a partida e coleta os cookies com o multiplicador atual.
- **Aleatório**: Revela uma casa aleatória ainda não aberta.

---
*Documentação gerada para a branch feature/overhaul-structure.*
