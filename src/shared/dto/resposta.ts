export type CodigoErro =
  'VALIDACAO' | 'NAO_ENCONTRADO' | 'REGRA_NEGOCIO' | 'NAO_AUTORIZADO' | 'INTEGRACAO' | 'INTERNO';

export interface ErroDTO {
  codigo: CodigoErro;
  /** Mensagem amigável, sem stack trace nem SQL. */
  mensagem: string;
  /** Erros de validação por campo. */
  campos?: Record<string, string>;
}

/** Formato único de retorno de todo canal IPC. */
export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: ErroDTO };

export interface Paginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

/** Datas trafegam como string ISO 'YYYY-MM-DD' (Date não atravessa o IPC de forma confiável). */
export type DataISO = string;

export function sucesso<T>(dados: T): Resposta<T> {
  return { ok: true, dados };
}

export function falha<T = never>(
  codigo: CodigoErro,
  mensagem: string,
  campos?: Record<string, string>
): Resposta<T> {
  return { ok: false, erro: campos ? { codigo, mensagem, campos } : { codigo, mensagem } };
}
