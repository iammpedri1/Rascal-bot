# Rascal Bot

Bot Discord.js 14 com economia, rankings e minijogos.

## Economia

- `/daily` e `/trabalhar`: recompensas com cooldown e histórico.
- `/pix`: transferências com imposto progressivo (0% até 10.000, 2% até 50.000 e 5% acima disso).
- `/transacoes servidor:true`: histórico global do servidor.
- `/mercadonegro`: itens consumíveis e sistema de prisão/fiança.
- Rankings mensais de mensagens e voz são publicados pelo scheduler configurado.

## Minijogos

- `/mines`: tabuleiro 5x5 por padrão ou 3x3, com multiplicadores baseados em distribuição hipergeométrica e vantagem da casa de 5%.
- `/crash`: curva exponencial com RTP de 95%, retirada manual e limite de pagamento.
- `/raspadinha`: três escolhas, canvas visual e estorno automático após expiração.
- `/roletarussa`: apostas reservadas atomicamente, proteção por autor e GIFs temáticos de resultado.

## Desenvolvimento

Requer Node.js 22 ou superior:

```bash
npm ci
npm test
```

O bot usa SQLite em `data/`. Não remova ou reinicialize esse diretório em produção.
