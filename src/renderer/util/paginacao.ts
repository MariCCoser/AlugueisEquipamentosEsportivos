import type { Paginado } from '@shared/dto/resposta';

export interface InfoPagina {
  totalPaginas: number;
  /** Posição (1, 2, 3...) do primeiro item mostrado; 0 quando não há itens. */
  primeiro: number;
  /** Posição do último item mostrado. */
  ultimo: number;
  temAnterior: boolean;
  temProxima: boolean;
}

/**
 * Contas da barra de paginação a partir da resposta `Paginado` do Main.
 * Ex.: página 2 de 20 por página, total 45 → "Mostrando 21–40 de 45", página 2 de 3.
 * Sem DOM, para poder ser testada no Vitest.
 */
export function infoPagina({ total, pagina, porPagina, itens }: Paginado<unknown>): InfoPagina {
  const totalPaginas = Math.max(1, Math.ceil(total / Math.max(1, porPagina)));
  const primeiro = itens.length === 0 ? 0 : (pagina - 1) * porPagina + 1;
  return {
    totalPaginas,
    primeiro,
    ultimo: itens.length === 0 ? 0 : primeiro + itens.length - 1,
    temAnterior: pagina > 1,
    temProxima: pagina < totalPaginas
  };
}
