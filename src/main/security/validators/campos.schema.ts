import { z } from 'zod';
import { CalendarioISO } from '../../domain/CalendarioISO';

/**
 * Peças reaproveitadas pelos schemas de cada domínio.
 * Mensagens em português, pensadas para aparecer embaixo do campo na tela.
 */
export class Campos {
  /** Id de registro: inteiro positivo. */
  static id(rotulo = 'Registro') {
    return z.int({ error: `${rotulo} inválido.` }).positive({ error: `${rotulo} inválido.` });
  }

  /** Texto obrigatório, sem espaços nas pontas, com tamanho máximo da coluna. */
  static texto(rotulo: string, maximo: number) {
    return z
      .string({ error: `${rotulo} é obrigatório.` })
      .trim()
      .min(1, { error: `${rotulo} é obrigatório.` })
      .max(maximo, { error: `${rotulo} pode ter no máximo ${maximo} caracteres.` });
  }

  /** Texto opcional: vazio vira `undefined`. */
  static textoOpcional(rotulo: string, maximo: number) {
    return z
      .string()
      .trim()
      .max(maximo, { error: `${rotulo} pode ter no máximo ${maximo} caracteres.` })
      .optional()
      .transform((valor) => (valor ? valor : undefined));
  }

  /** Aceita com ou sem pontuação ("529.982.247-25") e devolve só os dígitos. */
  static digitos(rotulo: string, quantidade: number) {
    return z
      .string({ error: `${rotulo} é obrigatório.` })
      .transform((valor) => valor.replace(/\D/g, ''))
      .pipe(z.string().length(quantidade, { error: `${rotulo} deve ter ${quantidade} dígitos.` }));
  }

  static telefone() {
    return z
      .string({ error: 'Telefone é obrigatório.' })
      .transform((valor) => valor.replace(/\D/g, ''))
      .pipe(
        z
          .string()
          .min(10, { error: 'Telefone deve ter DDD + número (10 ou 11 dígitos).' })
          .max(11, { error: 'Telefone deve ter DDD + número (10 ou 11 dígitos).' })
      );
  }

  static emailOpcional() {
    return z
      .union([z.literal(''), z.email({ error: 'E-mail inválido.' }).max(150)])
      .optional()
      .transform((valor) => (valor ? valor : undefined));
  }

  static uf() {
    return z
      .string({ error: 'UF é obrigatória.' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, { error: 'UF deve ter 2 letras, ex.: SP.' });
  }

  /** Data 'AAAA-MM-DD' que existe no calendário. */
  static data(rotulo: string) {
    return z
      .string({ error: `${rotulo} é obrigatória.` })
      .refine((valor) => CalendarioISO.ehValida(valor), {
        error: `${rotulo} inválida (use AAAA-MM-DD).`
      });
  }

  /** Valor em reais: positivo e com no máximo 2 casas decimais (DECIMAL(10,2)). */
  static dinheiro(rotulo: string) {
    return (
      z
        .number({ error: `${rotulo} deve ser um número.` })
        .positive({ error: `${rotulo} deve ser maior que zero.` })
        .max(99_999_999.99, { error: `${rotulo} muito alto.` })
        // tolerância para o ponto flutuante (45.1 * 100 = 4510.000000000001)
        .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, {
          error: `${rotulo} pode ter no máximo 2 casas decimais.`
        })
    );
  }

  /** Campos de paginação (opcionais; o Paginador/BaseRepository aplica os limites). */
  static paginacao() {
    return {
      pagina: z.int().positive().optional(),
      porPagina: z.int().positive().max(100).optional()
    };
  }
}

/** Entrada `{ id }` de buscarPorId/excluir. */
export const idSchema = z.object({ id: Campos.id() });
