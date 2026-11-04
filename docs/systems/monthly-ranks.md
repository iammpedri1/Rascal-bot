# Monthly Rankings & Roles

Sistema de fidelização e engajamento que premia os membros mais ativos do mês com cargos exclusivos e bônus na economia.

## Funcionamento

O sistema monitora a atividade de mensagens e tempo em voz em tempo real e, ao final de cada mês, gera um ranking.

### Regras de Atribuição
1. **Top 1 Mensagens**: O usuário com maior `messages_count` no mês.
2. **Top 1 Voz**: O usuário com maior tempo (segundos) em canais de voz no mês.

Os cargos são **rotativos**. Quando um novo vencedor é coroado, o vencedor do mês anterior perde o cargo automaticamente.

## Persistência (SQLite)

As atribuições são registradas na tabela `monthly_role_assignments` para garantir que o bot saiba quem deve perder o cargo no próximo ciclo.

```sql
CREATE TABLE monthly_role_assignments (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  rank_type TEXT NOT NULL, -- 'messages' ou 'voice'
  assigned_at INTEGER NOT NULL,
  month_key TEXT NOT NULL,
  PRIMARY KEY (guild_id, rank_type, month_key)
);
```

## Benefícios
Membros com esses cargos ganham um multiplicador de **1.2x** em todos os ganhos de cookies (Daily, Trabalho, etc.), conforme configurado no sistema de economia central.

## Comandos Relacionados
- `/info cargos`: Exibe os benefícios dos cargos de prestígio.
- `/rankmensagens` e `/rankvoz`: Exibem o ranking atual (mensal ou vitalício).

---
*Documentação gerada para a branch feature/overhaul-structure.*
