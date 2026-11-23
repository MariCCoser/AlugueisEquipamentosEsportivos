import type { AlterarSenhaDTO, LoginDTO, UsuarioSessaoDTO } from '@shared/dto/auth.dto';
import type { Usuario } from '@shared/models/entidades';
import { NaoAutorizadoError, ValidacaoError } from '../errors/ErroApp';
import type { UsuarioRepository } from '../repositories/UsuarioRepository';
import type { HashSenha } from '../security/HashSenha';
import type { LimiteTentativas } from '../security/LimiteTentativas';
import type { Sessao } from '../security/Sessao';

/** Só o que o service usa do repositório (facilita testar com um objeto falso). */
export type RepoUsuariosAuth = Pick<
  UsuarioRepository,
  'buscarPorEmail' | 'buscarPorId' | 'atualizar' | 'registrarLogin'
>;

/** A mesma frase para e-mail que não existe e senha errada: não revela quem tem conta. */
export const MSG_LOGIN_INVALIDO = 'E-mail ou senha incorretos.';

/**
 * Login, logout, sessão atual e troca da própria senha (Pessoa 3).
 *
 * Tudo acontece no Main: a tela só manda e-mail e senha e recebe de volta quem
 * entrou, sem senha nem hash. Quem está logado fica guardado na `Sessao`, e é ela
 * que o RegistroIpc consulta para liberar (ou não) cada canal.
 */
export class AuthService {
  constructor(
    private readonly usuarios: RepoUsuariosAuth,
    private readonly sessao: Sessao,
    private readonly hashSenha: HashSenha,
    private readonly limite: LimiteTentativas
  ) {}

  async login({ email, senha }: LoginDTO): Promise<UsuarioSessaoDTO> {
    const minutos = this.limite.minutosBloqueado(email);
    if (minutos > 0) {
      throw new NaoAutorizadoError(
        `Muitas tentativas erradas. Tente de novo em ${minutos} minuto(s).`
      );
    }

    const usuario = await this.usuarios.buscarPorEmail(email);
    // Confere mesmo quando o usuário não existe, para a resposta demorar o mesmo tempo
    const senhaCerta = await this.hashSenha.conferir(senha, usuario?.senhaHash);
    if (!usuario || !senhaCerta) {
      this.limite.registrarErro(email);
      throw new NaoAutorizadoError(MSG_LOGIN_INVALIDO);
    }
    // Só chega aqui quem sabe a senha, então dá para dizer o motivo real
    if (!usuario.ativo) {
      throw new NaoAutorizadoError('Este usuário está desativado. Fale com um administrador.');
    }

    this.limite.registrarAcerto(email);
    await this.usuarios.registrarLogin(usuario.id);
    const logado = AuthService.paraSessao(usuario);
    this.sessao.iniciar(logado);
    return logado;
  }

  logout(): void {
    this.sessao.encerrar();
  }

  /** `null` quando ninguém está logado (a tela chama antes do login). */
  sessaoAtual(): UsuarioSessaoDTO | null {
    return this.sessao.usuarioAtual();
  }

  /** Troca a senha de quem está logado. Pede a senha atual para confirmar que é a pessoa. */
  async alterarSenha({ senhaAtual, novaSenha }: AlterarSenhaDTO): Promise<void> {
    const logado = this.sessao.usuarioAtual();
    if (!logado) throw new NaoAutorizadoError('Faça login para continuar.');

    const usuario = await this.usuarios.buscarPorId(logado.id);
    if (!usuario || !usuario.ativo) {
      this.sessao.encerrar();
      throw new NaoAutorizadoError('Sua sessão não é mais válida. Faça login de novo.');
    }

    if (!(await this.hashSenha.conferir(senhaAtual, usuario.senhaHash))) {
      throw new ValidacaoError('Dados inválidos. Confira os campos destacados.', {
        senhaAtual: 'Senha atual incorreta.'
      });
    }
    if (senhaAtual === novaSenha) {
      throw new ValidacaoError('Dados inválidos. Confira os campos destacados.', {
        novaSenha: 'A nova senha precisa ser diferente da atual.'
      });
    }

    await this.usuarios.atualizar(usuario.id, {
      senhaHash: await this.hashSenha.gerar(novaSenha)
    });
  }

  /** O que vai para a Sessao e para a tela: nunca a senha nem o hash. */
  static paraSessao(u: Usuario): UsuarioSessaoDTO {
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
  }
}
