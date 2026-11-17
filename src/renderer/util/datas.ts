import type { DataISO } from '@shared/dto/resposta';

/**
 * Contas com datas 'AAAA-MM-DD' na tela (sem DOM, testável no Vitest).
 * As contas usam Date.UTC para não sofrer com fuso e horário de verão:
 * só o dia importa, nunca a hora.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraUtc(iso: DataISO): number {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 1);
}

function deUtc(ms: number): DataISO {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Hoje no fuso do computador (o dia que a pessoa vê no calendário). */
export function hojeISO(agora: Date = new Date()): DataISO {
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

/** '2026-11-30' + 2 → '2026-12-02'. */
export function somarDias(iso: DataISO, dias: number): DataISO {
  return deUtc(paraUtc(iso) + dias * MS_POR_DIA);
}

/** Quantos dias de `de` até `ate` (negativo se `ate` vier antes). */
export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((paraUtc(ate) - paraUtc(de)) / MS_POR_DIA);
}

/**
 * Quantas diárias o período cobra: dias entre retirada e devolução, no mínimo 1
 * (retirar e devolver no mesmo dia cobra uma diária). Mesma regra do Periodo no Main.
 */
export function diariasDoPeriodo(retirada: DataISO, devolucao: DataISO): number {
  return Math.max(1, diasEntre(retirada, devolucao));
}
