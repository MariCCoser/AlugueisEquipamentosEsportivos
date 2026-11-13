import type { Executor, ParametroSql, ResultadoEscrita } from '../../../src/main/database/Database';

export interface Chamada {
  tipo: 'consultar' | 'executar';
  sql: string;
  params: ParametroSql[];
}

/**
 * Executor de mentira para testar repositórios sem MySQL:
 * guarda cada SQL/parâmetros recebidos e devolve as respostas enfileiradas.
 */
export class ExecutorFalso implements Executor {
  readonly chamadas: Chamada[] = [];
  private readonly linhas: unknown[][] = [];
  private readonly escritas: ResultadoEscrita[] = [];

  /** Próximo `consultar` devolve estas linhas (sem nada enfileirado, devolve []). */
  responderConsulta(...linhas: unknown[]): this {
    this.linhas.push(linhas);
    return this;
  }

  /** Próximo `executar` devolve este resultado (padrão: id 1, 1 linha afetada). */
  responderEscrita(resultado: Partial<ResultadoEscrita>): this {
    this.escritas.push({ idInserido: 1, linhasAfetadas: 1, ...resultado });
    return this;
  }

  async consultar<T>(sql: string, params: ParametroSql[] = []): Promise<T[]> {
    this.chamadas.push({ tipo: 'consultar', sql, params });
    return (this.linhas.shift() ?? []) as T[];
  }

  async executar(sql: string, params: ParametroSql[] = []): Promise<ResultadoEscrita> {
    this.chamadas.push({ tipo: 'executar', sql, params });
    return this.escritas.shift() ?? { idInserido: 1, linhasAfetadas: 1 };
  }

  get ultima(): Chamada {
    const chamada = this.chamadas.at(-1);
    if (!chamada) throw new Error('Nenhuma chamada registrada');
    return chamada;
  }
}
