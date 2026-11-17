import { el, type Filho } from '../nucleo/dom';

/** Título da tela (h1) com botões de ação à direita, ex.: "Novo fornecedor". */
export function cabecalhoTela(titulo: string, acoes: Filho[] = []): HTMLElement {
  return el('header', { classe: 'cabecalho-tela' }, [
    el('h1', { texto: titulo }),
    acoes.length > 0 ? el('div', { classe: 'cabecalho-tela__acoes' }, acoes) : null
  ]);
}
