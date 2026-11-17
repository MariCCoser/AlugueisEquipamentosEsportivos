import { el } from '../nucleo/dom';

type TipoToast = 'sucesso' | 'erro';

/**
 * Avisos rápidos no canto da tela ("Categoria salva.", "Erro ao salvar.").
 * Ficam em regiões aria-live, então leitores de tela anunciam a mensagem.
 * Erros ficam mais tempo na tela e são anunciados com prioridade.
 */
export class Toast {
  private static instancia: Toast | null = null;

  private readonly regiaoEducada: HTMLElement;
  private readonly regiaoUrgente: HTMLElement;

  private constructor() {
    this.regiaoEducada = el('div', { classe: 'toasts', atributos: { 'aria-live': 'polite' } });
    this.regiaoUrgente = el('div', { classe: 'toasts', atributos: { 'aria-live': 'assertive' } });
    document.body.append(this.regiaoEducada, this.regiaoUrgente);
  }

  /** Um único container de toasts para a aplicação inteira. */
  static obter(): Toast {
    Toast.instancia ??= new Toast();
    return Toast.instancia;
  }

  static sucesso(mensagem: string): void {
    Toast.obter().mostrar('sucesso', mensagem, 4000);
  }

  static erro(mensagem: string): void {
    Toast.obter().mostrar('erro', mensagem, 7000);
  }

  private mostrar(tipo: TipoToast, mensagem: string, duracaoMs: number): void {
    const regiao = tipo === 'erro' ? this.regiaoUrgente : this.regiaoEducada;
    const prefixo = tipo === 'erro' ? '✖ ' : '✔ ';

    const aviso = el('div', { classe: `toast toast--${tipo}` }, [
      el('p', { texto: prefixo + mensagem }),
      el('button', {
        classe: 'toast__fechar',
        texto: '×',
        atributos: { type: 'button', 'aria-label': 'Fechar aviso' },
        aoClicar: () => remover()
      })
    ]);

    const temporizador = window.setTimeout(() => remover(), duracaoMs);
    const remover = (): void => {
      window.clearTimeout(temporizador);
      aviso.remove();
    };

    regiao.append(aviso);
  }
}
