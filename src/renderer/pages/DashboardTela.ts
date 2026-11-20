import type { DashboardResumoDTO, ProximaDevolucaoDTO } from '@shared/dto/dashboard.dto';
import { cabecalhoTela } from '../components/CabecalhoTela';
import { cartaoNumero } from '../components/CartaoNumero';
import { Consulta } from '../components/Consulta';
import { estadoVazio } from '../components/Estados';
import { Tabela } from '../components/Tabela';
import { botao, el } from '../nucleo/dom';
import type { Tela } from '../nucleo/Tela';
import { formatarData, formatarMoeda, pluralizar } from '../util/formatadores';

/**
 * Painel inicial: números do dia (canal dashboard:resumo) e a lista das
 * próximas devoluções. Cada cartão leva à tela correspondente já filtrada.
 */
export class DashboardTela implements Tela {
  readonly titulo = 'Painel';
  private consulta: Consulta<DashboardResumoDTO> | null = null;

  private readonly tabela = new Tabela<ProximaDevolucaoDTO & { id: number }>({
    legenda: 'Próximas devoluções',
    colunas: [
      { titulo: 'Reserva', valor: (d) => `#${d.reservaId}`, semQuebra: true },
      { titulo: 'Cliente', valor: (d) => d.cliente },
      { titulo: 'Devolução prevista', valor: (d) => formatarData(d.dataPrevista), semQuebra: true },
      {
        titulo: 'Situação',
        valor: (d) =>
          d.diasAtraso > 0
            ? el('span', {
                classe: 'etiqueta etiqueta--erro',
                texto: `Atrasada há ${pluralizar(d.diasAtraso, 'dia', 'dias')}`
              })
            : el('span', { classe: 'etiqueta etiqueta--sucesso', texto: 'No prazo' })
      }
    ]
  });

  montar(alvo: HTMLElement): void {
    const area = el('div');
    alvo.append(
      cabecalhoTela(this.titulo, [botao('Atualizar', () => void this.consulta?.carregar())]),
      area,
      el('p', { classe: 'rodape-tela' }, [
        el('a', { texto: 'Ver status do sistema e do banco', atributos: { href: '#/sistema' } })
      ])
    );

    this.consulta = new Consulta(area, {
      buscar: () => window.api.dashboard.resumo(),
      textoCarregando: 'Carregando o painel...',
      renderizar: (resumo) => this.desenhar(resumo)
    });
    void this.consulta.carregar();
  }

  private desenhar(r: DashboardResumoDTO): Node {
    const cartoes = el('section', { classe: 'cartoes', atributos: { 'aria-label': 'Resumo' } }, [
      cartaoNumero({
        titulo: 'Reservas ativas',
        valor: r.reservasAtivas,
        link: '/devolucoes?aba=ativas'
      }),
      cartaoNumero({
        titulo: 'Devoluções atrasadas',
        valor: r.reservasAtrasadas,
        link: '/devolucoes?aba=atrasadas',
        alerta: r.reservasAtrasadas > 0
      }),
      cartaoNumero({
        titulo: 'Em manutenção',
        valor: r.equipamentosEmManutencao,
        detalhe: 'equipamento(s)',
        link: '/manutencoes'
      }),
      cartaoNumero({
        titulo: 'Multas em aberto',
        valor: formatarMoeda(r.valorMultasEmAberto),
        detalhe: pluralizar(r.multasEmAberto, 'multa', 'multas'),
        link: '/pagamentos'
      }),
      cartaoNumero({
        titulo: 'Faturamento do mês',
        valor: formatarMoeda(r.faturamentoDoMes),
        link: '/pagamentos'
      })
    ]);

    const lista =
      r.proximasDevolucoes.length === 0
        ? estadoVazio('Nenhuma reserva ativa no momento.')
        : this.tabela.renderizar(r.proximasDevolucoes.map((d) => ({ ...d, id: d.reservaId })));

    return el('div', {}, [
      cartoes,
      el('section', { atributos: { 'aria-labelledby': 'titulo-proximas' } }, [
        el('h2', { texto: 'Próximas devoluções', atributos: { id: 'titulo-proximas' } }),
        lista
      ])
    ]);
  }
}
