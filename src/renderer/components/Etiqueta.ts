import { el } from '../nucleo/dom';

export type TomEtiqueta = 'sucesso' | 'info' | 'alerta' | 'erro';

/** Etiqueta colorida de status. Sempre tem texto: a cor sozinha não informa (acessibilidade). */
export function etiqueta(texto: string, tom: TomEtiqueta): HTMLElement {
  return el('span', { classe: `etiqueta etiqueta--${tom}`, texto });
}
