import type { EquipamentoDTO, FiltroEquipamentoDTO } from '@shared/dto/equipamento.dto';
import type { Paginado } from '@shared/dto/resposta';
import {
  MODALIDADES,
  STATUS_EQUIPAMENTO,
  type Modalidade,
  type StatusEquipamento
} from '@shared/models/enums';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { CampoSelect, CampoTexto } from '../../components/Campos';
import { confirmar } from '../../components/ConfirmDialog';
import { Consulta } from '../../components/Consulta';
import { etiqueta } from '../../components/Etiqueta';
import { paginacao } from '../../components/Paginacao';
import { Tabela } from '../../components/Tabela';
import { Toast } from '../../components/Toast';
import { botao, el } from '../../nucleo/dom';
import type { Tela } from '../../nucleo/Tela';
import { formatarMoeda } from '../../util/formatadores';
import {
  ROTULOS_ESTADO_CONSERVACAO,
  ROTULOS_MODALIDADE,
  ROTULOS_STATUS_EQUIPAMENTO,
  TOM_STATUS_EQUIPAMENTO,
  opcoesDe
} from '../../util/rotulos';
import { EquipamentoFormulario } from './EquipamentoFormulario';

const ESPERA_BUSCA_MS = 300;

/** Lê um valor do endereço só se ele estiver na lista permitida (ex.: ?status=EM_MANUTENCAO). */
function lerDaLista<T extends string>(valor: string | null, lista: readonly T[]): T | undefined {
  return lista.find((item) => item === valor);
}

/**
 * Inventário: lista paginada pelo Main com filtros por nome, categoria, status e modalidade.
 * Os filtros podem vir no endereço: #/equipamentos?status=EM_MANUTENCAO&modalidade=LOCACAO
 */
export class EquipamentosTela implements Tela {
  readonly titulo = 'Inventário';
  private filtro: FiltroEquipamentoDTO;
  private consulta: Consulta<Paginado<EquipamentoDTO>> | null = null;
  private temporizador: number | undefined;
  /** Área da lista; recebe o foco ao trocar de página (o botão clicado some). */
  private readonly area = el('div', { atributos: { tabindex: -1 } });

  private readonly tabela = new Tabela<EquipamentoDTO>({
    legenda: 'Equipamentos do inventário',
    colunas: [
      {
        titulo: 'Nome',
        valor: (e) =>
          el('span', {}, [
            e.nome,
            e.descricao ? el('span', { classe: 'tabela__detalhe', texto: e.descricao }) : null
          ]),
        ordenar: (a, b) => a.nome.localeCompare(b.nome)
      },
      {
        titulo: 'Categoria',
        valor: (e) => e.categoriaNome,
        ordenar: (a, b) => a.categoriaNome.localeCompare(b.categoriaNome)
      },
      { titulo: 'Modalidade', valor: (e) => ROTULOS_MODALIDADE[e.modalidade] },
      { titulo: 'Conservação', valor: (e) => ROTULOS_ESTADO_CONSERVACAO[e.estadoConservacao] },
      {
        titulo: 'Status',
        valor: (e) =>
          etiqueta(ROTULOS_STATUS_EQUIPAMENTO[e.status], TOM_STATUS_EQUIPAMENTO[e.status]),
        semQuebra: true
      },
      {
        titulo: 'Preço',
        valor: (e) => EquipamentosTela.preco(e),
        numerica: true,
        semQuebra: true,
        ordenar: (a, b) =>
          (a.valorDiaria ?? a.precoVenda ?? 0) - (b.valorDiaria ?? b.precoVenda ?? 0)
      }
    ],
    acoes: (e) => [
      botao('Editar', () => this.abrirFormulario(e), 'padrao', {
        'aria-label': `Editar ${e.nome}`
      }),
      this.botaoStatus(e),
      botao('Excluir', () => void this.excluir(e), 'perigo', {
        'aria-label': `Excluir ${e.nome}`
      })
    ]
  });

  constructor(consulta?: URLSearchParams) {
    this.filtro = {
      pagina: 1,
      status: lerDaLista(consulta?.get('status') ?? null, STATUS_EQUIPAMENTO),
      modalidade: lerDaLista(consulta?.get('modalidade') ?? null, MODALIDADES)
    };
  }

  private static preco(e: EquipamentoDTO): string {
    if (e.modalidade === 'LOCACAO' && e.valorDiaria !== undefined) {
      return `${formatarMoeda(e.valorDiaria)}/dia`;
    }
    return e.precoVenda !== undefined ? formatarMoeda(e.precoVenda) : '—';
  }

  montar(alvo: HTMLElement): void {
    const busca = new CampoTexto({ nome: 'busca', rotulo: 'Buscar por nome', maximo: 120 });
    busca.elemento.classList.add('campo--busca');
    busca.controle.setAttribute('type', 'search');
    busca.controle.addEventListener('input', () => {
      window.clearTimeout(this.temporizador);
      this.temporizador = window.setTimeout(
        () => this.filtrar({ busca: busca.valor.trim() || undefined }),
        ESPERA_BUSCA_MS
      );
    });

    const categoria = new CampoSelect({
      nome: 'categoriaId',
      rotulo: 'Categoria',
      opcoes: [],
      opcaoVazia: 'Todas',
      aoMudar: (valor) => this.filtrar({ categoriaId: valor ? Number(valor) : undefined })
    });
    const status = new CampoSelect({
      nome: 'status',
      rotulo: 'Status',
      opcoes: opcoesDe(ROTULOS_STATUS_EQUIPAMENTO),
      opcaoVazia: 'Todos',
      valor: this.filtro.status ?? '',
      aoMudar: (valor) => this.filtrar({ status: (valor || undefined) as StatusEquipamento })
    });
    const modalidade = new CampoSelect({
      nome: 'modalidade',
      rotulo: 'Modalidade',
      opcoes: opcoesDe(ROTULOS_MODALIDADE),
      opcaoVazia: 'Todas',
      valor: this.filtro.modalidade ?? '',
      aoMudar: (valor) => this.filtrar({ modalidade: (valor || undefined) as Modalidade })
    });

    // As categorias do filtro chegam depois; a lista já pode ir aparecendo.
    void window.api.categorias.listar().then((resposta) => {
      if (resposta.ok) {
        categoria.definirOpcoes(
          resposta.dados.map((c) => ({ valor: String(c.id), rotulo: c.nome })),
          'Todas'
        );
      }
    });

    const area = this.area;
    alvo.append(
      cabecalhoTela(this.titulo, [
        botao('Novo equipamento', () => this.abrirFormulario(null), 'primario')
      ]),
      el('div', { classe: 'filtros', atributos: { role: 'search' } }, [
        busca.elemento,
        categoria.elemento,
        status.elemento,
        modalidade.elemento
      ]),
      area
    );

    this.consulta = new Consulta(area, {
      buscar: () => window.api.equipamentos.listar(this.filtro),
      estaVazio: (pagina) => pagina.total === 0,
      textoVazio: () =>
        this.temFiltro()
          ? 'Nenhum equipamento encontrado com esses filtros.'
          : 'Nenhum equipamento cadastrado.',
      acaoVazio: () =>
        this.temFiltro()
          ? undefined
          : botao('Cadastrar equipamento', () => this.abrirFormulario(null), 'primario'),
      renderizar: (pagina) =>
        el('div', {}, [
          this.tabela.renderizar(pagina.itens),
          paginacao(pagina, (numero) => this.irParaPagina(numero), ['equipamento', 'equipamentos'])
        ])
    });
    void this.consulta.carregar();
  }

  desmontar(): void {
    window.clearTimeout(this.temporizador);
  }

  private temFiltro(): boolean {
    const { busca, categoriaId, status, modalidade } = this.filtro;
    return Boolean(busca || categoriaId || status || modalidade);
  }

  /** Mudou um filtro: volta para a primeira página. */
  private filtrar(mudanca: Partial<FiltroEquipamentoDTO>): void {
    this.filtro = { ...this.filtro, ...mudanca, pagina: 1 };
    void this.consulta?.carregar();
  }

  private irParaPagina(pagina: number): void {
    this.filtro = { ...this.filtro, pagina };
    this.area.focus();
    void this.consulta?.carregar();
  }

  private recarregar(): void {
    void this.consulta?.carregar();
  }

  private abrirFormulario(equipamento: EquipamentoDTO | null): void {
    void EquipamentoFormulario.abrir(equipamento, () => this.recarregar());
  }

  /**
   * Só DISPONÍVEL ↔ INDISPONÍVEL muda à mão. Reservado e Em manutenção mudam sozinhos
   * (devolução / retorno da manutenção), então o botão nem aparece nesses casos.
   */
  private botaoStatus(e: EquipamentoDTO): HTMLElement | null {
    if (e.status === 'DISPONIVEL') {
      return botao('Desativar', () => void this.alterarStatus(e, 'INDISPONIVEL'), 'padrao', {
        'aria-label': `Marcar ${e.nome} como indisponível`
      });
    }
    if (e.status === 'INDISPONIVEL') {
      return botao('Reativar', () => void this.alterarStatus(e, 'DISPONIVEL'), 'padrao', {
        'aria-label': `Marcar ${e.nome} como disponível`
      });
    }
    return null;
  }

  private async alterarStatus(
    e: EquipamentoDTO,
    status: 'DISPONIVEL' | 'INDISPONIVEL'
  ): Promise<void> {
    if (status === 'INDISPONIVEL') {
      const confirmado = await confirmar({
        titulo: 'Desativar equipamento',
        mensagem: `"${e.nome}" deixa de aparecer para novas reservas até ser reativado. Continuar?`,
        textoConfirmar: 'Desativar'
      });
      if (!confirmado) return;
    }
    const resposta = await window.api.equipamentos.alterarStatus({ id: e.id, status });
    if (resposta.ok) {
      Toast.sucesso(
        status === 'DISPONIVEL' ? `"${e.nome}" está disponível.` : `"${e.nome}" foi desativado.`
      );
      this.recarregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }

  /** Item com reservas ou manutenções no histórico não pode ser apagado; o Main explica. */
  private async excluir(e: EquipamentoDTO): Promise<void> {
    const confirmado = await confirmar({
      titulo: 'Excluir equipamento',
      mensagem: `Excluir "${e.nome}"? Essa ação não pode ser desfeita.`
    });
    if (!confirmado) return;

    const resposta = await window.api.equipamentos.excluir({ id: e.id });
    if (resposta.ok) {
      Toast.sucesso(`"${e.nome}" excluído.`);
      this.recarregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }
}
