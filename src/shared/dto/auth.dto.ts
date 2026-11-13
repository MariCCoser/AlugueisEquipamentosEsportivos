import type { Perfil } from '../models/enums';

/** O que a tela de login envia. */
export interface LoginDTO {
  email: string;
  senha: string;
}

/** Quem está logado. Nunca leva a senha (nem o hash dela). */
export interface UsuarioSessaoDTO {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
}

/** Troca da própria senha: pede a atual para confirmar que é a pessoa mesmo. */
export interface AlterarSenhaDTO {
  senhaAtual: string;
  novaSenha: string;
}
