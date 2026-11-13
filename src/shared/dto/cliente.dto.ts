import type { PaginacaoDTO } from './comum.dto';
import type { MultaDTO } from './multa.dto';
import type { PagamentoDTO } from './pagamento.dto';
import type { ReservaResumoDTO } from './reserva.dto';

export interface CriarClienteDTO {
  nome: string;
  /** Só os 11 dígitos, sem pontos nem traço. */
  cpf: string;
  telefone: string;
  email?: string;
  /** Só os 8 dígitos. */
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  /** Sigla do estado, ex.: 'SP'. */
  uf: string;
}

/** Edição: só os campos que vierem são alterados. */
export interface AtualizarClienteDTO extends Partial<CriarClienteDTO> {
  id: number;
}

export interface ClienteDTO extends CriarClienteDTO {
  id: number;
  /** CPF escondido para mostrar na tela, ex.: ***.456.789-** (LGPD). */
  cpfMascarado: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiltroClienteDTO extends PaginacaoDTO {
  /** Parte do nome ou começo do CPF. */
  busca?: string;
}

/** Tudo o que o cliente tem com a loja, para a tela de detalhes. */
export interface HistoricoClienteDTO {
  cliente: ClienteDTO;
  reservasAtivas: ReservaResumoDTO[];
  reservasAnteriores: ReservaResumoDTO[];
  pagamentos: PagamentoDTO[];
  multasEmAberto: MultaDTO[];
  /** Soma das multas ainda não pagas. */
  totalPendente: number;
}
