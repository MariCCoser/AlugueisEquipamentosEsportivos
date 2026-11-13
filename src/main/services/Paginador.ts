import type { Paginado } from '@shared/dto/resposta';
import type { PaginacaoDTO } from '@shared/dto/comum.dto';

/**
 * Paginação em memória, para listas já filtradas (ex.: inventário com vários
 * filtros combinados). Segue os mesmos limites do BaseRepository: página >= 1,
 * de 1 a 100 itens por página, padrão 20.
 */
export class Paginador {
  static readonly POR_PAGINA_PADRAO = 20;
  static readonly POR_PAGINA_MAXIMO = 100;

  static paginar<T>(itens: readonly T[], { pagina, porPagina }: PaginacaoDTO = {}): Paginado<T> {
    const limite = Paginador.limite(porPagina);
    const paginaAtual = Math.max(1, Math.floor(pagina ?? 1) || 1);
    const inicio = (paginaAtual - 1) * limite;
    return {
      itens: itens.slice(inicio, inicio + limite),
      total: itens.length,
      pagina: paginaAtual,
      porPagina: limite
    };
  }

  static limite(porPagina?: number): number {
    const pedido =
      Math.floor(porPagina ?? Paginador.POR_PAGINA_PADRAO) || Paginador.POR_PAGINA_PADRAO;
    return Math.min(Paginador.POR_PAGINA_MAXIMO, Math.max(1, pedido));
  }
}
