import { z } from 'zod';
import type {
  CalcularMultaDTO,
  AtualizarMultaDTO,
  CriarMultaDTO,
  FiltroMultaDTO,
  QuitarMultaDTO
} from '@shared/dto/multa.dto';
import type {
  AtualizarPagamentoDTO,
  CriarPagamentoDTO,
  DevolverCaucaoDTO,
  FiltroPagamentoDTO
} from '@shared/dto/pagamento.dto';
import { FORMAS_PAGAMENTO, TIPOS_PAGAMENTO } from '@shared/models/enums';
import { Campos } from './campos.schema';

/**
 * Formato dos dados de multas e pagamentos que chegam pelo IPC.
 * Regras que dependem do banco (não pagar mais que o devido, multa da reserva
 * certa) ficam no PagamentoService / MultaService.
 */
const forma = z.enum(FORMAS_PAGAMENTO, { error: 'Forma de pagamento inválida.' });
const diasAtraso = z
  .int({ error: 'Dias de atraso deve ser um número inteiro.' })
  .positive({ error: 'Dias de atraso deve ser maior que zero.' })
  .max(3650);

// ---------- multas ----------

export const calcularMultaSchema: z.ZodType<CalcularMultaDTO> = z.object({
  reservaId: Campos.id('Reserva'),
  dataDevolucao: Campos.data('Data de devolução')
});

export const criarMultaSchema: z.ZodType<CriarMultaDTO> = z.object({
  reservaId: Campos.id('Reserva'),
  diasAtraso,
  valor: Campos.dinheiro('Valor')
});

export const atualizarMultaSchema: z.ZodType<AtualizarMultaDTO> = z.object({
  id: Campos.id('Multa'),
  diasAtraso: diasAtraso.optional(),
  valor: Campos.dinheiro('Valor').optional()
});

export const filtroMultaSchema: z.ZodType<FiltroMultaDTO> = z
  .object({ quitada: z.boolean().optional(), clienteId: Campos.id('Cliente').optional() })
  .optional()
  .transform((filtro) => filtro ?? {});

export const quitarMultaSchema: z.ZodType<QuitarMultaDTO> = z.object({
  multaId: Campos.id('Multa'),
  forma
});

// ---------- pagamentos ----------

export const criarPagamentoSchema: z.ZodType<CriarPagamentoDTO> = z.object({
  reservaId: Campos.id('Reserva'),
  multaId: Campos.id('Multa').optional(),
  tipo: z.enum(TIPOS_PAGAMENTO, { error: 'Tipo de pagamento inválido.' }),
  forma,
  valor: Campos.dinheiro('Valor')
});

export const atualizarPagamentoSchema: z.ZodType<AtualizarPagamentoDTO> = z.object({
  id: Campos.id('Pagamento'),
  forma: forma.optional(),
  valor: Campos.dinheiro('Valor').optional()
});

export const filtroPagamentoSchema: z.ZodType<FiltroPagamentoDTO> = z
  .object({
    tipo: z.enum(TIPOS_PAGAMENTO).optional(),
    dataInicio: Campos.data('Data inicial').optional(),
    dataFim: Campos.data('Data final').optional()
  })
  .optional()
  .transform((filtro) => filtro ?? {});

export const devolverCaucaoSchema: z.ZodType<DevolverCaucaoDTO> = z.object({
  reservaId: Campos.id('Reserva'),
  reter: z.boolean({ error: 'Informe se a caução fica retida ou é devolvida.' })
});
