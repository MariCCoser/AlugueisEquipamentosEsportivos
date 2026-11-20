import type {
  EstadoConservacao,
  FormaPagamento,
  Modalidade,
  Perfil,
  StatusEquipamento,
  StatusReserva,
  TipoManutencao,
  TipoPagamento
} from '@shared/models/enums';

/**
 * Textos que a tela mostra no lugar dos valores ENUM do banco
 * ('EM_MANUTENCAO' → 'Em manutenção'). Um lugar só, para todas as telas usarem igual.
 */
export const ROTULOS_STATUS_EQUIPAMENTO: Record<StatusEquipamento, string> = {
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  EM_MANUTENCAO: 'Em manutenção',
  INDISPONIVEL: 'Indisponível'
};

/** Cor da etiqueta de cada status (a etiqueta sempre leva o texto também, nunca só a cor). */
export const TOM_STATUS_EQUIPAMENTO: Record<
  StatusEquipamento,
  'sucesso' | 'info' | 'alerta' | 'erro'
> = {
  DISPONIVEL: 'sucesso',
  RESERVADO: 'info',
  EM_MANUTENCAO: 'alerta',
  INDISPONIVEL: 'erro'
};

export const ROTULOS_MODALIDADE: Record<Modalidade, string> = {
  LOCACAO: 'Locação',
  VENDA: 'Venda'
};

export const ROTULOS_ESTADO_CONSERVACAO: Record<EstadoConservacao, string> = {
  NOVO: 'Novo',
  MUITO_BOM: 'Muito bom',
  MEDIO: 'Médio',
  REGULAR: 'Regular'
};

export const ROTULOS_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Funcionário'
};

export const ROTULOS_STATUS_RESERVA: Record<StatusReserva, string> = {
  PENDENTE: 'Pendente',
  ATIVA: 'Ativa',
  DEVOLVIDA: 'Devolvida',
  CANCELADA: 'Cancelada'
};

export const TOM_STATUS_RESERVA: Record<StatusReserva, 'sucesso' | 'info' | 'alerta' | 'erro'> = {
  PENDENTE: 'alerta',
  ATIVA: 'info',
  DEVOLVIDA: 'sucesso',
  CANCELADA: 'erro'
};

export const ROTULOS_TIPO_PAGAMENTO: Record<TipoPagamento, string> = {
  ALUGUEL: 'Aluguel',
  CAUCAO: 'Caução',
  MULTA: 'Multa'
};

export const ROTULOS_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  CARTAO: 'Cartão'
};

export const ROTULOS_TIPO_MANUTENCAO: Record<TipoManutencao, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva (conserto)'
};

/** Transforma um Record de rótulos nas opções de um <select>. */
export function opcoesDe<K extends string>(
  rotulos: Record<K, string>
): { valor: K; rotulo: string }[] {
  return (Object.keys(rotulos) as K[]).map((valor) => ({ valor, rotulo: rotulos[valor] }));
}
