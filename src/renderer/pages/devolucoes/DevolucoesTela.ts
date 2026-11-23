import type { ReservaAtrasadaDTO, ReservaResumoDTO } from '@shared/dto/reserva.dto';
import type { Resposta } from '@shared/dto/resposta';
import { Abas } from '../../components/Abas';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { confirmar } from '../../components/ConfirmDialog';
import { Consulta } from '../../components/Consulta';
import { etiqueta } from '../../components/Etiqueta';
import { Modal } from '../../components/Modal';
import { Tabela, type Coluna } from '../../components/Tabela';
import { Toast } from '../../components/Toast';
import { botao, el } from '../../nucleo/dom';
import { navegar } from '../../nucleo/Roteador';
import type { Tela } from '../../nucleo/Tela';
import { diasEntre, hojeISO } from '../../util/datas';
import { formatarData, formatarMoeda, pluralizar } from '../../util/formatadores';
import { DevolucaoFormulario } from './DevolucaoFormulario';

type Aba = 'pendentes' | 'ativas' | 'atrasadas' | 'devolvidas';
/** As abas usam a mesma linha; só as atrasadas trazem atraso e multa prevista. */
type Linha = ReservaResumoDTO & Partial<Pick<ReservaAtrasadaDTO, 'diasAtraso' | 'multaPrevista'>>;

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'pendentes', rotulo: 'Aguardando retirada' },
  { id: 'ativas', rotulo: 'Com o cliente' },
  { id: 'atrasadas', rotulo: 'Atrasadas' },
  { id: 'devolvidas', rotulo: 'Devolvidas' }
];

const TEXTO_VAZIO: Record<Aba, string> = {
  pendentes: 'Nenhuma reserva aguardando retirada.',
  ativas: 'Nenhum equipamento com clientes agora.',
  atrasadas: 'Nenhuma devolução atrasada.',
  devolvidas: 'Nenhuma reserva devolvida ainda.'
};

/** Quantas devolvidas a aba mostra (as mais recentes). */
const LIMITE_DEVOLVIDAS = 100;

/**
 * Painel de devoluções (#/devolucoes?aba=ativas), com quatro abas:
 * - Aguardando retirada (PENDENTE): confirmar a retirada ou cancelar;
 * - Com o cliente (ATIVA): registrar a devolução ou mandar lembrete;
 * - Atrasadas: dias de atraso, multa se devolver hoje e a rota até o cliente (API 3);
 * - Devolvidas (DEVOLVIDA): quando voltou, se voltou com atraso e se a caução ainda está
 *   guardada (com botão para registrar que ela foi devolvida ao cliente).
 */
export class DevolucoesTela implements Tela {
  readonly titulo = 'Devoluções';
  private aba: Aba;
  private consulta: Consulta<Linha[]> | null = null;

  constructor(consulta?: URLSearchParams) {
    const pedida = consulta?.get('aba');
    this.aba = ABAS.some((a) => a.id === pedida) ? (pedida as Aba) : 'ativas';
  }

  montar(alvo: HTMLElement): void {
    const abas = new Abas<Aba>(
      ABAS,
      this.aba,
      (id) => {
        this.aba = id;
        void this.consulta?.carregar();
      },
      'Situação das reservas'
    );
    const area = el('div');
    abas.painel.append(area);

    alvo.append(
      cabecalhoTela(this.titulo, [
        botao('Nova reserva', () => navegar('/reservas/nova'), 'primario')
      ]),
      abas.elemento
    );

    this.consulta = new Consulta(area, {
      buscar: () => this.buscar(),
      estaVazio: (linhas) => linhas.length === 0,
      textoVazio: () => TEXTO_VAZIO[this.aba],
      renderizar: (linhas) => this.tabela().renderizar(linhas)
    });
    void this.consulta.carregar();
  }

  private async buscar(): Promise<Resposta<Linha[]>> {
    if (this.aba === 'ativas') return window.api.reservas.listarAtivas();
    if (this.aba === 'atrasadas') return window.api.reservas.listarAtrasadas();
    if (this.aba === 'devolvidas') {
      const resposta = await window.api.reservas.listar({
        status: 'DEVOLVIDA',
        porPagina: LIMITE_DEVOLVIDAS
      });
      if (!resposta.ok) return resposta;
      // As devoluções mais recentes primeiro.
      const itens = [...resposta.dados.itens].sort((a, b) =>
        (b.dataDevolucaoReal ?? '').localeCompare(a.dataDevolucaoReal ?? '')
      );
      return { ok: true, dados: itens };
    }
    const resposta = await window.api.reservas.listar({ status: 'PENDENTE', porPagina: 100 });
    return resposta.ok ? { ok: true, dados: resposta.dados.itens } : resposta;
  }

  private recarregar(): void {
    void this.consulta?.carregar();
  }

  // ---------- colunas e ações de cada aba ----------

  private tabela(): Tabela<Linha> {
    const colunas: Coluna<Linha>[] = [
      {
        titulo: 'Reserva',
        valor: (r) => `#${r.id}`,
        semQuebra: true,
        ordenar: (a, b) => a.id - b.id
      },
      {
        titulo: 'Cliente',
        valor: (r) =>
          el('a', { texto: r.clienteNome, atributos: { href: `#/clientes/${r.clienteId}` } }),
        ordenar: (a, b) => a.clienteNome.localeCompare(b.clienteNome)
      },
      {
        titulo: this.aba === 'pendentes' ? 'Retirada' : 'Prevista para',
        valor: (r) =>
          formatarData(this.aba === 'pendentes' ? r.dataRetirada : r.dataDevolucaoPrevista),
        semQuebra: true,
        ordenar: (a, b) => a.dataDevolucaoPrevista.localeCompare(b.dataDevolucaoPrevista)
      },
      { titulo: 'Itens', valor: (r) => pluralizar(r.qtdItens, 'item', 'itens'), numerica: true }
    ];

    if (this.aba === 'ativas') {
      colunas.push({ titulo: 'Situação', valor: (r) => DevolucoesTela.situacao(r) });
    }
    if (this.aba === 'devolvidas') {
      colunas.splice(
        3,
        0,
        {
          titulo: 'Devolvida em',
          valor: (r) => (r.dataDevolucaoReal ? formatarData(r.dataDevolucaoReal) : '—'),
          semQuebra: true,
          ordenar: (a, b) => (a.dataDevolucaoReal ?? '').localeCompare(b.dataDevolucaoReal ?? '')
        },
        { titulo: 'Situação', valor: (r) => DevolucoesTela.situacaoDevolvida(r) }
      );
      colunas.push({ titulo: 'Caução', valor: (r) => DevolucoesTela.caucao(r) });
    }
    if (this.aba === 'atrasadas') {
      colunas.push(
        {
          titulo: 'Atraso',
          valor: (r) => etiqueta(pluralizar(r.diasAtraso ?? 0, 'dia', 'dias'), 'erro'),
          ordenar: (a, b) => (a.diasAtraso ?? 0) - (b.diasAtraso ?? 0)
        },
        {
          titulo: 'Multa até hoje',
          valor: (r) => formatarMoeda(r.multaPrevista ?? 0),
          numerica: true,
          semQuebra: true
        }
      );
    } else {
      colunas.push({
        titulo: 'Total',
        valor: (r) => formatarMoeda(r.valorTotal),
        numerica: true,
        semQuebra: true
      });
    }

    return new Tabela<Linha>({
      legenda: ABAS.find((a) => a.id === this.aba)?.rotulo,
      colunas,
      acoes: (r) => this.acoes(r)
    });
  }

  private static situacao(r: Linha): HTMLElement {
    const dias = diasEntre(hojeISO(), r.dataDevolucaoPrevista);
    if (dias < 0) return etiqueta(`Atrasada ${pluralizar(-dias, 'dia', 'dias')}`, 'erro');
    if (dias === 0) return etiqueta('Vence hoje', 'alerta');
    return etiqueta(`Faltam ${pluralizar(dias, 'dia', 'dias')}`, 'sucesso');
  }

  /** Devolvida no prazo ou com quantos dias de atraso (a multa aparece em Pagamentos). */
  private static situacaoDevolvida(r: Linha): HTMLElement {
    const atraso = r.dataDevolucaoReal
      ? diasEntre(r.dataDevolucaoPrevista, r.dataDevolucaoReal)
      : 0;
    return atraso > 0
      ? etiqueta(`Com ${pluralizar(atraso, 'dia', 'dias')} de atraso`, 'alerta')
      : etiqueta('No prazo', 'sucesso');
  }

  private static caucao(r: Linha): HTMLElement | string {
    if (r.caucaoStatus === 'RETIDA') return etiqueta('Guardada', 'alerta');
    if (r.caucaoStatus === 'DEVOLVIDA') return etiqueta('Devolvida', 'sucesso');
    return '—';
  }

  private acoes(r: Linha): HTMLElement[] {
    const rotulo = `da reserva #${r.id} de ${r.clienteNome}`;
    if (this.aba === 'devolvidas') {
      return r.caucaoStatus === 'RETIDA'
        ? [
            botao('Devolver caução', () => void this.devolverCaucao(r), 'padrao', {
              'aria-label': `Registrar que a caução ${rotulo} foi devolvida`
            })
          ]
        : [];
    }
    if (this.aba === 'pendentes') {
      return [
        botao('Confirmar retirada', () => void this.confirmarRetirada(r), 'primario', {
          'aria-label': `Confirmar a retirada ${rotulo}`
        }),
        botao('Cancelar', () => void this.cancelar(r), 'perigo', {
          'aria-label': `Cancelar a reserva #${r.id} de ${r.clienteNome}`
        })
      ];
    }
    const acoes = [
      botao(
        'Registrar devolução',
        () => void DevolucaoFormulario.abrir(r.id, () => this.recarregar()),
        'primario',
        { 'aria-label': `Registrar a devolução ${rotulo}` }
      ),
      botao('Lembrete', () => void this.lembrete(r), 'padrao', {
        'aria-label': `Enviar lembrete de devolução para ${r.clienteNome}`
      })
    ];
    if (this.aba === 'atrasadas') {
      acoes.push(
        botao('Rota', () => void DevolucoesTela.mostrarRota(r), 'padrao', {
          'aria-label': `Ver a rota até ${r.clienteNome}`
        })
      );
    }
    return acoes;
  }

  /** Registra que a caução que ficou guardada foi devolvida ao cliente. */
  private async devolverCaucao(r: Linha): Promise<void> {
    const confirmado = await confirmar({
      titulo: 'Devolver caução',
      mensagem: `Confirmar que a caução da reserva #${r.id} (${formatarMoeda(r.valorCaucao)}, ou o que sobrou dela) foi devolvida a ${r.clienteNome}?`,
      textoConfirmar: 'Sim, foi devolvida',
      textoCancelar: 'Ainda não',
      perigo: false
    });
    if (!confirmado) return;
    const resposta = await window.api.pagamentos.devolverCaucao({ reservaId: r.id, reter: false });
    if (resposta.ok) {
      Toast.sucesso(`Caução da reserva #${r.id} marcada como devolvida.`);
      this.recarregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }

  private async confirmarRetirada(r: Linha): Promise<void> {
    const resposta = await window.api.reservas.confirmarRetirada({ id: r.id });
    if (resposta.ok) {
      Toast.sucesso(`Retirada da reserva #${r.id} confirmada.`);
      this.recarregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }

  private async cancelar(r: Linha): Promise<void> {
    const confirmado = await confirmar({
      titulo: 'Cancelar reserva',
      mensagem: `Cancelar a reserva #${r.id} de ${r.clienteNome}? Os equipamentos ficam livres de novo.`,
      textoConfirmar: 'Cancelar reserva'
    });
    if (!confirmado) return;
    const resposta = await window.api.reservas.cancelar({ id: r.id });
    if (resposta.ok) {
      Toast.sucesso(`Reserva #${r.id} cancelada.`);
      this.recarregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }

  /** Lembrete por e-mail ou WhatsApp pela nossa API de notificações (API 4). */
  private async lembrete(r: Linha): Promise<void> {
    const resposta = await window.api.notificacoes.enviarLembrete({ reservaId: r.id });
    if (!resposta.ok) return Toast.erro(resposta.erro.mensagem);
    const n = resposta.dados;
    const canal = n.canal === 'EMAIL' ? 'e-mail' : 'WhatsApp';
    Toast.sucesso(
      `Lembrete enviado por ${canal} para ${n.destinatario}${n.simulada ? ' (envio de teste)' : ''}.`
    );
  }

  /** Caminho da loja até o cliente, para buscar o equipamento atrasado (API 3). */
  private static async mostrarRota(r: Linha): Promise<void> {
    const resposta = await window.api.integracoes.calcularRota({ clienteId: r.clienteId });
    if (!resposta.ok) return Toast.erro(resposta.erro.mensagem);
    const rota = resposta.dados;
    const horas = Math.floor(rota.duracaoMinutos / 60);
    const minutos = Math.round(rota.duracaoMinutos % 60);
    const duracao = horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;
    const modal: Modal = new Modal({
      titulo: `Rota até ${r.clienteNome}`,
      conteudo: [
        el('dl', { classe: 'dados' }, [
          el('dt', { texto: 'Destino' }),
          el('dd', { texto: rota.enderecoDestino }),
          el('dt', { texto: 'Distância' }),
          el('dd', {
            texto: `${rota.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
          }),
          el('dt', { texto: 'Tempo de carro' }),
          el('dd', { texto: duracao })
        ])
      ],
      rodape: [
        botao('Fechar', () => modal.fechar()),
        // Links externos abrem no navegador do sistema (setWindowOpenHandler no Main).
        el('a', {
          classe: 'botao botao--primario',
          texto: 'Abrir no mapa ↗',
          atributos: { href: rota.linkMapa, target: '_blank', rel: 'noopener noreferrer' }
        })
      ]
    });
    modal.abrir();
  }
}
