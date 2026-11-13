export interface CriarCategoriaDTO {
  nome: string;
  descricao?: string;
  /** true = mostra alerta de previsão do tempo ao reservar itens desta categoria. */
  sensivelClima?: boolean;
}

/** Edição: só os campos que vierem são alterados. */
export interface AtualizarCategoriaDTO extends Partial<CriarCategoriaDTO> {
  id: number;
}

export interface CategoriaDTO {
  id: number;
  nome: string;
  descricao?: string;
  sensivelClima: boolean;
  /** Quantos equipamentos usam esta categoria (se for mais que 0, não dá para excluir). */
  qtdEquipamentos: number;
}
