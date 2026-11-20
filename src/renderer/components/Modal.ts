import { el, novoId, type Filho } from '../nucleo/dom';

export interface OpcoesModal {
  titulo: string;
  conteudo: Filho[];
  rodape?: Filho[];
  /** Chamado sempre que o modal fecha (botão ×, Esc ou `fechar()`). */
  aoFechar?: () => void;
  /** Id do texto que explica o modal (lido junto com o título ao abrir). */
  descritoPor?: string;
}

/**
 * Janela sobreposta baseada no <dialog> nativo do navegador.
 * O `showModal()` já prende o foco dentro do modal e fecha com Esc;
 * ao fechar, devolvemos o foco ao elemento que abriu o modal.
 */
export class Modal {
  private readonly dialogo: HTMLDialogElement;
  private focoAnterior: HTMLElement | null = null;

  constructor(private readonly opcoes: OpcoesModal) {
    const idTitulo = novoId('modal-titulo');

    this.dialogo = el(
      'dialog',
      {
        classe: 'modal',
        atributos: { 'aria-labelledby': idTitulo, 'aria-describedby': opcoes.descritoPor }
      },
      [
        el('header', { classe: 'modal__cabecalho' }, [
          el('h2', { texto: opcoes.titulo, atributos: { id: idTitulo } }),
          el('button', {
            classe: 'modal__fechar',
            texto: '×',
            atributos: { type: 'button', 'aria-label': 'Fechar' },
            aoClicar: () => this.fechar()
          })
        ]),
        el('div', { classe: 'modal__corpo' }, opcoes.conteudo),
        opcoes.rodape ? el('footer', { classe: 'modal__rodape' }, opcoes.rodape) : null
      ]
    );

    // Esc dispara "close"; centralizamos a limpeza aqui.
    this.dialogo.addEventListener('close', () => this.aoFecharDialogo());
  }

  abrir(): void {
    this.focoAnterior =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.append(this.dialogo);
    this.dialogo.showModal();
  }

  fechar(): void {
    if (this.dialogo.open) this.dialogo.close();
  }

  private aoFecharDialogo(): void {
    this.dialogo.remove();
    this.focoAnterior?.focus();
    this.opcoes.aoFechar?.();
  }
}
