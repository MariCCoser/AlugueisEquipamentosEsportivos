import type { StatusReserva } from '@shared/models/enums';
import { TransicaoInvalidaError } from '../errors/ReservaErrors';

/**
 * Máquina de estados da reserva.
 *
 *   PENDENTE ──confirmarRetirada──▶ ATIVA ──registrarDevolucao──▶ DEVOLVIDA
 *      │                              │
 *      └──────────cancelar────────────┴──────────▶ CANCELADA
 *
 * DEVOLVIDA e CANCELADA são finais: nada sai delas.
 */
export class CicloReserva {
  private static readonly TRANSICOES: Readonly<Record<StatusReserva, readonly StatusReserva[]>> = {
    PENDENTE: ['ATIVA', 'CANCELADA'],
    ATIVA: ['DEVOLVIDA', 'CANCELADA'],
    DEVOLVIDA: [],
    CANCELADA: []
  };

  static podeTransitar(de: StatusReserva, para: StatusReserva): boolean {
    return CicloReserva.TRANSICOES[de].includes(para);
  }

  /** Lança TransicaoInvalidaError se a mudança não for permitida. */
  static validar(de: StatusReserva, para: StatusReserva): void {
    if (!CicloReserva.podeTransitar(de, para)) {
      throw new TransicaoInvalidaError(de, para);
    }
  }

  static ehFinal(status: StatusReserva): boolean {
    return CicloReserva.TRANSICOES[status].length === 0;
  }

  /** Enquanto a reserva está PENDENTE ou ATIVA, os equipamentos dela ficam ocupados. */
  static ocupaEquipamentos(status: StatusReserva): boolean {
    return status === 'PENDENTE' || status === 'ATIVA';
  }
}
