import type { ClienteDTO } from '@shared/dto/cliente.dto';
import type { EquipamentoDTO } from '@shared/dto/equipamento.dto';
import type { ReservaDTO } from '@shared/dto/reserva.dto';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { aplicarErros, CampoAreaTexto, CampoSelect, CampoTexto } from '../../components/Campos';
import { carregando, estadoErro, estadoVazio } from '../../components/Estados';
import { passos } from '../../components/Passos';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { navegar } from '../../nucleo/Roteador';
import type { Tela } from '../../nucleo/Tela';
import { diariasDoPeriodo, hojeISO, somarDias } from '../../util/datas';
import { lerDinheiro } from '../../util/dinheiro';
import { formatarData, formatarMoeda, pluralizar } from '../../util/formatadores';
import { ClienteFormulario } from '../clientes/ClienteFormulario';
import { cartaoClima } from './CartaoClima';

const ETAPAS = ['Cliente', 'Período e equipamentos', 'Revisão', 'Pronto'] as const;
const ESPERA_BUSCA_MS = 300;

/**
 * Assistente de nova reserva em 4 passos:
 *   1. escolher o cliente (ou cadastrar na hora);
 *   2. datas + equipamentos livres no período (equipamentos:listarDisponiveis);
 *   3. revisão com valor estimado, caução e o cartão de previsão do tempo;
 *   4. reserva criada (PENDENTE), com atalho para confirmar a retirada.
 * O valor final é sempre calculado pelo Main: a tela não manda preço nenhum.
 */
export class NovaReservaTela implements Tela {
  readonly titulo = 'Nova reserva';
  private etapa = 0;
  private cliente: ClienteDTO | null = null;
  private retirada = hojeISO();
  private devolucao = somarDias(hojeISO(), 1);
  private categoriaId: number | undefined;
  private disponiveis: EquipamentoDTO[] = [];
  private readonly escolhidos = new Map<number, EquipamentoDTO>();
  private caucao = '0';
  private observacoes = '';
  private criada: ReservaDTO | null = null;
  private temporizador: number | undefined;
  /** Garante que só a última busca de equipamentos seja desenhada. */
  private buscaEquipamentos = 0;

  private readonly corpo = el('div', { classe: 'assistente__corpo' });
  private readonly indicador = el('div');

  montar(alvo: HTMLElement): void {
    alvo.append(cabecalhoTela(this.titulo), this.indicador, this.corpo);
    this.desenhar(false);
  }

  desmontar(): void {
    window.clearTimeout(this.temporizador);
  }

  // ---------- navegação entre passos ----------

  private irPara(etapa: number): void {
    this.etapa = etapa;
    this.desenhar(true);
  }

  private desenhar(focar: boolean): void {
    this.indicador.replaceChildren(passos(ETAPAS, this.etapa));
    const titulo = el('h2', {
      classe: 'assistente__titulo',
      texto: `Passo ${this.etapa + 1} de ${ETAPAS.length}: ${ETAPAS[this.etapa]}`,
      atributos: { tabindex: -1 }
    });
    const conteudo = [
      () => this.passoCliente(),
      () => this.passoEquipamentos(),
      () => this.passoRevisao(),
      () => this.passoPronto()
    ][this.etapa]!();
    this.corpo.replaceChildren(titulo, conteudo);
    // Leitores de tela anunciam o novo passo; quem usa teclado continua do topo.
    if (focar) titulo.focus();
  }

  private rodape(voltar: boolean, continuar: HTMLButtonElement): HTMLElement {
    return el('div', { classe: 'assistente__rodape' }, [
      voltar ? botao('‹ Voltar', () => this.irPara(this.etapa - 1)) : el('span'),
      continuar
    ]);
  }

  // ---------- passo 1: cliente ----------

  private passoCliente(): HTMLElement {
    const busca = new CampoTexto({
      nome: 'busca',
      rotulo: 'Buscar cliente por nome ou CPF',
      maximo: 120
    });
    busca.elemento.classList.add('campo--busca');
    busca.controle.setAttribute('type', 'search');
    const lista = el('div');
    const escolhido = el('p', {
      classe: 'assistente__escolhido',
      atributos: { 'aria-live': 'polite' }
    });

    const continuar = botao('Continuar ›', () => this.irPara(1), 'primario');
    const atualizarEscolha = (): void => {
      continuar.disabled = !this.cliente;
      escolhido.textContent = this.cliente
        ? `Cliente escolhido: ${this.cliente.nome} (${this.cliente.cidade}/${this.cliente.uf})`
        : 'Nenhum cliente escolhido ainda.';
    };

    const carregar = async (texto: string): Promise<void> => {
      lista.replaceChildren(carregando('Buscando clientes...'));
      const resposta = await window.api.clientes.listar({
        busca: texto || undefined,
        porPagina: 8
      });
      if (!resposta.ok) {
        lista.replaceChildren(estadoErro(resposta.erro.mensagem, () => void carregar(texto)));
        return;
      }
      if (resposta.dados.itens.length === 0) {
        lista.replaceChildren(estadoVazio(`Nenhum cliente encontrado para "${texto}".`));
        return;
      }
      lista.replaceChildren(
        el(
          'ul',
          { classe: 'lista-escolha', atributos: { 'aria-label': 'Clientes encontrados' } },
          resposta.dados.itens.map((c) =>
            el('li', {}, [
              el(
                'button',
                {
                  classe: 'lista-escolha__opcao',
                  atributos: { type: 'button', 'aria-pressed': String(this.cliente?.id === c.id) },
                  aoClicar: (evento) => {
                    this.cliente = c;
                    lista
                      .querySelectorAll('[aria-pressed]')
                      .forEach((b) => b.setAttribute('aria-pressed', 'false'));
                    (evento.currentTarget as HTMLElement).setAttribute('aria-pressed', 'true');
                    atualizarEscolha();
                  }
                },
                [
                  el('strong', { texto: c.nome }),
                  el('span', {
                    classe: 'tabela__detalhe',
                    texto: `CPF ${c.cpfMascarado} · ${c.cidade}/${c.uf}`
                  })
                ]
              )
            ])
          )
        )
      );
    };

    busca.controle.addEventListener('input', () => {
      window.clearTimeout(this.temporizador);
      this.temporizador = window.setTimeout(
        () => void carregar(busca.valor.trim()),
        ESPERA_BUSCA_MS
      );
    });
    void carregar('');
    atualizarEscolha();

    const novoCliente = botao('Cadastrar novo cliente', () =>
      new ClienteFormulario(null, (cliente) => {
        this.cliente = cliente;
        this.irPara(1);
      }).abrir()
    );

    return el('div', {}, [
      el('div', { classe: 'filtros' }, [busca.elemento, novoCliente]),
      lista,
      escolhido,
      this.rodape(false, continuar)
    ]);
  }

  // ---------- passo 2: período e equipamentos ----------

  private passoEquipamentos(): HTMLElement {
    const retirada = new CampoTexto({
      nome: 'dataRetirada',
      rotulo: 'Retirada',
      tipo: 'date',
      valor: this.retirada,
      obrigatorio: true
    });
    retirada.controle.min = hojeISO();
    const devolucao = new CampoTexto({
      nome: 'dataDevolucaoPrevista',
      rotulo: 'Devolução prevista',
      tipo: 'date',
      valor: this.devolucao,
      obrigatorio: true
    });
    devolucao.controle.min = this.retirada;
    const categoria = new CampoSelect({
      nome: 'categoriaId',
      rotulo: 'Categoria',
      opcoes: [],
      opcaoVazia: 'Todas',
      aoMudar: (valor) => {
        this.categoriaId = valor ? Number(valor) : undefined;
        void this.carregarDisponiveis(lista, resumo);
      }
    });
    void window.api.categorias.listar().then((r) => {
      if (!r.ok) return;
      categoria.definirOpcoes(
        r.dados.map((c) => ({ valor: String(c.id), rotulo: c.nome })),
        'Todas'
      );
      categoria.valor = this.categoriaId ? String(this.categoriaId) : '';
    });

    const lista = el('div');
    const resumo = el('p', {
      classe: 'assistente__escolhido',
      atributos: { 'aria-live': 'polite' }
    });

    const aoMudarData = (): void => {
      const erros: Record<string, string> = {};
      if (!retirada.valor) erros['dataRetirada'] = 'Informe a data de retirada.';
      else if (retirada.valor < hojeISO())
        erros['dataRetirada'] = 'A retirada não pode ser no passado.';
      if (!devolucao.valor) erros['dataDevolucaoPrevista'] = 'Informe a data de devolução.';
      else if (retirada.valor && devolucao.valor < retirada.valor) {
        erros['dataDevolucaoPrevista'] = 'A devolução não pode ser antes da retirada.';
      }
      if (aplicarErros([retirada, devolucao], erros)) {
        lista.replaceChildren();
        return;
      }
      this.retirada = retirada.valor;
      this.devolucao = devolucao.valor;
      devolucao.controle.min = this.retirada;
      void this.carregarDisponiveis(lista, resumo);
    };
    retirada.controle.addEventListener('change', aoMudarData);
    devolucao.controle.addEventListener('change', aoMudarData);

    void this.carregarDisponiveis(lista, resumo);

    const continuar = botao(
      'Continuar ›',
      () => {
        if (this.escolhidos.size === 0) {
          Toast.erro('Escolha pelo menos um equipamento.');
          return;
        }
        this.irPara(2);
      },
      'primario'
    );

    return el('div', {}, [
      el('p', { classe: 'texto-suave', texto: `Cliente: ${this.cliente?.nome ?? '—'}` }),
      el('div', { classe: 'filtros' }, [retirada.elemento, devolucao.elemento, categoria.elemento]),
      lista,
      resumo,
      this.rodape(true, continuar)
    ]);
  }

  /**
   * Busca o que está livre no período. Itens escolhidos que deixaram de estar livres
   * (a pessoa mudou as datas) saem da seleção, com aviso.
   */
  private async carregarDisponiveis(lista: HTMLElement, resumo: HTMLElement): Promise<void> {
    const numero = ++this.buscaEquipamentos;
    lista.replaceChildren(carregando('Procurando equipamentos livres no período...'));
    const resposta = await window.api.equipamentos.listarDisponiveis({
      dataRetirada: this.retirada,
      dataDevolucaoPrevista: this.devolucao,
      categoriaId: this.categoriaId
    });
    if (numero !== this.buscaEquipamentos) return;
    if (!resposta.ok) {
      lista.replaceChildren(
        estadoErro(resposta.erro.mensagem, () => void this.carregarDisponiveis(lista, resumo))
      );
      return;
    }
    this.disponiveis = resposta.dados;

    // Só dá para saber se um escolhido saiu quando a lista não está filtrada por categoria.
    if (!this.categoriaId) {
      const livres = new Set(resposta.dados.map((e) => e.id));
      const removidos = [...this.escolhidos.values()].filter((e) => !livres.has(e.id));
      for (const e of removidos) this.escolhidos.delete(e.id);
      if (removidos.length > 0) {
        Toast.erro(
          `Não está livre nessas datas e saiu da reserva: ${removidos.map((e) => e.nome).join(', ')}.`
        );
      }
    }

    if (resposta.dados.length === 0) {
      lista.replaceChildren(estadoVazio('Nenhum equipamento livre nesse período.'));
    } else {
      lista.replaceChildren(this.listaEquipamentos(resumo));
    }
    this.atualizarResumo(resumo);
  }

  private listaEquipamentos(resumo: HTMLElement): HTMLElement {
    return el('fieldset', { classe: 'grupo-campos' }, [
      el('legend', { texto: 'Equipamentos livres no período' }),
      el(
        'ul',
        { classe: 'lista-escolha lista-escolha--grade' },
        this.disponiveis.map((e) => {
          const id = novoId('equip');
          const caixa = el('input', { atributos: { type: 'checkbox', id } });
          caixa.checked = this.escolhidos.has(e.id);
          caixa.addEventListener('change', () => {
            if (caixa.checked) this.escolhidos.set(e.id, e);
            else this.escolhidos.delete(e.id);
            this.atualizarResumo(resumo);
          });
          return el('li', {}, [
            el('label', { classe: 'lista-escolha__opcao', atributos: { for: id } }, [
              caixa,
              el('span', {}, [
                el('strong', { texto: e.nome }),
                el('span', {
                  classe: 'tabela__detalhe',
                  texto: `${e.categoriaNome} · ${formatarMoeda(e.valorDiaria ?? 0)}/dia`
                }),
                e.sensivelClima
                  ? el('span', { classe: 'etiqueta etiqueta--info', texto: 'Sensível ao clima' })
                  : null
              ])
            ])
          ]);
        })
      )
    ]);
  }

  private totalEstimado(): number {
    const diarias = diariasDoPeriodo(this.retirada, this.devolucao);
    const soma = [...this.escolhidos.values()].reduce((t, e) => t + (e.valorDiaria ?? 0), 0);
    return Math.round(soma * diarias * 100) / 100;
  }

  private atualizarResumo(resumo: HTMLElement): void {
    const qtd = this.escolhidos.size;
    resumo.textContent =
      qtd === 0
        ? 'Nenhum equipamento escolhido.'
        : `${pluralizar(qtd, 'equipamento escolhido', 'equipamentos escolhidos')} · ` +
          `${pluralizar(diariasDoPeriodo(this.retirada, this.devolucao), 'diária', 'diárias')} · ` +
          `estimativa ${formatarMoeda(this.totalEstimado())}`;
  }

  // ---------- passo 3: revisão ----------

  private passoRevisao(): HTMLElement {
    const cliente = this.cliente!;
    const diarias = diariasDoPeriodo(this.retirada, this.devolucao);
    const itens = [...this.escolhidos.values()];

    const caucao = new CampoTexto({
      nome: 'valorCaucao',
      rotulo: 'Caução (R$)',
      tipo: 'number',
      valor: this.caucao,
      ajuda: 'Valor deixado como garantia e devolvido no fim. Use 0 para sem caução.'
    });
    caucao.controle.min = '0';
    caucao.controle.step = '0.01';
    caucao.elemento.classList.add('campo--curto');
    const observacoes = new CampoAreaTexto({
      nome: 'observacoes',
      rotulo: 'Observações (opcional)',
      valor: this.observacoes,
      maximo: 500
    });

    const tabela = el('div', { classe: 'tabela-rolagem' }, [
      el('table', { classe: 'tabela' }, [
        el('caption', { classe: 'sr-only', texto: 'Itens da reserva' }),
        el('thead', {}, [
          el('tr', {}, [
            el('th', { texto: 'Equipamento', atributos: { scope: 'col' } }),
            el('th', { classe: 'numero', texto: 'Diária', atributos: { scope: 'col' } }),
            el('th', { classe: 'numero', texto: 'Diárias', atributos: { scope: 'col' } }),
            el('th', { classe: 'numero', texto: 'Subtotal', atributos: { scope: 'col' } })
          ])
        ]),
        el(
          'tbody',
          {},
          itens.map((e) =>
            el('tr', {}, [
              el('td', { texto: e.nome }),
              el('td', { classe: 'numero', texto: formatarMoeda(e.valorDiaria ?? 0) }),
              el('td', { classe: 'numero', texto: String(diarias) }),
              el('td', {
                classe: 'numero',
                texto: formatarMoeda(Math.round((e.valorDiaria ?? 0) * diarias * 100) / 100)
              })
            ])
          )
        ),
        el('tfoot', {}, [
          el('tr', {}, [
            el('th', { texto: 'Total estimado', atributos: { scope: 'row', colspan: 3 } }),
            el('td', { classe: 'numero', texto: formatarMoeda(this.totalEstimado()) })
          ])
        ])
      ])
    ]);

    const sensiveis = itens.filter((e) => e.sensivelClima);
    const clima =
      sensiveis.length > 0
        ? cartaoClima({
            cidade: cliente.cidade,
            uf: cliente.uf,
            data: this.retirada,
            equipamentoIds: itens.map((e) => e.id)
          })
        : null;

    const confirmar = botao(
      'Confirmar reserva',
      () => void this.criar(confirmar, caucao, observacoes),
      'primario'
    );

    return el('div', {}, [
      el('dl', { classe: 'dados cartao' }, [
        el('dt', { texto: 'Cliente' }),
        el('dd', { texto: `${cliente.nome} (${cliente.cidade}/${cliente.uf})` }),
        el('dt', { texto: 'Período' }),
        el('dd', {
          texto: `${formatarData(this.retirada)} a ${formatarData(this.devolucao)} (${pluralizar(diarias, 'diária', 'diárias')})`
        })
      ]),
      tabela,
      el('p', {
        classe: 'texto-suave',
        texto: 'O valor final é calculado pelo sistema com a diária cadastrada de cada equipamento.'
      }),
      clima,
      caucao.elemento,
      observacoes.elemento,
      this.rodape(true, confirmar)
    ]);
  }

  private async criar(
    botaoConfirmar: HTMLButtonElement,
    caucao: CampoTexto,
    observacoes: CampoAreaTexto
  ): Promise<void> {
    this.caucao = caucao.valor;
    this.observacoes = observacoes.valor;
    // Texto inválido num <input type="number"> chega como '' (badInput): não vira "sem caução".
    const lido = caucao.controle.validity.badInput
      ? { erro: 'Valor inválido: use só números, ex.: 50,00.' }
      : lerDinheiro(caucao.valor, { permitirZero: true });
    caucao.definirErro(lido.erro);
    if (lido.erro !== undefined) {
      caucao.focar();
      return;
    }
    const valorCaucao = lido.valor;

    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = 'Criando reserva...';
    const resposta = await window.api.reservas
      .criar({
        clienteId: this.cliente!.id,
        dataRetirada: this.retirada,
        dataDevolucaoPrevista: this.devolucao,
        itens: [...this.escolhidos.keys()].map((equipamentoId) => ({ equipamentoId })),
        valorCaucao,
        observacoes: observacoes.valor.trim() || undefined
      })
      .catch(() => null);
    botaoConfirmar.disabled = false;
    botaoConfirmar.textContent = 'Confirmar reserva';

    if (!resposta) {
      Toast.erro('Não foi possível se comunicar com o sistema.');
    } else if (!resposta.ok) {
      // Ex.: alguém reservou o mesmo equipamento enquanto a pessoa preenchia.
      Toast.erro(resposta.erro.mensagem);
    } else {
      this.criada = resposta.dados;
      this.irPara(3);
    }
  }

  // ---------- passo 4: pronto ----------

  private passoPronto(): HTMLElement {
    const r = this.criada!;
    const retirar = botao(
      'Confirmar retirada agora',
      async () => {
        retirar.disabled = true;
        const resposta = await window.api.reservas.confirmarRetirada({ id: r.id });
        if (resposta.ok) {
          Toast.sucesso(`Retirada da reserva #${r.id} confirmada.`);
          navegar('/devolucoes?aba=ativas');
        } else {
          retirar.disabled = false;
          Toast.erro(resposta.erro.mensagem);
        }
      },
      'primario'
    );

    return el('div', { classe: 'cartao' }, [
      el('p', {
        classe: 'assistente__sucesso',
        texto: `✓ Reserva #${r.id} criada para ${r.clienteNome}.`,
        atributos: { role: 'status' }
      }),
      el('dl', { classe: 'dados' }, [
        el('dt', { texto: 'Período' }),
        el('dd', {
          texto: `${formatarData(r.dataRetirada)} a ${formatarData(r.dataDevolucaoPrevista)}`
        }),
        el('dt', { texto: 'Itens' }),
        el('dd', { texto: r.itens.map((i) => i.equipamentoNome).join(', ') }),
        el('dt', { texto: 'Valor total' }),
        el('dd', { texto: formatarMoeda(r.valorTotal) }),
        el('dt', { texto: 'Caução' }),
        el('dd', { texto: r.valorCaucao > 0 ? formatarMoeda(r.valorCaucao) : 'Sem caução' }),
        el('dt', { texto: 'Situação' }),
        el('dd', { texto: 'Aguardando retirada' })
      ]),
      el('div', { classe: 'assistente__rodape' }, [
        botao('Fazer outra reserva', () => this.recomecar()),
        el('div', { classe: 'cabecalho-tela__acoes' }, [
          botao('Ver reservas aguardando retirada', () => navegar('/devolucoes?aba=pendentes')),
          retirar
        ])
      ])
    ]);
  }

  private recomecar(): void {
    this.cliente = null;
    this.escolhidos.clear();
    this.caucao = '0';
    this.observacoes = '';
    this.criada = null;
    this.retirada = hojeISO();
    this.devolucao = somarDias(this.retirada, 1);
    this.irPara(0);
  }
}
