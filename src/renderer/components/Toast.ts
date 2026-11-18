import { el } from '../nucleo/dom';

type TipoToast = 'sucesso' | 'erro';

/**
 * Avisos rápidos no canto da tela ("Categoria salva.", "Erro ao salvar.").
 * Ficam em regiões aria-live, então leitores de tela anunciam a mensagem.
 * Erros são anunciados com prioridade e ficam na tela até a pessoa fechar (WCAG 2.2.1:
 * ninguém perde um erro por ler devagar). Avisos de sucesso somem sozinhos, mas o tempo
 * para enquanto o mouse ou o foco estiverem sobre eles.
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
    Toast.obter().mostrar('erro', mensagem, null);
  }

  private mostrar(tipo: TipoToast, mensagem: string, duracaoMs: number | null): void {
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

    let temporizador: number | undefined;
    const remover = (): void => {
      window.clearTimeout(temporizador);
      aviso.remove();
    };
    if (duracaoMs !== null) {
      const contar = (): void => {
        temporizador = window.setTimeout(remover, duracaoMs);
      };
      const pausar = (): void => window.clearTimeout(temporizador);
      aviso.addEventListener('mouseenter', pausar);
      aviso.addEventListener('focusin', pausar);
      aviso.addEventListener('mouseleave', contar);
      aviso.addEventListener('focusout', contar);
      contar();
    }

    regiao.append(aviso);
  }
}
