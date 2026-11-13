import type { Database } from '../database/Database';
import { criarRepositorios, type Repositorios } from '../repositories';

/**
 * Acesso aos repositórios em dois modos:
 * - `repos`: leituras e gravações simples, cada uma por conta própria;
 * - `transacao(fn)`: tudo dentro de `fn` usa a MESMA conexão; se qualquer passo
 *   lançar erro, nada é gravado (ROLLBACK). Ex.: criar a reserva e os itens dela.
 *
 * Os services dependem desta interface (e não do Database), então nos testes
 * dá para usar uma versão em memória.
 */
export interface AcessoDados {
  readonly repos: Repositorios;
  transacao<T>(fn: (repos: Repositorios) => Promise<T>): Promise<T>;
}

/** Implementação real: repositórios em cima do pool do MySQL. */
export class UnidadeDeTrabalho implements AcessoDados {
  readonly repos: Repositorios;

  constructor(private readonly db: Database) {
    this.repos = criarRepositorios(db);
  }

  transacao<T>(fn: (repos: Repositorios) => Promise<T>): Promise<T> {
    return this.db.transacao((tx) => fn(criarRepositorios(tx)));
  }
}
