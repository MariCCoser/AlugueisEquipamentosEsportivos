import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ConfigBanco } from '../config/Configuracao';

export type ParametroSql = string | number | boolean | Date | null;

export interface ResultadoEscrita {
  idInserido: number;
  linhasAfetadas: number;
}

/**
 * Operações que um repositório precisa. Implementado tanto pelo `Database` (pool)
 * quanto pela conexão de uma transação, então o mesmo repositório funciona nos dois casos.
 *
 * Os valores sempre vão em `params` e entram na SQL pelos `?` — o driver faz o escape.
 * Nunca montar SQL concatenando dados do usuário.
 */
export interface Executor {
  consultar<T>(sql: string, params?: ParametroSql[]): Promise<T[]>;
  executar(sql: string, params?: ParametroSql[]): Promise<ResultadoEscrita>;
}

class ExecutorMysql implements Executor {
  constructor(private readonly alvo: Pool | PoolConnection) {}

  async consultar<T>(sql: string, params: ParametroSql[] = []): Promise<T[]> {
    const [linhas] = await this.alvo.query<RowDataPacket[]>(sql, params);
    return linhas as T[];
  }

  async executar(sql: string, params: ParametroSql[] = []): Promise<ResultadoEscrita> {
    const [resultado] = await this.alvo.query<ResultSetHeader>(sql, params);
    return { idInserido: resultado.insertId, linhasAfetadas: resultado.affectedRows };
  }
}

/** Conexão com o MySQL usando pool. Uma instância só para o app inteiro. */
export class Database implements Executor {
  private readonly pool: Pool;
  private readonly executor: ExecutorMysql;

  constructor(config: ConfigBanco) {
    this.pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      charset: 'utf8mb4',
      // DATE/DATETIME voltam como string 'YYYY-MM-DD' (é o formato que atravessa o IPC)
      dateStrings: true,
      // DECIMAL volta como number em vez de string
      decimalNumbers: true
    });
    this.executor = new ExecutorMysql(this.pool);
  }

  consultar<T>(sql: string, params?: ParametroSql[]): Promise<T[]> {
    return this.executor.consultar<T>(sql, params);
  }

  executar(sql: string, params?: ParametroSql[]): Promise<ResultadoEscrita> {
    return this.executor.executar(sql, params);
  }

  /**
   * Executa `fn` dentro de uma transação: se tudo der certo faz COMMIT,
   * se qualquer erro for lançado faz ROLLBACK e repassa o erro.
   */
  async transacao<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
    const conexao = await this.pool.getConnection();
    try {
      await conexao.beginTransaction();
      const resultado = await fn(new ExecutorMysql(conexao));
      await conexao.commit();
      return resultado;
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  async testarConexao(): Promise<void> {
    await this.consultar('SELECT 1');
  }

  async fechar(): Promise<void> {
    await this.pool.end();
  }
}
