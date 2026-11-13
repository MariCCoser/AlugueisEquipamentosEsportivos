import type { TipoFornecedor } from '../models/enums';

export interface CriarFornecedorDTO {
  razaoSocial: string;
  /** Só os 14 dígitos. */
  cnpj: string;
  /** COMPRA = de quem compramos equipamentos; MANUTENCAO = quem conserta. */
  tipo: TipoFornecedor;
  contato?: string;
  telefone?: string;
  email?: string;
}

/** Edição: só os campos que vierem são alterados. */
export interface AtualizarFornecedorDTO extends Partial<CriarFornecedorDTO> {
  id: number;
}

export interface FornecedorDTO extends CriarFornecedorDTO {
  id: number;
}

export interface FiltroFornecedorDTO {
  tipo?: TipoFornecedor;
  /** Parte da razão social ou começo do CNPJ. */
  busca?: string;
}

/** Entrada de `fornecedores:listarPorTipo` (abas da tela e listas de seleção). */
export interface TipoFornecedorDTO {
  tipo: TipoFornecedor;
}
