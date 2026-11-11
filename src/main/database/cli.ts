/* eslint-disable no-console -- script de terminal: a saída no console é a interface dele */
import mysql from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
import {
  Configuracao,
  ConfiguracaoError,
  type ConfigAdminBanco,
  type ConfigBanco
} from '../config/Configuracao';
import { Database } from './Database';
import { DiagnosticoBanco } from './DiagnosticoBanco';
import { Migrator, type TipoScript } from './Migrator';

/** Hosts para o usuário do app: 'localhost' (socket) e '127.0.0.1' (TCP). */
const HOSTS_APP = ['localhost', '127.0.0.1'];

/**
 * Comandos de manutenção do banco, rodados pelo terminal (`npm run db:<comando>`).
 * Usa o usuário ADMIN do .env (DB_ADMIN_USER), porque o usuário do app
 * só tem permissão de SELECT/INSERT/UPDATE/DELETE.
 */
class CliBanco {
  constructor(
    private readonly banco: ConfigBanco,
    private readonly admin: ConfigAdminBanco
  ) {}

  async executar(comando: string | undefined, flags: string[]): Promise<void> {
    switch (comando) {
      case 'setup':
        return this.setup();
      case 'migrar':
        return this.rodar('migrations');
      case 'seed':
        return this.rodar('seeds');
      case 'status':
        return this.status();
      case 'resetar':
        return this.resetar(flags.includes('--confirmar'));
      default:
        console.log('Uso: npm run db:<setup|migrar|seed|status|resetar>');
        process.exitCode = 1;
    }
  }

  /** Cria banco + usuário do app + tabelas + dados de exemplo. Pode rodar de novo sem problema. */
  private async setup(): Promise<void> {
    const conexao = await this.conectarAdmin(false);
    try {
      await conexao.query(
        `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(this.banco.database)}
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      console.log(`✔ Banco "${this.banco.database}" pronto`);
      await this.criarUsuarioApp(conexao);
    } finally {
      await conexao.end();
    }
    await this.rodar('migrations');
    await this.rodar('seeds');
    await this.status();
  }

  private async criarUsuarioApp(conexao: Connection): Promise<void> {
    if (this.banco.user === this.admin.user) {
      console.log(`! DB_USER é o mesmo que DB_ADMIN_USER; pulando criação do usuário do app`);
      return;
    }
    for (const host of HOSTS_APP) {
      // CREATE USER não aceita placeholder no nome; mysql.escape faz o escape seguro
      const usuario = `${mysql.escape(this.banco.user)}@${mysql.escape(host)}`;
      await conexao.query(`CREATE USER IF NOT EXISTS ${usuario} IDENTIFIED BY ?`, [
        this.banco.password
      ]);
      // Mantém a senha igual à do .env mesmo se o usuário já existia
      await conexao.query(`ALTER USER ${usuario} IDENTIFIED BY ?`, [this.banco.password]);
      // Privilégio mínimo: o app não pode criar/apagar tabelas
      await conexao.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ${mysql.escapeId(this.banco.database)}.* TO ${usuario}`
      );
    }
    console.log(`✔ Usuário do app "${this.banco.user}" com SELECT/INSERT/UPDATE/DELETE`);
  }

  private async rodar(tipo: TipoScript): Promise<void> {
    const conexao = await this.conectarAdmin(true);
    try {
      const executadas = await new Migrator(conexao, __dirname).executarPendentes(tipo);
      if (executadas.length === 0) {
        console.log(`✔ Nenhum script novo em ${tipo}/`);
      }
      for (const nome of executadas) console.log(`✔ Aplicado ${nome}`);
    } finally {
      await conexao.end();
    }
  }

  /** Conecta com o usuário do APP (o mesmo que o Electron usa) e conta os registros. */
  private async status(): Promise<void> {
    const db = new Database(this.banco);
    try {
      const contagens = await new DiagnosticoBanco(db).contarRegistros();
      console.log(`\nConectado como "${this.banco.user}" em ${this.banco.database}:`);
      console.table(contagens);
    } finally {
      await db.fechar();
    }
  }

  private async resetar(confirmado: boolean): Promise<void> {
    if (!confirmado) {
      console.log(
        `Isso APAGA o banco "${this.banco.database}" inteiro.\n` +
          'Para confirmar: npm run db:resetar -- --confirmar'
      );
      process.exitCode = 1;
      return;
    }
    const conexao = await this.conectarAdmin(false);
    try {
      await conexao.query(`DROP DATABASE IF EXISTS ${mysql.escapeId(this.banco.database)}`);
      console.log(`✔ Banco "${this.banco.database}" apagado`);
    } finally {
      await conexao.end();
    }
    await this.setup();
  }

  private conectarAdmin(comBanco: boolean): Promise<Connection> {
    return mysql.createConnection({
      host: this.banco.host,
      port: this.banco.port,
      user: this.admin.user,
      password: this.admin.password,
      database: comBanco ? this.banco.database : undefined,
      charset: 'utf8mb4',
      multipleStatements: true
    });
  }
}

function mensagemAmigavel(erro: unknown): string {
  if (erro instanceof ConfiguracaoError) return erro.message;
  const codigo = (erro as { code?: string }).code;
  switch (codigo) {
    case 'ECONNREFUSED':
      return 'Não consegui conectar no MySQL. Ele está rodando? (XAMPP: sudo /opt/lampp/lampp startmysql)';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Usuário ou senha recusados pelo MySQL. Confira DB_ADMIN_USER/DB_ADMIN_PASSWORD (ou DB_USER/DB_PASSWORD) no .env.';
    case 'ER_BAD_DB_ERROR':
      return 'O banco ainda não existe. Rode: npm run db:setup';
    default:
      return erro instanceof Error ? erro.message : String(erro);
  }
}

async function main(): Promise<void> {
  Configuracao.carregarArquivoEnv();
  const config = new Configuracao();
  const [comando, ...flags] = process.argv.slice(2);
  await new CliBanco(config.banco(), config.adminBanco()).executar(comando, flags);
}

main().catch((erro: unknown) => {
  console.error(`✖ ${mensagemAmigavel(erro)}`);
  process.exitCode = 1;
});
