import { z } from 'zod';
import type {
  AtualizarManutencaoDTO,
  CriarManutencaoDTO,
  EquipamentoIdDTO,
  FiltroManutencaoDTO,
  RegistrarRetornoDTO
} from '@shared/dto/manutencao.dto';
import { ESTADOS_CONSERVACAO, TIPOS_MANUTENCAO } from '@shared/models/enums';
import { Campos } from './campos.schema';

/** Formato dos dados de manutenção que chegam pelo IPC (tamanhos = colunas da migration). */
const tipo = z.enum(TIPOS_MANUTENCAO, { error: 'Tipo de manutenção inválido.' });
const custo = z
  .number({ error: 'Custo deve ser um número.' })
  .min(0, { error: 'Custo não pode ser negativo.' })
  .max(99_999_999.99)
  .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, {
    error: 'Custo pode ter no máximo 2 casas decimais.'
  });

export const criarManutencaoSchema: z.ZodType<CriarManutencaoDTO> = z.object({
  equipamentoId: Campos.id('Equipamento'),
  fornecedorId: Campos.id('Prestador'),
  tipo,
  descricao: Campos.texto('Descrição', 255),
  dataEnvio: Campos.data('Data de envio')
});

export const atualizarManutencaoSchema: z.ZodType<AtualizarManutencaoDTO> = z.object({
  id: Campos.id('Manutenção'),
  tipo: tipo.optional(),
  descricao: Campos.texto('Descrição', 255).optional(),
  dataEnvio: Campos.data('Data de envio').optional(),
  custo: custo.optional()
});

export const registrarRetornoSchema: z.ZodType<RegistrarRetornoDTO> = z.object({
  id: Campos.id('Manutenção'),
  dataRetorno: Campos.data('Data de retorno'),
  custo: custo.optional(),
  estadoRetorno: z.enum(ESTADOS_CONSERVACAO, { error: 'Estado de conservação inválido.' })
});

export const filtroManutencaoSchema: z.ZodType<FiltroManutencaoDTO> = z
  .object({
    abertas: z.boolean().optional(),
    tipo: tipo.optional(),
    fornecedorId: Campos.id('Prestador').optional()
  })
  .optional()
  .transform((filtro) => filtro ?? {});

export const equipamentoIdSchema: z.ZodType<EquipamentoIdDTO> = z.object({
  equipamentoId: Campos.id('Equipamento')
});
