import { z } from 'zod';
import type {
  AtualizarClienteDTO,
  CriarClienteDTO,
  FiltroClienteDTO
} from '@shared/dto/cliente.dto';
import { Campos } from './campos.schema';

/**
 * Formato dos dados de cliente que chegam pelo IPC.
 * Tamanhos máximos = tamanhos das colunas na migration 001.
 *
 * Pendente (Pessoa 3): validar o dígito verificador do CPF. Hoje o schema
 * confere só os 11 dígitos.
 */
const camposCliente = {
  nome: Campos.texto('Nome', 120),
  cpf: Campos.digitos('CPF', 11),
  telefone: Campos.telefone(),
  email: Campos.emailOpcional(),
  cep: Campos.digitos('CEP', 8),
  rua: Campos.texto('Rua', 150),
  numero: Campos.texto('Número', 10),
  complemento: Campos.textoOpcional('Complemento', 60),
  bairro: Campos.texto('Bairro', 80),
  cidade: Campos.texto('Cidade', 80),
  uf: Campos.uf()
};

export const criarClienteSchema: z.ZodType<CriarClienteDTO> = z.object(camposCliente);

export const atualizarClienteSchema: z.ZodType<AtualizarClienteDTO> = z
  .object(camposCliente)
  .partial()
  .extend({ id: Campos.id('Cliente') });

export const filtroClienteSchema: z.ZodType<FiltroClienteDTO> = z
  .object({
    busca: z.string().trim().max(120).optional(),
    ...Campos.paginacao()
  })
  .optional()
  .transform((filtro) => filtro ?? {});
