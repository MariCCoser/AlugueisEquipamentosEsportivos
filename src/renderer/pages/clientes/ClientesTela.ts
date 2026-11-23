import type { ClienteDTO, FiltroClienteDTO } from '@shared/dto/cliente.dto';
import type { Paginado } from '@shared/dto/resposta';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { CampoTexto } from '../../components/Campos';
import { confirmar } from '../../components/ConfirmDialog';
import { Consulta } from '../../components/Consulta';
import { paginacao } from '../../components/Paginacao';
import { Tabela } from '../../components/Tabela';
import { Toast } from '../../components/Toast';
import { botao, el } from '../../nucleo/dom';
import { navegar } from '../../nucleo/Roteador';
import type { Tela } from '../../nucleo/Tela';
import { formatarTelefone } from '../../util/formatadores';
import { ClienteFormulario } from './ClienteFormulario';

const ESPERA_BUSCA_MS = 300;

/**
 * Lista de clientes paginada pelo Main, com busca por nome ou começo do CPF.
 * O CPF aparece mascarado (***.456.789-**), como manda a LGPD; o completo só no formulário.
 */
export class ClientesTela implements Tela {
  readonly titulo = 'Clientes';
  private filtro: FiltroClienteDTO = { pagina: 1 };
  private consulta: Consulta<Paginado<ClienteDTO>> | null = null;
  private temporizador: number | undefined;

  private readonly tabela = new Tabela<ClienteDTO>({
    legenda: 'Clientes cadastrados',
    colunas: [
      {
        titulo: 'Nome',
        valor: (c) =>
          el('a', {
            texto: c.nome,
            atributos: { href: `#/clientes/${c.id}`, title: 'Ver histórico do cliente' }
          }),
        ordenar: (a, b) => a.nome.localeCompare(b.nome)
      },
      { titulo: 'CPF', valor: (c) => c.cpfMascarado, semQuebra: true },
      { titulo: 'Telefone', valor: (c) => formatarTelefone(c.telefone), semQuebra: true },
      { titulo: 'E-mail', valor: (c) => c.email ?? '—' },
      {
        titulo: 'Cidade',
        valor: (c) => `${c.cidade}/${c.uf}`,
        ordenar: (a, b) => a.cidade.localeCompare(b.cidade)
      }
    ],
    acoes: (c) => [
      botao('Histórico', () => navegar(`/clientes/${c.id}`), 'padrao', {
        'aria-label': `Ver o histórico de ${c.nome}`
      }),
      botao('Editar', () => this.abrirFormulario(c), 'padrao', {
        'aria-label': `Editar ${c.nome}`
      }),
      botao('Excluir', () => void this.excluir(c), 'perigo', {
        'aria-label': `Excluir ${c.nome}`
      })
    ]
  });

  montar(alvo: HTMLElement): void {
    const busca = new CampoTexto({
      nome: 'busca',
      rotulo: 'Buscar por nome ou CPF',
      maximo: 120
    });
    busca.elemento.classList.add('campo--busca');
    busca.controle.setAttribute('type', 'search');
    busca.controle.addEventListener('input', () => {
      window.clearTimeout(this.temporizador);
      this.temporizador = window.setTimeout(() => {
        // "529.982" também serve: o Main tira a pontuação e compara com o começo do CPF.
        this.filtro = { pagina: 1, busca: busca.valor.trim() || undefined };
        void this.consulta?.carregar();
      }, ESPERA_BUSCA_MS);
    });

    // tabindex -1: recebe o foco ao trocar de página (o botão clicado some).
    const area = el('div', { atributos: { tabindex: -1 } });
    alvo.append(
      cabecalhoTela(this.titulo, [
        botao('Novo cliente', () => this.abrirFormulario(null), 'primario')
      ]),
      el('div', { classe: 'filtros', atributos: { role: 'search' } }, [busca.elemento]),
      area
    );

    this.consulta = new Consulta(area, {
      buscar: () => window.api.clientes.listar(this.filtro),
      estaVazio: (pagina) => pagina.total === 0,
      textoVazio: () =>
        this.filtro.busca
          ? `Nenhum cliente encontrado para "${this.filtro.busca}".`
          : 'Nenhum cliente cadastrado.',
      acaoVazio: () =>
        this.filtro.busca
          ? undefined
          : botao('Cadastrar cliente', () => this.abrirFormulario(null), 'primario'),
      renderizar: (pagina) =>
        el('div', {}, [
          this.tabela.renderizar(pagina.itens),
          paginacao(
            pagina,
            (numero) => {
              this.filtro = { ...this.filtro, pagina: numero };
              area.focus();
              void this.consulta?.carregar();
            },
            ['cliente', 'clientes']
          )
        ])
    });
    void this.consulta.carregar();
  }

  desmontar(): void {
    window.clearTimeout(this.temporizador);
  }

  private abrirFormulario(cliente: ClienteDTO | null): void {
    new ClienteFormulario(cliente, () => void this.consulta?.carregar()).abrir();
  }

  /** Cliente com reservas no histórico não pode ser apagado; o Main explica quantas. */
  private async excluir(c: ClienteDTO): Promise<void> {
    const confirmado = await confirmar({
      titulo: 'Excluir cliente',
      mensagem: `Excluir o cadastro de "${c.nome}"? Essa ação não pode ser desfeita.`
    });
    if (!confirmado) return;

    const resposta = await window.api.clientes.excluir({ id: c.id });
    if (resposta.ok) {
      Toast.sucesso(`Cliente "${c.nome}" excluído.`);
      void this.consulta?.carregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }
}
