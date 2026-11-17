import { z } from 'zod';
import type { AtualizarCategoriaDTO, CriarCategoriaDTO } from '@shared/dto/categoria.dto';
import { Campos } from './campos.schema';

/**
 * Formato dos dados de categoria que chegam pelo IPC.
 * Tamanhos máximos = tamanhos das colunas na migration 001.
 */
const camposCategoria = {
  nome: Campos.texto('Nome', 60).min(2, { error: 'Nome deve ter pelo menos 2 letras.' }),
  descricao: Campos.textoOpcional('Descrição', 255),
  /** Liga o alerta de previsão do tempo na reserva (caiaque, bicicleta, prancha...). */
  sensivelClima: z.boolean({ error: 'Alerta de clima deve ser sim ou não.' })
};

export const criarCategoriaSchema: z.ZodType<CriarCategoriaDTO> = z.object({
  ...camposCategoria,
  sensivelClima: camposCategoria.sensivelClima.optional().default(false)
});

/** Edição parcial: só os campos enviados são alterados. */
export const atualizarCategoriaSchema: z.ZodType<AtualizarCategoriaDTO> = z
  .object(camposCategoria)
  .partial()
  .extend({ id: Campos.id('Categoria') });
