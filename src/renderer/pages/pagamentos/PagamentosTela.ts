import type { MultaDTO } from '@shared/dto/multa.dto';
import type { FiltroPagamentoDTO, PagamentoDTO } from '@shared/dto/pagamento.dto';
import type { FormaPagamento, TipoPagamento } from '@shared/models/enums';
import { Abas } from '../../components/Abas';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { CampoSelect, CampoTexto } from '../../components/Campos';
import { Consulta } from '../../components/Consulta';
import { Modal } from '../../components/Modal';
import { Tabela } from '../../components/Tabela';
import { Toast } from '../../components/Toast';
import { botao, el } from '../../nucleo/dom';
import type { Tela } from '../../nucleo/Tela';
import { formatarData, formatarMoeda, pluralizar } from '../../util/formatadores';
import { ROTULOS_FORMA_PAGAMENTO, ROTULOS_TIPO_PAGAMENTO, opcoesDe } from '../../util/rotulos';
import { PagamentoFormulario } from './PagamentoFormulario';

type Aba = 'pagamentos' | 'multas';

/**
 * Financeiro (#/pagamentos?aba=multas):
 * - Pagamentos: lançamentos com filtro por tipo e período, e o total do que está na lista;
 * - Multas em aberto: quitar (multas:quitar) ou avisar o cliente (API de notificações).
 */
export class PagamentosTela implements Tela {
  readonly titulo = 'Pagamentos';
  private aba: Aba;
  private filtro: FiltroPagamentoDTO = {};
  private consultaPagamentos: Consulta<PagamentoDTO[]> | null = null;
  private consultaMultas: Consulta<MultaDTO[]> | null = null;

  private readonly pagamentos = new Tabela<PagamentoDTO>({
    legenda: 'Pagamentos registrados',
    colunas: [
      {
        titulo: 'Data',
        valor: (p) => formatarData(p.data),
        semQuebra: true,
        ordenar: (a, b) => a.data.localeCompare(b.data)
      },
      { titulo: 'Reserva', valor: (p) => `#${p.reservaId}`, semQuebra: true },
      { titulo: 'Tipo', valor: (p) => ROTULOS_TIPO_PAGAMENTO[p.tipo] },
      { titulo: 'Forma', valor: (p) => ROTULOS_FORMA_PAGAMENTO[p.forma] },
      {
        titulo: 'Valor',
        valor: (p) => formatarMoeda(p.valor),
        numerica: true,
        semQuebra: true,
        ordenar: (a, b) => a.valor - b.valor
      }
    ]
  });

  private readonly multas = new Tabela<MultaDTO>({
    legenda: 'Multas em aberto',
    colunas: [
      { titulo: 'Reserva', valor: (m) => `#${m.reservaId}`, semQuebra: true },
      {
        titulo: 'Cliente',
        valor: (m) => m.clienteNome,
        ordenar: (a, b) => a.clienteNome.localeCompare(b.clienteNome)
      },
      { titulo: 'Atraso', valor: (m) => pluralizar(m.diasAtraso, 'dia', 'dias'), numerica: true },
      { titulo: 'Multa', valor: (m) => formatarMoeda(m.valor), numerica: true, semQuebra: true },
      {
        titulo: 'Falta pagar',
        valor: (m) => formatarMoeda(PagamentosTela.falta(m)),
        numerica: true,
        semQuebra: true,
        ordenar: (a, b) => PagamentosTela.falta(a) - PagamentosTela.falta(b)
      }
    ],
    acoes: (m) => [
      botao('Quitar', () => this.quitar(m), 'primario', {
        'aria-label': `Quitar a multa da reserva #${m.reservaId} de ${m.clienteNome}`
      }),
      botao('Avisar cliente', () => void PagamentosTela.avisar(m), 'padrao', {
        'aria-label': `Enviar aviso da multa para ${m.clienteNome}`
      })
    ]
  });

  constructor(consulta?: URLSearchParams) {
    this.aba = consulta?.get('aba') === 'multas' ? 'multas' : 'pagamentos';
  }

  private static falta(m: MultaDTO): number {
    return Math.max(Math.round((m.valor - m.valorPago) * 100) / 100, 0);
  }

  montar(alvo: HTMLElement): void {
    const areaPagamentos = this.montarPagamentos();
    const areaMultas = el('div');
    const abas = new Abas<Aba>(
      [
        { id: 'pagamentos', rotulo: 'Pagamentos' },
        { id: 'multas', rotulo: 'Multas em aberto' }
      ],
      this.aba,
      (id) => {
        this.aba = id;
        mostrar();
      },
      'Financeiro'
    );
    abas.painel.append(areaPagamentos, areaMultas);
    const mostrar = (): void => {
      areaPagamentos.hidden = this.aba !== 'pagamentos';
      areaMultas.hidden = this.aba !== 'multas';
      void (this.aba === 'pagamentos' ? this.consultaPagamentos : this.consultaMultas)?.carregar();
    };

    alvo.append(
      cabecalhoTela(this.titulo, [
        botao('Registrar pagamento', () => this.novoPagamento(), 'primario')
      ]),
      abas.elemento
    );

    this.consultaMultas = new Consulta(areaMultas, {
      buscar: () => window.api.multas.listarEmAberto(),
      estaVazio: (lista) => lista.length === 0,
      textoVazio: 'Nenhuma multa em aberto.',
      renderizar: (lista) => this.multas.renderizar(lista)
    });
    mostrar();
  }

  private montarPagamentos(): HTMLElement {
    const tipo = new CampoSelect({
      nome: 'tipo',
      rotulo: 'Tipo',
      opcoes: opcoesDe(ROTULOS_TIPO_PAGAMENTO),
      opcaoVazia: 'Todos',
      aoMudar: (valor) => this.filtrar({ tipo: (valor || undefined) as TipoPagamento | undefined })
    });
    const inicio = new CampoTexto({ nome: 'dataInicio', rotulo: 'De', tipo: 'date' });
    const fim = new CampoTexto({ nome: 'dataFim', rotulo: 'Até', tipo: 'date' });
    inicio.controle.addEventListener('change', () =>
      this.filtrar({ dataInicio: inicio.valor || undefined })
    );
    fim.controle.addEventListener('change', () =>
      this.filtrar({ dataFim: fim.valor || undefined })
    );

    const lista = el('div');
    this.consultaPagamentos = new Consulta(lista, {
      buscar: () => window.api.pagamentos.listar(this.filtro),
      estaVazio: (itens) => itens.length === 0,
      textoVazio: 'Nenhum pagamento encontrado com esses filtros.',
      renderizar: (itens) =>
        el('div', {}, [
          this.pagamentos.renderizar(itens),
          el('p', {
            classe: 'paginacao__resumo total-lista',
            texto: `${pluralizar(itens.length, 'pagamento', 'pagamentos')} · total ${formatarMoeda(
              itens.reduce((soma, p) => soma + p.valor, 0)
            )}`
          })
        ])
    });

    return el('div', {}, [
      el('div', { classe: 'filtros', atributos: { role: 'search' } }, [
        tipo.elemento,
        inicio.elemento,
        fim.elemento
      ]),
      lista
    ]);
  }

  private filtrar(mudanca: Partial<FiltroPagamentoDTO>): void {
    this.filtro = { ...this.filtro, ...mudanca };
    void this.consultaPagamentos?.carregar();
  }

  private novoPagamento(): void {
    new PagamentoFormulario(null, () => void this.consultaPagamentos?.carregar()).abrir();
  }

  /** Escolhe a forma e quita o que falta da multa (o Main registra o pagamento MULTA). */
  private quitar(m: MultaDTO): void {
    const forma = new CampoSelect({
      nome: 'forma',
      rotulo: 'Forma de pagamento',
      opcoes: opcoesDe(ROTULOS_FORMA_PAGAMENTO),
      valor: 'PIX'
    });
    const confirmarBotao = botao(
      `Quitar ${formatarMoeda(PagamentosTela.falta(m))}`,
      async () => {
        confirmarBotao.disabled = true;
        const resposta = await window.api.multas.quitar({
          multaId: m.id,
          forma: forma.valor as FormaPagamento
        });
        confirmarBotao.disabled = false;
        if (resposta.ok) {
          Toast.sucesso(`Multa da reserva #${m.reservaId} quitada.`);
          modal.fechar();
          void this.consultaMultas?.carregar();
        } else {
          Toast.erro(resposta.erro.mensagem);
        }
      },
      'primario'
    );
    const modal: Modal = new Modal({
      titulo: 'Quitar multa',
      conteudo: [
        el('p', {
          texto:
            `${m.clienteNome} · reserva #${m.reservaId} · ${pluralizar(m.diasAtraso, 'dia', 'dias')} de atraso. ` +
            `Multa de ${formatarMoeda(m.valor)}, já pago ${formatarMoeda(m.valorPago)}.`
        }),
        forma.elemento
      ],
      rodape: [botao('Cancelar', () => modal.fechar()), confirmarBotao]
    });
    modal.abrir();
    forma.focar();
  }

  private static async avisar(m: MultaDTO): Promise<void> {
    const resposta = await window.api.notificacoes.enviarAvisoMulta({ multaId: m.id });
    if (!resposta.ok) return Toast.erro(resposta.erro.mensagem);
    const n = resposta.dados;
    Toast.sucesso(
      `Aviso enviado por ${n.canal === 'EMAIL' ? 'e-mail' : 'WhatsApp'} para ${n.destinatario}` +
        `${n.simulada ? ' (envio de teste)' : ''}.`
    );
  }
}
