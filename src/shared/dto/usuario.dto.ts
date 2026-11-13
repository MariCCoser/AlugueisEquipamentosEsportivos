import type { Perfil } from '../models/enums';

/** Cadastro de um novo usuário do sistema (só ADMIN pode). */
export interface CriarUsuarioDTO {
  nome: string;
  email: string;
  /** Senha em texto puro; o Main transforma em hash (bcrypt) antes de gravar. */
  senha: string;
  perfil: Perfil;
}

/** Edição: só os campos que vierem são alterados. */
export interface AtualizarUsuarioDTO {
  id: number;
  nome?: string;
  email?: string;
  perfil?: Perfil;
  ativo?: boolean;
  /** Preencha só se o ADMIN quiser trocar a senha da pessoa. */
  novaSenha?: string;
}

/** Usuário como aparece na tela (sem senha). */
export interface UsuarioDTO {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  ultimoLogin?: string;
  createdAt: string;
}

export interface FiltroUsuarioDTO {
  perfil?: Perfil;
  ativo?: boolean;
  /** Parte do nome ou do e-mail. */
  busca?: string;
}
