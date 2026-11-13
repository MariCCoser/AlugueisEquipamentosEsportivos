import type { z } from 'zod';
import { ValidacaoError } from '../../errors/DominioError';

/**
 * Aplica um schema zod ao que chegou pelo IPC.
 *
 * - Dado válido: devolve já convertido e só com os campos do schema
 *   (campos extras, como `status` ou `usuarioId` mandados pela tela, são descartados).
 * - Dado inválido: lança ValidacaoError com uma mensagem por campo, que o
 *   RegistroIpc devolve como `{ codigo: 'VALIDACAO', campos }` para a tela marcar o formulário.
 */
export class Validador {
  static validar<T>(schema: z.ZodType<T>, entrada: unknown): T {
    const resultado = schema.safeParse(entrada);
    if (resultado.success) return resultado.data;

    const campos: Record<string, string> = {};
    for (const problema of resultado.error.issues) {
      const campo = problema.path.join('.') || 'entrada';
      campos[campo] ??= problema.message; // a primeira mensagem de cada campo basta
    }
    throw new ValidacaoError('Dados inválidos. Confira os campos destacados.', campos);
  }
}
