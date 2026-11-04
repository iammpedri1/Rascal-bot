
const SALDO_INICIAL = 1_000;
const saldos = new Map<string, number>();

export function getSaldo(userId: string): number {
  return saldos.get(userId) ?? SALDO_INICIAL;
}

export function adicionarSaldo(userId: string, valor: number): void {
  saldos.set(userId, getSaldo(userId) + valor);
}

export function descontarSaldo(userId: string, valor: number): boolean {
  const saldo = getSaldo(userId);
  if (saldo < valor) return false;
  saldos.set(userId, saldo - valor);
  return true;
}
