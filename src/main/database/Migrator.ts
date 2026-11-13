import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Connection, RowDataPacket } from 'mysql2/promise';

export type TipoScript = 'migrations' | 'seeds';

/**
 * Executa os arquivos .sql de `migrations/` e `seeds/` em ordem alfabética
 * (por isso o prefixo 001_, 002_...) e registra cada um em `schema_migrations`,
 * para nunca rodar o mesmo arquivo duas vezes.
 *
 * Recebe uma conexão aberta com `multipleStatements: true` (um .sql tem vários comandos).
 * Essa opção é só para scripts do próprio projeto — o pool do app não usa.
 */
export class Migrator {
  constructor(
    private readonly conexao: Connection,
    private readonly pastaBase: string
  ) {}

  static async listarArquivosSql(pasta: string): Promise<string[]> {
    const arquivos = await readdir(pasta);
    return arquivos.filter((nome) => nome.endsWith('.sql')).sort();
  }

  async garantirTabelaControle(): Promise<void> {
    await this.conexao.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome        VARCHAR(200) NOT NULL,
        aplicada_em DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async aplicadas(): Promise<Set<string>> {
    const [linhas] = await this.conexao.query<RowDataPacket[]>(
      'SELECT nome FROM schema_migrations ORDER BY nome'
    );
    return new Set(linhas.map((linha) => String(linha['nome'])));
  }

  /** Executa os scripts ainda não aplicados e devolve os nomes dos que rodaram agora. */
  async executarPendentes(tipo: TipoScript): Promise<string[]> {
    await this.garantirTabelaControle();
    const jaAplicadas = await this.aplicadas();
    const pasta = join(this.pastaBase, tipo);
    const executadas: string[] = [];

    for (const arquivo of await Migrator.listarArquivosSql(pasta)) {
      const nome = `${tipo}/${arquivo}`;
      if (jaAplicadas.has(nome)) continue;

      const sql = await readFile(join(pasta, arquivo), 'utf8');
      if (tipo === 'seeds') {
        await this.executarEmTransacao(nome, sql);
      } else {
        // CREATE/ALTER TABLE fazem commit implícito no MySQL, então não adianta transação aqui
        await this.conexao.query(sql);
        await this.registrar(nome);
      }
      executadas.push(nome);
    }
    return executadas;
  }

  private async executarEmTransacao(nome: string, sql: string): Promise<void> {
    await this.conexao.beginTransaction();
    try {
      await this.conexao.query(sql);
      await this.registrar(nome);
      await this.conexao.commit();
    } catch (erro) {
      await this.conexao.rollback();
      throw erro;
    }
  }

  private async registrar(nome: string): Promise<void> {
    await this.conexao.query('INSERT INTO schema_migrations (nome) VALUES (?)', [nome]);
  }
}
