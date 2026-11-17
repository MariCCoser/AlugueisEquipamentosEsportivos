import type { HistoricoClienteDTO } from '@shared/dto/cliente.dto';
import type { MultaDTO } from '@shared/dto/multa.dto';
import type { PagamentoDTO } from '@shared/dto/pagamento.dto';
import type { ReservaResumoDTO } from '@shared/dto/reserva.dto';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { cartaoNumero } from '../../components/CartaoNumero';
import { Consulta } from '../../components/Consulta';
import { estadoErro, estadoVazio } from '../../components/Estados';
import { etiqueta } from '../../components/Etiqueta';
import { Tabela } from '../../components/Tabela';
import { botao, el, type Filho } from '../../nucleo/dom';
import { navegar } from '../../nucleo/Roteador';
import type { Tela } from '../../nucleo/Tela';
import {
  formatarCep,
  formatarData,
  formatarMoeda,
  formatarTelefone,
  pluralizar
} from '../../util/formatadores';
import {
  ROTULOS_FORMA_PAGAMENTO,
  ROTULOS_STATUS_RESERVA,
  ROTULOS_TIPO_PAGAMENTO,
  TOM_STATUS_RESERVA
} from '../../util/rotulos';
import { ClienteFormulario } from './ClienteFormulario';

const colunasReserva = [
  { titulo: 'Reserva', valor: (r: ReservaResumoDTO) => `#${r.id}`, semQuebra: true },
  {
    titulo: 'Período',
    valor: (r: ReservaResumoDTO) =>
      `${formatarData(r.dataRetirada)} a ${formatarData(r.dataDevolucaoPrevista)}`,
    semQuebra: true
  },
  {
    titulo: 'Itens',
    valor: (r: ReservaResumoDTO) => pluralizar(r.qtdItens, 'item', 'itens'),
    numerica: true
  },
  {
    titulo: 'Status',
    valor: (r: ReservaResumoDTO) =>
      etiqueta(ROTULOS_STATUS_RESERVA[r.status], TOM_STATUS_RESERVA[r.status])
  },
  {
    titulo: 'Total',
    valor: (r: ReservaResumoDTO) => formatarMoeda(r.valorTotal),
    numerica: true,
    semQuebra: true
  },
  {
    titulo: 'Pago',
    valor: (r: ReservaResumoDTO) => formatarMoeda(r.totalPago),
    numerica: true,
    semQuebra: true
  }
];

/**
 * Detalhes de um cliente (#/clientes/7): dados de contato, números do relacionamento
 * com a loja e as listas de reservas, pagamentos e multas em aberto
 * (canal clientes:historico, uma ida ao Main).
 */
export class ClienteHistoricoTela implements Tela {
  readonly titulo = 'Histórico do cliente';
  private consulta: Consulta<HistoricoClienteDTO> | null = null;

  private readonly ativas = new Tabela<ReservaResumoDTO>({
    legenda: 'Reservas ativas',
    colunas: colunasReserva
  });
  private readonly anteriores = new Tabela<ReservaResumoDTO>({
    legenda: 'Reservas anteriores',
    colunas: colunasReserva
  });
  private readonly pagamentos = new Tabela<PagamentoDTO>({
    legenda: 'Pagamentos',
    colunas: [
      { titulo: 'Data', valor: (p) => formatarData(p.data), semQuebra: true },
      { titulo: 'Reserva', valor: (p) => `#${p.reservaId}`, semQuebra: true },
      { titulo: 'Tipo', valor: (p) => ROTULOS_TIPO_PAGAMENTO[p.tipo] },
      { titulo: 'Forma', valor: (p) => ROTULOS_FORMA_PAGAMENTO[p.forma] },
      { titulo: 'Valor', valor: (p) => formatarMoeda(p.valor), numerica: true, semQuebra: true }
    ]
  });
  private readonly multas = new Tabela<MultaDTO>({
    legenda: 'Multas em aberto',
    colunas: [
      { titulo: 'Reserva', valor: (m) => `#${m.reservaId}`, semQuebra: true },
      {
        titulo: 'Atraso',
        valor: (m) => pluralizar(m.diasAtraso, 'dia', 'dias'),
        numerica: true
      },
      { titulo: 'Valor', valor: (m) => formatarMoeda(m.valor), numerica: true, semQuebra: true },
      {
        titulo: 'Já pago',
        valor: (m) => formatarMoeda(m.valorPago),
        numerica: true,
        semQuebra: true
      },
      {
        titulo: 'Falta pagar',
        valor: (m) => formatarMoeda(Math.max(m.valor - m.valorPago, 0)),
        numerica: true,
        semQuebra: true
      }
    ]
  });

  /** `null` quando o endereço não traz um número (ex.: #/clientes/abc). */
  private readonly id: number | null;

  constructor(parametroId: string | undefined) {
    const id = Number(parametroId);
    this.id = Number.isInteger(id) && id > 0 ? id : null;
  }

  montar(alvo: HTMLElement): void {
    const voltar = botao('‹ Voltar para clientes', () => navegar('/clientes'));
    const area = el('div');
    alvo.append(cabecalhoTela(this.titulo, [voltar]), area);

    const id = this.id;
    if (id === null) {
      area.append(estadoErro('Endereço inválido: cliente não informado.'));
      return;
    }

    this.consulta = new Consulta(area, {
      buscar: () => window.api.clientes.historico({ id }),
      textoCarregando: 'Carregando o histórico...',
      renderizar: (historico) => this.desenhar(historico)
    });
    void this.consulta.carregar();
  }

  private desenhar(h: HistoricoClienteDTO): Node {
    const c = h.cliente;
    const endereco = [
      `${c.rua}, ${c.numero}${c.complemento ? ` – ${c.complemento}` : ''}`,
      `${c.bairro} – ${c.cidade}/${c.uf}`,
      `CEP ${formatarCep(c.cep)}`
    ];

    const dados = el(
      'section',
      { classe: 'cartao', atributos: { 'aria-labelledby': 'titulo-dados' } },
      [
        el('div', { classe: 'cartao__topo' }, [
          el('h2', { texto: c.nome, atributos: { id: 'titulo-dados' } }),
          botao('Editar dados', () =>
            new ClienteFormulario(c, () => void this.consulta?.carregar()).abrir()
          )
        ]),
        el('dl', { classe: 'dados' }, [
          ...ClienteHistoricoTela.dado('CPF', c.cpfMascarado),
          ...ClienteHistoricoTela.dado('Telefone', formatarTelefone(c.telefone)),
          ...ClienteHistoricoTela.dado('E-mail', c.email ?? '—'),
          ...ClienteHistoricoTela.dado(
            'Endereço',
            el(
              'span',
              {},
              endereco.flatMap((linha, i) => (i ? [el('br'), linha] : [linha]))
            )
          ),
          ...ClienteHistoricoTela.dado('Cliente desde', formatarData(c.createdAt))
        ])
      ]
    );

    const numeros = el('section', { classe: 'cartoes', atributos: { 'aria-label': 'Resumo' } }, [
      cartaoNumero({ titulo: 'Reservas ativas', valor: h.reservasAtivas.length }),
      cartaoNumero({ titulo: 'Reservas anteriores', valor: h.reservasAnteriores.length }),
      cartaoNumero({
        titulo: 'Total pago',
        valor: formatarMoeda(h.pagamentos.reduce((soma, p) => soma + p.valor, 0))
      }),
      cartaoNumero({
        titulo: 'Multas pendentes',
        valor: formatarMoeda(h.totalPendente),
        detalhe: pluralizar(h.multasEmAberto.length, 'multa', 'multas'),
        alerta: h.totalPendente > 0
      })
    ]);

    return el('div', {}, [
      dados,
      numeros,
      this.secao('Multas em aberto', h.multasEmAberto, this.multas, 'Nenhuma multa em aberto.'),
      this.secao('Reservas ativas', h.reservasAtivas, this.ativas, 'Nenhuma reserva ativa.'),
      this.secao(
        'Reservas anteriores',
        h.reservasAnteriores,
        this.anteriores,
        'Nenhuma reserva anterior.'
      ),
      this.secao('Pagamentos', h.pagamentos, this.pagamentos, 'Nenhum pagamento registrado.')
    ]);
  }

  private static dado(rotulo: string, valor: Filho): HTMLElement[] {
    return [el('dt', { texto: rotulo }), el('dd', {}, [valor])];
  }

  private secao<T extends { id: number }>(
    titulo: string,
    itens: T[],
    tabela: Tabela<T>,
    textoVazio: string
  ): HTMLElement {
    return el('section', { classe: 'secao' }, [
      el('h2', { texto: `${titulo} (${itens.length})` }),
      itens.length === 0 ? estadoVazio(textoVazio) : tabela.renderizar(itens)
    ]);
  }
}
