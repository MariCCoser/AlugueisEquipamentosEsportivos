import { z } from 'zod';
import type {
  AtualizarFornecedorDTO,
  CriarFornecedorDTO,
  FiltroFornecedorDTO,
  TipoFornecedorDTO
} from '@shared/dto/fornecedor.dto';
import { TIPOS_FORNECEDOR } from '@shared/models/enums';
import { cnpjValido } from '@shared/validadores/cnpj';
import { Campos } from './campos.schema';

/**
 * Formato dos dados de fornecedor que chegam pelo IPC.
 * Tamanhos máximos = tamanhos das colunas na migration 001.
 */
const tipo = z.enum(TIPOS_FORNECEDOR, { error: 'Tipo deve ser COMPRA ou MANUTENCAO.' });

/** Telefone é opcional no fornecedor: vazio vira `undefined`, preenchido segue a regra do grupo. */
const telefoneOpcional = z
  .union([z.literal(''), Campos.telefone()])
  .optional()
  .transform((valor) => (valor ? valor : undefined));

const camposFornecedor = {
  razaoSocial: Campos.texto('Razão social', 150).min(3, {
    error: 'Razão social deve ter pelo menos 3 letras.'
  }),
  cnpj: Campos.digitos('CNPJ', 14).refine(cnpjValido, {
    error: 'CNPJ inválido: confira os números.'
  }),
  tipo,
  contato: Campos.textoOpcional('Contato', 100),
  telefone: telefoneOpcional,
  email: Campos.emailOpcional()
};

export const criarFornecedorSchema: z.ZodType<CriarFornecedorDTO> = z.object(camposFornecedor);

/** Edição parcial: só os campos enviados são alterados. */
export const atualizarFornecedorSchema: z.ZodType<AtualizarFornecedorDTO> = z
  .object(camposFornecedor)
  .partial()
  .extend({ id: Campos.id('Fornecedor') });

export const filtroFornecedorSchema: z.ZodType<FiltroFornecedorDTO> = z
  .object({
    tipo: tipo.optional(),
    busca: z.string().trim().max(150).optional()
  })
  .optional()
  .transform((filtro) => filtro ?? {});

export const tipoFornecedorSchema: z.ZodType<TipoFornecedorDTO> = z.object({ tipo });
