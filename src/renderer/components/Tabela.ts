import { el, type Filho } from '../nucleo/dom';

export interface Coluna<T> {
  titulo: string;
  valor: (item: T) => Filho;
  /** Quando informado, o cabeçalho vira um botão que ordena a tabela. */
  ordenar?: (a: T, b: T) => number;
  /** Alinha à direita (valores, quantidades). */
  numerica?: boolean;
}

export interface OpcoesTabela<T> {
  colunas: Coluna<T>[];
  /** Botões da última coluna (editar, excluir...). */
  acoes?: (item: T) => Filho[];
  /** Título lido por leitores de tela (pode ficar visualmente oculto). */
  legenda?: string;
}

type Direcao = 'ascending' | 'descending';

/**
 * Tabela genérica e tipada: cada tela só diz quais colunas mostrar.
 * Os valores são inseridos como texto, nunca como HTML.
 */
export class Tabela<T extends { id: number }> {
  readonly elemento: HTMLTableElement;
  private itens: T[] = [];
  private ordem: { coluna: number; direcao: Direcao } | null = null;

  constructor(private readonly opcoes: OpcoesTabela<T>) {
    this.elemento = el('table', { classe: 'tabela' });
  }

  renderizar(itens: T[]): HTMLTableElement {
    this.itens = [...itens];
    this.desenhar();
    return this.elemento;
  }

  private desenhar(): void {
    const { colunas, acoes, legenda } = this.opcoes;
    const linhaCabecalho = el('tr', {}, [
      ...colunas.map((coluna, indice) => this.criarCabecalho(coluna, indice)),
      acoes
        ? el('th', { atributos: { scope: 'col' } }, [
            el('span', { classe: 'sr-only', texto: 'Ações' })
          ])
        : null
    ]);

    const corpo = el(
      'tbody',
      {},
      this.itensOrdenados().map((item) =>
        el('tr', {}, [
          ...colunas.map((coluna) =>
            el('td', { classe: coluna.numerica ? 'numero' : undefined }, [coluna.valor(item)])
          ),
          acoes ? el('td', { classe: 'acoes' }, acoes(item)) : null
        ])
      )
    );

    this.elemento.replaceChildren(
      ...(legenda ? [el('caption', { classe: 'sr-only', texto: legenda })] : []),
      el('thead', {}, [linhaCabecalho]),
      corpo
    );
  }

  private criarCabecalho(coluna: Coluna<T>, indice: number): HTMLTableCellElement {
    const ativa = this.ordem?.coluna === indice;
    const th = el('th', {
      classe: coluna.numerica ? 'numero' : undefined,
      atributos: {
        scope: 'col',
        'aria-sort': coluna.ordenar ? (ativa ? this.ordem?.direcao : 'none') : undefined
      }
    });

    if (!coluna.ordenar) {
      th.textContent = coluna.titulo;
      return th;
    }

    th.append(
      el('button', {
        classe: 'tabela__ordenar',
        texto: coluna.titulo,
        atributos: { type: 'button' },
        aoClicar: () => this.alternarOrdem(indice)
      })
    );
    return th;
  }

  private alternarOrdem(indice: number): void {
    const direcao: Direcao =
      this.ordem?.coluna === indice && this.ordem.direcao === 'ascending'
        ? 'descending'
        : 'ascending';
    this.ordem = { coluna: indice, direcao };
    this.desenhar();
    // Mantém o foco no botão clicado depois de redesenhar (navegação por teclado).
    this.elemento.querySelectorAll('thead th')[indice]?.querySelector('button')?.focus();
  }

  private itensOrdenados(): T[] {
    if (!this.ordem) return this.itens;
    const comparar = this.opcoes.colunas[this.ordem.coluna]?.ordenar;
    if (!comparar) return this.itens;
    const sinal = this.ordem.direcao === 'ascending' ? 1 : -1;
    return [...this.itens].sort((a, b) => sinal * comparar(a, b));
  }
}
