import type { FormaPagamento, TipoPagamento } from '../models/enums';
import type { DataISO } from './resposta';

export interface CriarPagamentoDTO {
  reservaId: number;
  /** Obrigatório quando o tipo é MULTA (e só nesse caso). */
  multaId?: number;
  tipo: TipoPagamento;
  forma: FormaPagamento;
  valor: number;
}

/** Correção de um lançamento: só os campos que vierem são alterados. */
export interface AtualizarPagamentoDTO {
  id: number;
  forma?: FormaPagamento;
  valor?: number;
}

export interface PagamentoDTO {
  id: number;
  reservaId: number;
  multaId?: number;
  tipo: TipoPagamento;
  forma: FormaPagamento;
  valor: number;
  /** Data e hora do pagamento. */
  data: string;
}

export interface FiltroPagamentoDTO {
  tipo?: TipoPagamento;
  dataInicio?: DataISO;
  dataFim?: DataISO;
}

/** O que fazer com a caução no fim da reserva. */
export interface DevolverCaucaoDTO {
  reservaId: number;
  /** true = fica com a caução (ex.: para cobrir multa); false = devolve ao cliente. */
  reter: boolean;
}
