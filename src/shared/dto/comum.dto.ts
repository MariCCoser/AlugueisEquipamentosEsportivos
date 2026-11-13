import type { DataISO } from './resposta';

/** Entrada dos canais que só precisam saber "qual registro" (buscarPorId, excluir...). */
export interface IdDTO {
  id: number;
}

/** Entrada dos canais que trabalham com uma reserva específica. */
export interface ReservaIdDTO {
  reservaId: number;
}

/** Um intervalo de datas de aluguel. As duas datas contam (do dia da retirada ao dia da devolução). */
export interface PeriodoDTO {
  dataRetirada: DataISO;
  dataDevolucaoPrevista: DataISO;
}

/** Campos de paginação que as telas de listagem mandam. */
export interface PaginacaoDTO {
  /** Começa em 1. Se não vier, é a primeira página. */
  pagina?: number;
  /** Quantos itens por página (máximo 100). */
  porPagina?: number;
}
