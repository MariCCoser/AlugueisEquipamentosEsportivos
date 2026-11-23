import { z } from 'zod';
import type { AlterarSenhaDTO, LoginDTO } from '@shared/dto/auth.dto';
import type {
  AtualizarUsuarioDTO,
  CriarUsuarioDTO,
  FiltroUsuarioDTO
} from '@shared/dto/usuario.dto';
import { PERFIS } from '@shared/models/enums';
import { SENHA_MAXIMO } from '../HashSenha';
import { Campos } from './campos.schema';

/** Mesmo mínimo da tela (SENHA_MINIMO em UsuarioFormulario.ts, Pessoa 4). */
export const SENHA_MINIMO = 8;

/**
 * Formato dos dados de login e de usuários que chegam pelo IPC.
 * Tamanhos máximos = tamanhos das colunas na migration 001.
 */

/** E-mail obrigatório, sem espaços e em minúsculas (é assim que fica gravado). */
const email = z
  .string({ error: 'E-mail é obrigatório.' })
  .trim()
  .toLowerCase()
  .min(1, { error: 'E-mail é obrigatório.' })
  .max(150, { error: 'E-mail pode ter no máximo 150 caracteres.' })
  .pipe(z.email({ error: 'E-mail inválido.' }));

/** Senha nova: sem trim (espaço também conta), entre 8 e 72 caracteres. */
function senhaNova(rotulo: string) {
  return z
    .string({ error: `${rotulo} é obrigatória.` })
    .min(SENHA_MINIMO, { error: `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.` })
    .max(SENHA_MAXIMO, { error: `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.` });
}

/** Senha digitada para conferir (login, senha atual): só precisa ter sido preenchida. */
function senhaDigitada(rotulo: string) {
  return z
    .string({ error: `${rotulo} é obrigatória.` })
    .min(1, { error: `${rotulo} é obrigatória.` })
    .max(SENHA_MAXIMO, { error: `${rotulo} incorreta.` });
}

const perfil = z.enum(PERFIS, { error: 'Perfil deve ser ADMIN ou FUNCIONARIO.' });

export const loginSchema: z.ZodType<LoginDTO> = z.object({
  email,
  senha: senhaDigitada('Senha')
});

export const alterarSenhaSchema: z.ZodType<AlterarSenhaDTO> = z.object({
  senhaAtual: senhaDigitada('Senha atual'),
  novaSenha: senhaNova('Nova senha')
});

export const criarUsuarioSchema: z.ZodType<CriarUsuarioDTO> = z.object({
  nome: Campos.texto('Nome', 100),
  email,
  senha: senhaNova('Senha'),
  perfil
});

/** Edição parcial: só os campos enviados são alterados. `novaSenha` vazia = não trocar. */
export const atualizarUsuarioSchema: z.ZodType<AtualizarUsuarioDTO> = z.object({
  id: Campos.id('Usuário'),
  nome: Campos.texto('Nome', 100).optional(),
  email: email.optional(),
  perfil: perfil.optional(),
  ativo: z.boolean({ error: 'Ativo deve ser sim ou não.' }).optional(),
  novaSenha: z
    .union([z.literal(''), senhaNova('Nova senha')])
    .optional()
    .transform((valor) => (valor ? valor : undefined))
});

export const filtroUsuarioSchema: z.ZodType<FiltroUsuarioDTO> = z
  .object({
    perfil: perfil.optional(),
    ativo: z.boolean().optional(),
    busca: z.string().trim().max(150).optional()
  })
  .optional()
  .transform((filtro) => filtro ?? {});
