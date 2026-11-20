import type {
  AtualizarUsuarioDTO,
  CriarUsuarioDTO,
  FiltroUsuarioDTO,
  UsuarioDTO
} from '@shared/dto/usuario.dto';
import type { NovoUsuario, Usuario } from '@shared/models/entidades';
import {
  NaoAutorizadoError,
  NaoEncontradoError,
  RegraNegocioError,
  ValidacaoError
} from '../errors/ErroApp';
import { TradutorErroBanco } from '../errors/TradutorErroBanco';
import type { UsuarioRepository } from '../repositories/UsuarioRepository';
import type { HashSenha } from '../security/HashSenha';
import type { Sessao } from '../security/Sessao';
import { AuthService } from './AuthService';

/** Só o que o service usa do repositório (facilita testar com um objeto falso). */
export type RepoUsuariosCadastro = Pick<
  UsuarioRepository,
  | 'criar'
  | 'buscarPorId'
  | 'buscarPorEmail'
  | 'listarFiltrado'
  | 'atualizar'
  | 'excluir'
  | 'contarReservas'
>;

const MSG_DADOS_INVALIDOS = 'Dados inválidos. Confira os campos destacados.';
const MSG_EMAIL_DUPLICADO = 'Já existe um usuário com este e-mail.';

/**
 * Cadastro de usuários do sistema (Pessoa 3). Todos os canais são só para ADMIN
 * (ver permissoes.ts). O formato dos dados é validado antes, pelo usuario.schema.ts;
 * aqui ficam as regras que dependem do banco e de quem está logado.
 *
 * Senhas: chegam em texto puro, viram hash bcrypt aqui e só o hash é gravado.
 * Nenhum método devolve a senha nem o hash para a tela.
 */
export class UsuarioService {
  constructor(
    private readonly usuarios: RepoUsuariosCadastro,
    private readonly hashSenha: HashSenha,
    private readonly sessao: Pick<Sessao, 'usuarioAtual' | 'iniciar'>
  ) {}

  async listar(filtro: FiltroUsuarioDTO = {}): Promise<UsuarioDTO[]> {
    const lista = await this.usuarios.listarFiltrado(filtro);
    return lista.map((u) => UsuarioService.paraDTO(u));
  }

  async buscarPorId(id: number): Promise<UsuarioDTO> {
    return UsuarioService.paraDTO(await this.obter(id));
  }

  async criar(dados: CriarUsuarioDTO): Promise<UsuarioDTO> {
    await this.garantirEmailLivre(dados.email);
    const novo: NovoUsuario = {
      nome: dados.nome,
      email: dados.email,
      senhaHash: await this.hashSenha.gerar(dados.senha),
      perfil: dados.perfil,
      ativo: true
    };
    const criado = await TradutorErroBanco.proteger(() => this.usuarios.criar(novo), {
      duplicado: MSG_EMAIL_DUPLICADO
    });
    return UsuarioService.paraDTO(criado);
  }

  async atualizar({ id, novaSenha, ...dados }: AtualizarUsuarioDTO): Promise<UsuarioDTO> {
    await this.obter(id);
    const ehVoceMesmo = id === this.idLogado();

    // Evita a pessoa se trancar fora do sistema (ou tirar o único ADMIN sem querer)
    if (ehVoceMesmo && (dados.ativo === false || (dados.perfil && dados.perfil !== 'ADMIN'))) {
      throw new RegraNegocioError('Você não pode desativar nem rebaixar o seu próprio usuário.');
    }
    if (dados.email !== undefined) await this.garantirEmailLivre(dados.email, id);

    const alteracoes: Partial<NovoUsuario> = {
      nome: dados.nome,
      email: dados.email,
      perfil: dados.perfil,
      ativo: dados.ativo,
      senhaHash: novaSenha ? await this.hashSenha.gerar(novaSenha) : undefined
    };
    const atualizado = await TradutorErroBanco.proteger(
      () => this.usuarios.atualizar(id, alteracoes),
      { duplicado: MSG_EMAIL_DUPLICADO }
    );
    if (!atualizado) throw new NaoEncontradoError('Usuário', id);

    // Mudou o próprio nome ou e-mail: o menu lateral já mostra o novo
    if (ehVoceMesmo) this.sessao.iniciar(AuthService.paraSessao(atualizado));
    return UsuarioService.paraDTO(atualizado);
  }

  /**
   * Quem já registrou reservas não pode ser excluído: o histórico precisa continuar
   * dizendo quem atendeu. Para tirar o acesso, a tela sugere desativar.
   */
  async excluir(id: number): Promise<void> {
    const usuario = await this.obter(id);
    if (id === this.idLogado()) {
      throw new RegraNegocioError('Você não pode excluir o seu próprio usuário.');
    }
    const reservas = await this.usuarios.contarReservas(id);
    if (reservas > 0) {
      throw new RegraNegocioError(
        `Não é possível excluir ${usuario.nome}: ele(a) já registrou ${reservas} reserva(s). Desative o acesso.`
      );
    }
    await TradutorErroBanco.proteger(() => this.usuarios.excluir(id), {
      emUso: `Não é possível excluir ${usuario.nome}: há registros ligados a ele(a). Desative o acesso.`
    });
  }

  private idLogado(): number {
    const logado = this.sessao.usuarioAtual();
    // O RegistroIpc já exige ADMIN logado; isto só protege contra uso fora do IPC
    if (!logado) throw new NaoAutorizadoError('Faça login para continuar.');
    return logado.id;
  }

  private async obter(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) throw new NaoEncontradoError('Usuário', id);
    return usuario;
  }

  /** Mensagem no campo e-mail (erro.campos.email), antes do UNIQUE do banco. */
  private async garantirEmailLivre(email: string, idAtual?: number): Promise<void> {
    const existente = await this.usuarios.buscarPorEmail(email);
    if (existente && existente.id !== idAtual) {
      throw new ValidacaoError(MSG_DADOS_INVALIDOS, { email: MSG_EMAIL_DUPLICADO });
    }
  }

  /** Usuário como aparece na tela: sem senha e sem hash. */
  static paraDTO(u: Usuario): UsuarioDTO {
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      ativo: u.ativo,
      ultimoLogin: u.ultimoLogin ?? undefined,
      createdAt: u.createdAt
    };
  }
}
