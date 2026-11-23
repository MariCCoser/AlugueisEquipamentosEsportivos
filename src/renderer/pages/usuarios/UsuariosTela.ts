import type { UsuarioSessaoDTO } from '@shared/dto/auth.dto';
import type { FiltroUsuarioDTO, UsuarioDTO } from '@shared/dto/usuario.dto';
import type { Perfil } from '@shared/models/enums';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { CampoSelect, CampoTexto } from '../../components/Campos';
import { confirmar } from '../../components/ConfirmDialog';
import { Consulta } from '../../components/Consulta';
import { carregando, estadoErro } from '../../components/Estados';
import { etiqueta } from '../../components/Etiqueta';
import { Tabela } from '../../components/Tabela';
import { Toast } from '../../components/Toast';
import { botao, el } from '../../nucleo/dom';
import type { Tela } from '../../nucleo/Tela';
import { formatarData } from '../../util/formatadores';
import { ROTULOS_PERFIL, opcoesDe } from '../../util/rotulos';
import { UsuarioFormulario } from './UsuarioFormulario';

const ESPERA_BUSCA_MS = 300;

/**
 * Usuários do sistema (só ADMIN). A tela confere o perfil de quem está logado antes
 * de mostrar qualquer coisa, mas quem garante a regra é o Main: os canais usuarios:*
 * respondem "sem permissão" para FUNCIONARIO mesmo que alguém chegue aqui pelo endereço.
 * Usuário não é excluído quando já registrou reservas: o normal é desativá-lo.
 */
export class UsuariosTela implements Tela {
  readonly titulo = 'Usuários';
  private filtro: FiltroUsuarioDTO = { ativo: true };
  private consulta: Consulta<UsuarioDTO[]> | null = null;
  private temporizador: number | undefined;
  private logado: UsuarioSessaoDTO | null = null;

  private readonly tabela = new Tabela<UsuarioDTO>({
    legenda: 'Usuários do sistema',
    colunas: [
      {
        titulo: 'Nome',
        valor: (u) =>
          el('span', {}, [
            u.nome,
            u.id === this.logado?.id
              ? el('span', { classe: 'tabela__detalhe', texto: '(você)' })
              : null
          ]),
        ordenar: (a, b) => a.nome.localeCompare(b.nome)
      },
      { titulo: 'E-mail', valor: (u) => u.email },
      {
        titulo: 'Perfil',
        valor: (u) => etiqueta(ROTULOS_PERFIL[u.perfil], u.perfil === 'ADMIN' ? 'info' : 'sucesso')
      },
      {
        titulo: 'Situação',
        valor: (u) => (u.ativo ? etiqueta('Ativo', 'sucesso') : etiqueta('Inativo', 'erro'))
      },
      {
        titulo: 'Último acesso',
        valor: (u) => (u.ultimoLogin ? formatarData(u.ultimoLogin) : 'Nunca entrou'),
        semQuebra: true
      }
    ],
    acoes: (u) => this.acoes(u)
  });

  montar(alvo: HTMLElement): void {
    const area = el('div');
    alvo.append(cabecalhoTela(this.titulo), area);
    area.append(carregando('Conferindo permissões...'));
    void this.conferirPermissao(alvo, area);
  }

  desmontar(): void {
    window.clearTimeout(this.temporizador);
  }

  /** Só mostra a tela para ADMIN; os outros veem o motivo e nenhum dado. */
  private async conferirPermissao(alvo: HTMLElement, area: HTMLElement): Promise<void> {
    const sessao = await window.api.auth.sessaoAtual().catch(() => null);
    if (!sessao?.ok) {
      area.replaceChildren(
        estadoErro(sessao?.erro.mensagem ?? 'Não foi possível conferir quem está logado.')
      );
      return;
    }
    if (sessao.dados?.perfil !== 'ADMIN') {
      area.replaceChildren(
        el('div', { classe: 'estado', atributos: { role: 'alert' } }, [
          el('p', { texto: 'Somente administradores podem gerenciar usuários.' }),
          el('p', { texto: 'Peça a um administrador para criar ou alterar um acesso.' })
        ])
      );
      return;
    }
    this.logado = sessao.dados;
    alvo
      .querySelector('.cabecalho-tela')
      ?.append(
        el('div', { classe: 'cabecalho-tela__acoes' }, [
          botao('Novo usuário', () => this.abrirFormulario(null), 'primario')
        ])
      );
    this.montarLista(area);
  }

  private montarLista(area: HTMLElement): void {
    const busca = new CampoTexto({
      nome: 'busca',
      rotulo: 'Buscar por nome ou e-mail',
      maximo: 150
    });
    busca.elemento.classList.add('campo--busca');
    busca.controle.setAttribute('type', 'search');
    busca.controle.addEventListener('input', () => {
      window.clearTimeout(this.temporizador);
      this.temporizador = window.setTimeout(
        () => this.filtrar({ busca: busca.valor.trim() || undefined }),
        ESPERA_BUSCA_MS
      );
    });
    const perfil = new CampoSelect({
      nome: 'perfil',
      rotulo: 'Perfil',
      opcoes: opcoesDe(ROTULOS_PERFIL),
      opcaoVazia: 'Todos',
      aoMudar: (valor) => this.filtrar({ perfil: (valor || undefined) as Perfil | undefined })
    });
    const situacao = new CampoSelect({
      nome: 'ativo',
      rotulo: 'Situação',
      opcoes: [
        { valor: 'sim', rotulo: 'Ativos' },
        { valor: 'nao', rotulo: 'Inativos' }
      ],
      opcaoVazia: 'Todos',
      valor: 'sim',
      aoMudar: (valor) => this.filtrar({ ativo: valor ? valor === 'sim' : undefined })
    });

    const lista = el('div');
    area.replaceChildren(
      el('div', { classe: 'filtros', atributos: { role: 'search' } }, [
        busca.elemento,
        perfil.elemento,
        situacao.elemento
      ]),
      lista
    );

    this.consulta = new Consulta(lista, {
      buscar: () => window.api.usuarios.listar(this.filtro),
      estaVazio: (usuarios) => usuarios.length === 0,
      textoVazio: 'Nenhum usuário encontrado com esses filtros.',
      renderizar: (usuarios) => this.tabela.renderizar(usuarios)
    });
    void this.consulta.carregar();
  }

  private filtrar(mudanca: Partial<FiltroUsuarioDTO>): void {
    this.filtro = { ...this.filtro, ...mudanca };
    void this.consulta?.carregar();
  }

  /** Ninguém desativa nem exclui a si mesmo (evita ficar sem nenhum administrador). */
  private acoes(u: UsuarioDTO): HTMLElement[] {
    const editar = botao('Editar', () => this.abrirFormulario(u), 'padrao', {
      'aria-label': `Editar ${u.nome}`
    });
    if (u.id === this.logado?.id) return [editar];
    return [
      editar,
      u.ativo
        ? botao('Desativar', () => void this.alterarAtivo(u, false), 'padrao', {
            'aria-label': `Desativar o acesso de ${u.nome}`
          })
        : botao('Reativar', () => void this.alterarAtivo(u, true), 'padrao', {
            'aria-label': `Reativar o acesso de ${u.nome}`
          }),
      botao('Excluir', () => void this.excluir(u), 'perigo', {
        'aria-label': `Excluir ${u.nome}`
      })
    ];
  }

  private abrirFormulario(usuario: UsuarioDTO | null): void {
    new UsuarioFormulario(
      usuario,
      this.logado?.id ?? null,
      () => void this.consulta?.carregar()
    ).abrir();
  }

  private async alterarAtivo(u: UsuarioDTO, ativo: boolean): Promise<void> {
    if (!ativo) {
      const confirmado = await confirmar({
        titulo: 'Desativar usuário',
        mensagem: `${u.nome} não vai mais conseguir entrar no sistema até ser reativado(a). Continuar?`,
        textoConfirmar: 'Desativar'
      });
      if (!confirmado) return;
    }
    const resposta = await window.api.usuarios.atualizar({ id: u.id, ativo });
    if (resposta.ok) {
      Toast.sucesso(ativo ? `Acesso de ${u.nome} reativado.` : `Acesso de ${u.nome} desativado.`);
      void this.consulta?.carregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }

  private async excluir(u: UsuarioDTO): Promise<void> {
    const confirmado = await confirmar({
      titulo: 'Excluir usuário',
      mensagem: `Excluir o usuário "${u.nome}"? Se ele já registrou reservas, prefira desativar.`
    });
    if (!confirmado) return;

    const resposta = await window.api.usuarios.excluir({ id: u.id });
    if (resposta.ok) {
      Toast.sucesso(`Usuário "${u.nome}" excluído.`);
      void this.consulta?.carregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }
}
