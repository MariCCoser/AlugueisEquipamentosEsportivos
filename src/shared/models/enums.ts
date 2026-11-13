/**
 * Valores possíveis das colunas ENUM do banco (migration 001).
 * As listas `as const` servem para validação (ex.: zod) e os tipos derivados para o TypeScript.
 */
export const PERFIS = ['ADMIN', 'FUNCIONARIO'] as const;
export type Perfil = (typeof PERFIS)[number];

export const MODALIDADES = ['VENDA', 'LOCACAO'] as const;
export type Modalidade = (typeof MODALIDADES)[number];

export const ESTADOS_CONSERVACAO = ['NOVO', 'MUITO_BOM', 'MEDIO', 'REGULAR'] as const;
export type EstadoConservacao = (typeof ESTADOS_CONSERVACAO)[number];

export const STATUS_EQUIPAMENTO = [
  'DISPONIVEL',
  'RESERVADO',
  'EM_MANUTENCAO',
  'INDISPONIVEL'
] as const;
export type StatusEquipamento = (typeof STATUS_EQUIPAMENTO)[number];

export const STATUS_RESERVA = ['PENDENTE', 'ATIVA', 'DEVOLVIDA', 'CANCELADA'] as const;
export type StatusReserva = (typeof STATUS_RESERVA)[number];

export const CAUCAO_STATUS = ['NAO_APLICAVEL', 'RETIDA', 'DEVOLVIDA'] as const;
export type CaucaoStatus = (typeof CAUCAO_STATUS)[number];

export const TIPOS_FORNECEDOR = ['COMPRA', 'MANUTENCAO'] as const;
export type TipoFornecedor = (typeof TIPOS_FORNECEDOR)[number];

export const TIPOS_MANUTENCAO = ['PREVENTIVA', 'CORRETIVA'] as const;
export type TipoManutencao = (typeof TIPOS_MANUTENCAO)[number];

export const TIPOS_PAGAMENTO = ['ALUGUEL', 'CAUCAO', 'MULTA'] as const;
export type TipoPagamento = (typeof TIPOS_PAGAMENTO)[number];

export const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'CARTAO'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

/** Formas de calcular multa por atraso (padrão Strategy, ver services/multa/). */
export const ESTRATEGIAS_MULTA = ['PERCENTUAL', 'DIARIA_FIXA'] as const;
export type EstrategiaMultaTipo = (typeof ESTRATEGIAS_MULTA)[number];
