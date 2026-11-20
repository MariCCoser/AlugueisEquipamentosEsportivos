import { el } from '../nucleo/dom';

export interface OpcoesCartaoNumero {
  titulo: string;
  /** Número ou texto já formatado (ex.: 'R$ 45,50'). */
  valor: string | number;
  /** Linha menor embaixo do valor (ex.: '2 multa(s)'). */
  detalhe?: string;
  /** Endereço da tela com mais detalhes (ex.: '/devolucoes?aba=atrasadas'). */
  link?: string;
  /**
   * Destaque só quando há algo errado. Vem sempre acompanhado de texto
   * ("Atenção"), para não depender só da cor (acessibilidade).
   */
  alerta?: boolean;
}

/**
 * Cartão do painel com um número grande. Se tiver `link`, o cartão inteiro é um link
 * (clicável e alcançável por Tab), com um nome acessível completo, ex.:
 * "Devoluções atrasadas: 2. Atenção."
 */
export function cartaoNumero(opcoes: OpcoesCartaoNumero): HTMLElement {
  const { titulo, valor, detalhe, link, alerta } = opcoes;
  const conteudo = [
    el('span', { classe: 'cartao-numero__titulo', texto: titulo }),
    el('span', { classe: 'cartao-numero__valor', texto: String(valor) }),
    detalhe ? el('span', { classe: 'cartao-numero__detalhe', texto: detalhe }) : null,
    alerta ? el('span', { classe: 'etiqueta etiqueta--erro', texto: 'Atenção' }) : null
  ];
  const classe = `cartao-numero${alerta ? ' cartao-numero--alerta' : ''}`;
  const rotulo = [`${titulo}: ${valor}`, detalhe, alerta ? 'Atenção' : undefined]
    .filter(Boolean)
    .join('. ');

  return link
    ? el('a', { classe, atributos: { href: '#' + link, 'aria-label': rotulo } }, conteudo)
    : el('div', { classe, atributos: { role: 'group', 'aria-label': rotulo } }, conteudo);
}
