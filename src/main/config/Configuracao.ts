import { resolve } from 'node:path';
import dotenv from 'dotenv';

export interface ConfigBanco {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

/** Usuário com permissão de criar banco/tabelas. Usado só pelo `npm run db:*`, nunca pelo app. */
export interface ConfigAdminBanco {
  user: string;
  password: string;
}

export class ConfiguracaoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ConfiguracaoError';
  }
}

/** Lê e valida as variáveis de ambiente (.env). */
export class Configuracao {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  /** Carrega o .env da raiz do projeto para process.env (não sobrescreve o que já existe). */
  static carregarArquivoEnv(caminho = resolve(process.cwd(), '.env')): void {
    dotenv.config({ path: caminho });
  }

  banco(): ConfigBanco {
    return {
      host: this.texto('DB_HOST', '127.0.0.1'),
      port: this.inteiro('DB_PORT', 3306),
      user: this.obrigatoria('DB_USER'),
      password: this.env['DB_PASSWORD'] ?? '',
      database: this.identificador('DB_NAME'),
      connectionLimit: this.inteiro('DB_POOL_LIMIT', 10)
    };
  }

  adminBanco(): ConfigAdminBanco {
    return {
      user: this.texto('DB_ADMIN_USER', 'root'),
      password: this.env['DB_ADMIN_PASSWORD'] ?? ''
    };
  }

  private texto(nome: string, padrao: string): string {
    const valor = this.env[nome]?.trim();
    return valor ? valor : padrao;
  }

  private obrigatoria(nome: string): string {
    const valor = this.env[nome]?.trim();
    if (!valor) {
      throw new ConfiguracaoError(`Variável ${nome} não definida. Copie .env.example para .env.`);
    }
    return valor;
  }

  private inteiro(nome: string, padrao: number): number {
    const bruto = this.env[nome]?.trim();
    if (!bruto) return padrao;
    const valor = Number(bruto);
    if (!Number.isInteger(valor) || valor <= 0) {
      throw new ConfiguracaoError(`Variável ${nome} deve ser um número inteiro positivo.`);
    }
    return valor;
  }

  /** Nome de banco entra em SQL sem placeholder (CREATE DATABASE), então só aceita letras, números e _. */
  private identificador(nome: string): string {
    const valor = this.obrigatoria(nome);
    if (!/^[A-Za-z0-9_]+$/.test(valor)) {
      throw new ConfiguracaoError(`Variável ${nome} só pode ter letras, números e _.`);
    }
    return valor;
  }
}
