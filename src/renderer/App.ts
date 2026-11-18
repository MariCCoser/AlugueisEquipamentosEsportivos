import type { UsuarioSessaoDTO } from '@shared/dto/auth.dto';
import { carregando } from './components/Estados';
import { Layout, type ItemMenu } from './components/Layout';
import { Toast } from './components/Toast';
import { botao } from './nucleo/dom';
import { NOME_APP, Roteador } from './nucleo/Roteador';
import type { DefinicaoRota } from './util/rotas';
import type { Tela } from './nucleo/Tela';
import { DashboardTela } from './pages/DashboardTela';
import { DevolucoesTela } from './pages/devolucoes/DevolucoesTela';
import { CategoriasTela } from './pages/categorias/CategoriasTela';
import { ClienteHistoricoTela } from './pages/clientes/ClienteHistoricoTela';
import { ClientesTela } from './pages/clientes/ClientesTela';
import { EmConstrucaoTela } from './pages/EmConstrucaoTela';
import { EquipamentosTela } from './pages/equipamentos/EquipamentosTela';
import { FornecedoresTela } from './pages/fornecedores/FornecedoresTela';
import { LoginTela } from './pages/LoginTela';
import { ManutencoesTela } from './pages/manutencoes/ManutencoesTela';
import { PagamentosTela } from './pages/pagamentos/PagamentosTela';
import { NovaReservaTela } from './pages/reservas/NovaReservaTela';
import { StatusSistemaTela } from './pages/StatusSistemaTela';
import { abrirAlterarSenha } from './pages/usuarios/AlterarSenhaFormulario';
import { UsuariosTela } from './pages/usuarios/UsuariosTela';
import { ROTULOS_PERFIL } from './util/rotulos';

/** Itens do menu lateral, na ordem em que aparecem. */
const MENU: readonly ItemMenu[] = [
  { caminho: '/', rotulo: 'Painel' },
  { caminho: '/reservas/nova', rotulo: 'Nova reserva' },
  { caminho: '/devolucoes', rotulo: 'Devoluções' },
  { caminho: '/equipamentos', rotulo: 'Inventário' },
  { caminho: '/clientes', rotulo: 'Clientes' },
  { caminho: '/categorias', rotulo: 'Categorias' },
  { caminho: '/fornecedores', rotulo: 'Fornecedores' },
  { caminho: '/manutencoes', rotulo: 'Manutenções' },
  { caminho: '/pagamentos', rotulo: 'Pagamentos' },
  { caminho: '/usuarios', rotulo: 'Usuários' }
];

/** Telas ainda não construídas apontam para EmConstrucaoTela com o nome do menu. */
const emConstrucao = (caminho: string): DefinicaoRota<Tela> => {
  const titulo = MENU.find((item) => item.caminho === caminho)?.rotulo ?? 'Em construção';
  return { caminho, criar: () => new EmConstrucaoTela(titulo) };
};

/** Telas já construídas. */
const TELAS: readonly DefinicaoRota<Tela>[] = [
  { caminho: '/', criar: () => new DashboardTela() },
  { caminho: '/sistema', criar: () => new StatusSistemaTela() },
  { caminho: '/categorias', criar: () => new CategoriasTela() },
  { caminho: '/fornecedores', criar: (_p, consulta) => new FornecedoresTela(consulta) },
  { caminho: '/equipamentos', criar: (_p, consulta) => new EquipamentosTela(consulta) },
  { caminho: '/clientes', criar: () => new ClientesTela() },
  { caminho: '/clientes/:id', criar: (parametros) => new ClienteHistoricoTela(parametros['id']) },
  { caminho: '/usuarios', criar: () => new UsuariosTela() },
  { caminho: '/reservas/nova', criar: () => new NovaReservaTela() },
  { caminho: '/devolucoes', criar: (_p, consulta) => new DevolucoesTela(consulta) },
  { caminho: '/pagamentos', criar: (_p, consulta) => new PagamentosTela(consulta) },
  { caminho: '/manutencoes', criar: (_p, consulta) => new ManutencoesTela(consulta) }
];

const ROTAS: readonly DefinicaoRota<Tela>[] = [
  ...TELAS,
  ...MENU.filter((item) => !TELAS.some((t) => t.caminho === item.caminho)).map((item) =>
    emConstrucao(item.caminho)
  )
];

/** Telas que só o ADMIN vê no menu (o Main bloqueia os canais de qualquer forma). */
const SO_ADMIN = new Set(['/usuarios']);

/**
 * Monta a janela. Primeiro confere a sessão no Main (auth:sessaoAtual):
 * - ninguém logado → tela de login;
 * - logado → layout com menu + roteador desenhando as telas no conteúdo.
 * Se a sessão não puder ser conferida, fica na tela de login (fecha por padrão):
 * sem login os canais do sistema recusam tudo mesmo.
 */
export class App {
  private roteador: Roteador | null = null;
  private modoSimulado = false;

  constructor(private readonly raiz: HTMLElement) {}

  /** `modoSimulado`: aberto fora do Electron (só em desenvolvimento), com dados de exemplo. */
  iniciar(modoSimulado = false): void {
    this.modoSimulado = modoSimulado;
    this.raiz.replaceChildren(carregando('Abrindo o sistema...'));
    void this.conferirSessao();
  }

  private async conferirSessao(): Promise<void> {
    const sessao = await window.api.auth.sessaoAtual().catch(() => null);
    if (sessao?.ok && sessao.dados) {
      this.entrar(sessao.dados);
      return;
    }
    const login = this.mostrarLogin();
    if (!sessao?.ok) {
      login.mostrarMensagem(
        `Não foi possível conferir a sessão: ${sessao?.erro.mensagem ?? 'sem comunicação com o sistema.'}`
      );
    }
  }

  private mostrarLogin(aviso?: string): LoginTela {
    this.roteador?.parar();
    this.roteador = null;
    const login = new LoginTela((usuario) => this.entrar(usuario), aviso);
    login.montar(this.raiz);
    return login;
  }

  private entrar(usuario: UsuarioSessaoDTO): void {
    const menu = MENU.filter((item) => usuario.perfil === 'ADMIN' || !SO_ADMIN.has(item.caminho));
    const layout = new Layout(menu, NOME_APP, 'Carregando versão...');
    layout.mostrarUsuario(usuario.nome, ROTULOS_PERFIL[usuario.perfil], [
      botao('Trocar senha', () => abrirAlterarSenha(), 'padrao', {
        'aria-label': 'Trocar a minha senha'
      }),
      botao('Sair', () => void this.sair(), 'padrao', { 'aria-label': 'Sair do sistema' })
    ]);
    this.raiz.replaceChildren(layout.elemento);

    // Depois do login, começa sempre pelo Painel.
    if (window.location.hash !== '#/') window.history.replaceState(null, '', '#/');
    this.roteador = new Roteador(ROTAS, layout.conteudo, (caminho) => layout.marcarAtivo(caminho));
    this.roteador.iniciar();

    void window.api.app.info().then((info) => {
      const versao = info.ok ? `Versão ${info.dados.versao}` : '';
      layout.atualizarRodape(this.modoSimulado ? `${versao} · modo simulado` : versao);
    });
  }

  private async sair(): Promise<void> {
    const resposta = await window.api.auth.logout().catch(() => null);
    if (!resposta?.ok) {
      Toast.erro(resposta?.erro.mensagem ?? 'Não foi possível sair. Tente de novo.');
      return;
    }
    // Fecha modais e avisos que tenham ficado abertos da sessão anterior.
    document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
    this.mostrarLogin('Você saiu do sistema.');
  }
}
