import type { FormaPagamento } from '../models/enums';
import type { DataISO } from './resposta';

export interface MultaDTO {
  id: number;
  reservaId: number;
  clienteNome: string;
  diasAtraso: number;
  valor: number;
  quitada: boolean;
  dataQuitacao?: string;
  /** Quanto já foi pago desta multa. */
  valorPago: number;
}

/** Entrada de `multas:calcular`: "quanto daria de multa se devolvesse nesta data?" */
export interface CalcularMultaDTO {
  reservaId: number;
  dataDevolucao: DataISO;
}

/** Resultado da simulação (nada é gravado). */
export interface MultaCalculadaDTO {
  diasAtraso: number;
  valor: number;
  /** Qual regra foi usada para calcular. */
  estrategia: 'DIARIA_FIXA' | 'PERCENTUAL';
}

/** Multa lançada à mão pelo ADMIN. */
export interface CriarMultaDTO {
  reservaId: number;
  diasAtraso: number;
  valor: number;
}

/** Correção de uma multa: só os campos que vierem são alterados. */
export interface AtualizarMultaDTO {
  id: number;
  diasAtraso?: number;
  valor?: number;
}

export interface FiltroMultaDTO {
  quitada?: boolean;
  clienteId?: number;
}

/** Pagamento da multa: registra um pagamento do tipo MULTA e marca como quitada. */
export interface QuitarMultaDTO {
  multaId: number;
  forma: FormaPagamento;
}
