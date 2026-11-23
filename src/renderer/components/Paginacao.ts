import type { Paginado } from '@shared/dto/resposta';
import { botao, el } from '../nucleo/dom';
import { pluralizar } from '../util/formatadores';
import { infoPagina } from '../util/paginacao';

/**
 * Barra "Mostrando 21–40 de 45 · Anterior · Página 2 de 3 · Próxima" embaixo das listas
 * paginadas pelo Main (clientes, inventário). Some quando tudo cabe numa página.
 *
 *   paginacao(resposta, (pagina) => { ... }, ['cliente', 'clientes'])
 */
export function paginacao(
  dados: Paginado<unknown>,
  irPara: (pagina: number) => void,
  [singular, plural]: [string, string] = ['registro', 'registros']
): HTMLElement {
  const info = infoPagina(dados);
  const resumo = el('p', {
    classe: 'paginacao__resumo',
    texto:
      info.totalPaginas > 1
        ? `Mostrando ${info.primeiro}–${info.ultimo} de ${pluralizar(dados.total, singular, plural)}`
        : pluralizar(dados.total, singular, plural),
    atributos: { 'aria-live': 'polite' }
  });

  // Uma página só: não há para onde navegar, então não é um <nav> (evita região sem nome).
  if (info.totalPaginas <= 1) return el('div', { classe: 'paginacao' }, [resumo]);

  const anterior = botao('‹ Anterior', () => irPara(dados.pagina - 1), 'padrao', {
    'aria-label': 'Página anterior'
  });
  anterior.disabled = !info.temAnterior;
  const proxima = botao('Próxima ›', () => irPara(dados.pagina + 1), 'padrao', {
    'aria-label': 'Próxima página'
  });
  proxima.disabled = !info.temProxima;

  return el('nav', { classe: 'paginacao', atributos: { 'aria-label': 'Paginação' } }, [
    resumo,
    el('div', { classe: 'paginacao__botoes' }, [
      anterior,
      el('span', { texto: `Página ${dados.pagina} de ${info.totalPaginas}` }),
      proxima
    ])
  ]);
}
