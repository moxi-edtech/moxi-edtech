import { schoolDaysPastDue } from "../formatters";

// Only collectible balances can accrue an active late-payment indicator.
export function hasOpenMensalidadeBalance(status: string, saldo: number): boolean {
  return ["pendente", "atrasado", "pago_parcial"].includes(status.trim().toLowerCase())
    && Number.isFinite(saldo) && saldo > 0;
}

export function mensalidadeDueState(m: { status: string; saldo: number; vencimento: string | null }, now: Date = new Date()) {
  const open = hasOpenMensalidadeBalance(m.status, m.saldo);
  const days = open ? schoolDaysPastDue(m.vencimento, now) : null;
  return { open, days, overdue: days !== null && days > 0 };
}
