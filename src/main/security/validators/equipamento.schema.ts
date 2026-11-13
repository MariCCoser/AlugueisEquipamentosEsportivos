import { z } from 'zod';
import type {
  AlterarStatusEquipamentoDTO,
  AtualizarEquipamentoDTO,
  CriarEquipamentoDTO,
  FiltroEquipamentoDTO,
  ListarDisponiveisDTO,
  VerificarDisponibilidadeDTO
} from '@shared/dto/equipamento.dto';
import { ESTADOS_CONSERVACAO, MODALIDADES, STATUS_EQUIPAMENTO } from '@shared/models/enums';
import { Campos } from './campos.schema';

/**
 * Formato dos dados de equipamento que chegam pelo IPC.
 * Regras que dependem de mais de um campo ou do banco (preço x modalidade,
 * fornecedor de COMPRA) ficam no EquipamentoService.
 */
const modalidade = z.enum(MODALIDADES, { error: 'Modalidade inválida.' });
const estadoConservacao = z.enum(ESTADOS_CONSERVACAO, { error: 'Estado de conservação inválido.' });

const camposEquipamento = {
  nome: Campos.texto('Nome', 120),
  descricao: Campos.textoOpcional('Descrição', 255),
  modalidade,
  estadoConservacao,
  valorDiaria: Campos.dinheiro('Valor da diária').optional(),
  precoVenda: Campos.dinheiro('Preço de venda').optional(),
  dataAquisicao: Campos.data('Data de aquisição').optional(),
  categoriaId: Campos.id('Categoria'),
  fornecedorId: Campos.id('Fornecedor').optional()
};

export const criarEquipamentoSchema: z.ZodType<CriarEquipamentoDTO> = z.object(camposEquipamento);

export const atualizarEquipamentoSchema: z.ZodType<AtualizarEquipamentoDTO> = z
  .object(camposEquipamento)
  .partial()
  .extend({ id: Campos.id('Equipamento') });

export const filtroEquipamentoSchema: z.ZodType<FiltroEquipamentoDTO> = z
  .object({
    categoriaId: Campos.id('Categoria').optional(),
    modalidade: modalidade.optional(),
    status: z.enum(STATUS_EQUIPAMENTO).optional(),
    estadoConservacao: estadoConservacao.optional(),
    busca: z.string().trim().max(120).optional(),
    ...Campos.paginacao()
  })
  .optional()
  .transform((filtro) => filtro ?? {});

const periodo = {
  dataRetirada: Campos.data('Data de retirada'),
  dataDevolucaoPrevista: Campos.data('Data de devolução')
};

export const verificarDisponibilidadeSchema: z.ZodType<VerificarDisponibilidadeDTO> = z.object({
  equipamentoId: Campos.id('Equipamento'),
  ...periodo,
  ignorarReservaId: Campos.id('Reserva').optional()
});

export const listarDisponiveisSchema: z.ZodType<ListarDisponiveisDTO> = z.object({
  ...periodo,
  categoriaId: Campos.id('Categoria').optional()
});

export const alterarStatusEquipamentoSchema: z.ZodType<AlterarStatusEquipamentoDTO> = z.object({
  id: Campos.id('Equipamento'),
  status: z.enum(['DISPONIVEL', 'INDISPONIVEL'], {
    error: 'Só é possível marcar como DISPONIVEL ou INDISPONIVEL.'
  })
});
