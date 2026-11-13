import { z } from 'zod';
import type { ReservaIdDTO } from '@shared/dto/comum.dto';
import type {
  AtualizarItemReservaDTO,
  AtualizarReservaDTO,
  CancelarReservaDTO,
  CriarItemReservaDTO,
  CriarReservaDTO,
  FiltroReservaDTO
} from '@shared/dto/reserva.dto';
import type { RegistrarDevolucaoDTO } from '@shared/dto/devolucao.dto';
import { ESTADOS_CONSERVACAO, STATUS_RESERVA } from '@shared/models/enums';
import { Campos } from './campos.schema';

/**
 * Formato dos dados de reserva que chegam pelo IPC.
 * Repare que NÃO existem campos de diária, valor total ou usuário: esses
 * valores são calculados/definidos no Main, e o zod descarta se a tela mandar.
 */
const itens = z
  .array(z.object({ equipamentoId: Campos.id('Equipamento') }), {
    error: 'Escolha os equipamentos.'
  })
  .min(1, { error: 'Escolha pelo menos um equipamento.' })
  .max(50, { error: 'No máximo 50 equipamentos por reserva.' });

const caucao = z
  .number({ error: 'Caução deve ser um número.' })
  .min(0, { error: 'Caução não pode ser negativa.' })
  .max(99_999_999.99)
  .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, {
    error: 'Caução pode ter no máximo 2 casas decimais.'
  });

const camposReserva = {
  clienteId: Campos.id('Cliente'),
  dataRetirada: Campos.data('Data de retirada'),
  dataDevolucaoPrevista: Campos.data('Data de devolução'),
  itens,
  valorCaucao: caucao,
  observacoes: Campos.textoOpcional('Observações', 255)
};

export const criarReservaSchema: z.ZodType<CriarReservaDTO> = z.object(camposReserva);

export const atualizarReservaSchema: z.ZodType<AtualizarReservaDTO> = z
  .object(camposReserva)
  .partial()
  .extend({ id: Campos.id('Reserva') });

export const filtroReservaSchema: z.ZodType<FiltroReservaDTO> = z
  .object({
    status: z.enum(STATUS_RESERVA, { error: 'Status inválido.' }).optional(),
    clienteId: Campos.id('Cliente').optional(),
    dataInicio: Campos.data('Data inicial').optional(),
    dataFim: Campos.data('Data final').optional(),
    ...Campos.paginacao()
  })
  .optional()
  .transform((filtro) => filtro ?? {});

export const cancelarReservaSchema: z.ZodType<CancelarReservaDTO> = z.object({
  id: Campos.id('Reserva'),
  motivo: Campos.textoOpcional('Motivo', 200)
});

export const reservaIdSchema: z.ZodType<ReservaIdDTO> = z.object({
  reservaId: Campos.id('Reserva')
});

export const criarItemReservaSchema: z.ZodType<CriarItemReservaDTO> = z.object({
  reservaId: Campos.id('Reserva'),
  equipamentoId: Campos.id('Equipamento')
});

export const atualizarItemReservaSchema: z.ZodType<AtualizarItemReservaDTO> = z.object({
  id: Campos.id('Item'),
  equipamentoId: Campos.id('Equipamento')
});

export const registrarDevolucaoSchema: z.ZodType<RegistrarDevolucaoDTO> = z.object({
  reservaId: Campos.id('Reserva'),
  dataDevolucaoReal: Campos.data('Data de devolução'),
  itens: z
    .array(
      z.object({
        itemReservaId: Campos.id('Item'),
        estadoDevolucao: z.enum(ESTADOS_CONSERVACAO, { error: 'Estado de conservação inválido.' })
      }),
      { error: 'Informe o estado de cada equipamento.' }
    )
    .min(1, { error: 'Informe o estado de cada equipamento.' })
    .max(50),
  reterCaucao: z.boolean().optional()
});
