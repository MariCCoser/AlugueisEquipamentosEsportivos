import { z } from 'zod';
import type {
  BuscarCepDTO,
  CalcularRotaDTO,
  PrevisaoClimaEntradaDTO
} from '@shared/dto/integracao.dto';
import { Campos } from './campos.schema';

/** Formato dos dados das APIs externas que chegam pelo IPC. */

export const buscarCepSchema: z.ZodType<BuscarCepDTO> = z.object({
  cep: Campos.digitos('CEP', 8)
});

export const previsaoClimaSchema: z.ZodType<PrevisaoClimaEntradaDTO> = z.object({
  cidade: Campos.texto('Cidade', 80),
  uf: Campos.uf(),
  data: Campos.data('Data da retirada'),
  equipamentoIds: z
    .array(Campos.id('Equipamento'), { error: 'Informe os equipamentos da reserva.' })
    .min(1, { error: 'Informe pelo menos um equipamento.' })
    .max(50, { error: 'Equipamentos demais numa reserva.' })
});

export const calcularRotaSchema: z.ZodType<CalcularRotaDTO> = z.object({
  clienteId: Campos.id('Cliente')
});
