import type { ManutencaoDTO } from '@shared/dto/manutencao.dto';
import { Abas } from '../../components/Abas';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { Consulta } from '../../components/Consulta';
import { etiqueta } from '../../components/Etiqueta';
import { Tabela } from '../../components/Tabela';
import { botao, el } from '../../nucleo/dom';
import type { Tela } from '../../nucleo/Tela';
import { diasEntre, hojeISO } from '../../util/datas';
import { formatarData, formatarMoeda, pluralizar } from '../../util/formatadores';
import { ROTULOS_TIPO_MANUTENCAO } from '../../util/rotulos';
import { abrirEnvioManutencao, abrirRetornoManutencao } from './ManutencaoFormularios';

type Aba = 'abertas' | 'todas';

/**
 * Manutenções (#/manutencoes?aba=todas): o que está no conserto agora (com há quantos
 * dias) e o histórico completo, com custo. Enviar e registrar retorno mudam o status
 * do equipamento sozinhos (EM_MANUTENCAO ↔ DISPONIVEL), pelas regras do Main.
 */
export class ManutencoesTela implements Tela {
  readonly titulo = 'Manutenções';
  private aba: Aba;
  private consulta: Consulta<ManutencaoDTO[]> | null = null;

  constructor(consulta?: URLSearchParams) {
    this.aba = consulta?.get('aba') === 'todas' ? 'todas' : 'abertas';
  }

  montar(alvo: HTMLElement): void {
    const abas = new Abas<Aba>(
      [
        { id: 'abertas', rotulo: 'No conserto' },
        { id: 'todas', rotulo: 'Histórico' }
      ],
      this.aba,
      (id) => {
        this.aba = id;
        void this.consulta?.carregar();
      },
      'Manutenções'
    );
    const area = el('div');
    abas.painel.append(area);
    alvo.append(
      cabecalhoTela(this.titulo, [
        botao(
          'Enviar para manutenção',
          () => void abrirEnvioManutencao(() => this.recarregar()),
          'primario'
        )
      ]),
      abas.elemento
    );

    this.consulta = new Consulta(area, {
      buscar: () =>
        this.aba === 'abertas'
          ? window.api.manutencoes.listarAbertas()
          : window.api.manutencoes.listar(),
      estaVazio: (lista) => lista.length === 0,
      textoVazio: () =>
        this.aba === 'abertas'
          ? 'Nenhum equipamento no conserto agora.'
          : 'Nenhuma manutenção registrada.',
      renderizar: (lista) => this.tabela().renderizar(lista)
    });
    void this.consulta.carregar();
  }

  private recarregar(): void {
    void this.consulta?.carregar();
  }

  private tabela(): Tabela<ManutencaoDTO> {
    const abertas = this.aba === 'abertas';
    return new Tabela<ManutencaoDTO>({
      legenda: abertas ? 'Equipamentos no conserto' : 'Histórico de manutenções',
      colunas: [
        {
          titulo: 'Equipamento',
          valor: (m) =>
            el('span', {}, [
              m.equipamentoNome,
              el('span', { classe: 'tabela__detalhe', texto: m.descricao })
            ]),
          ordenar: (a, b) => a.equipamentoNome.localeCompare(b.equipamentoNome)
        },
        { titulo: 'Oficina', valor: (m) => m.fornecedorNome },
        { titulo: 'Tipo', valor: (m) => ROTULOS_TIPO_MANUTENCAO[m.tipo] },
        {
          titulo: 'Envio',
          valor: (m) => formatarData(m.dataEnvio),
          semQuebra: true,
          ordenar: (a, b) => a.dataEnvio.localeCompare(b.dataEnvio)
        },
        abertas
          ? {
              titulo: 'No conserto há',
              valor: (m) => {
                const dias = Math.max(diasEntre(m.dataEnvio, hojeISO()), 0);
                if (dias === 0) return etiqueta('Enviado hoje', 'info');
                return etiqueta(pluralizar(dias, 'dia', 'dias'), dias > 14 ? 'alerta' : 'info');
              }
            }
          : {
              titulo: 'Retorno',
              valor: (m) =>
                m.dataRetorno ? formatarData(m.dataRetorno) : etiqueta('No conserto', 'alerta'),
              semQuebra: true
            },
        // O custo só existe depois do retorno: na aba "No conserto" a coluna nem aparece.
        ...(abertas
          ? []
          : [
              {
                titulo: 'Custo',
                valor: (m: ManutencaoDTO) => (m.custo !== undefined ? formatarMoeda(m.custo) : '—'),
                numerica: true,
                semQuebra: true
              }
            ])
      ],
      acoes: (m) =>
        m.dataRetorno
          ? []
          : [
              botao(
                'Registrar retorno',
                () => abrirRetornoManutencao(m, () => this.recarregar()),
                'primario',
                {
                  'aria-label': `Registrar o retorno de ${m.equipamentoNome}`
                }
              )
            ]
    });
  }
}
