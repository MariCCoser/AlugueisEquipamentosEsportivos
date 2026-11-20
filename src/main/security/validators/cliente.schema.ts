import { z } from 'zod';
import type {
  AtualizarClienteDTO,
  CriarClienteDTO,
  FiltroClienteDTO
} from '@shared/dto/cliente.dto';
import { cpfValido } from '@shared/validadores/cpf';
import { Campos } from './campos.schema';

/**
 * Formato dos dados de cliente que chegam pelo IPC.
 * Tamanhos máximos = tamanhos das colunas na migration 001.
 *
 * CPF: confere os 11 dígitos e os 2 dígitos verificadores, com a mesma função
 * que a tela usa (`cpfValido`, de src/shared/validadores/cpf.ts). A tela avisa na
 * hora; o Main confere de novo porque a tela não é confiável.
 */
const camposCliente = {
  nome: Campos.texto('Nome', 120),
  cpf: Campos.digitos('CPF', 11).refine(cpfValido, { error: 'CPF inválido: confira os números.' }),
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
