import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** O que a classe precisa saber do app (vem do `app` do Electron; nos testes, de um objeto simples). */
export interface InfoApp {
  /** true no app instalado; false no `npm run dev`. */
  empacotado: boolean;
  /** Pasta de dados do usuário, ex.: C:\Users\fulano\AppData\Roaming\Locadora Esportiva */
  pastaDados: string;
  /** Caminho do .exe instalado. */
  executavel: string;
  /** Pasta de onde o comando foi rodado (no dev, a raiz do projeto). */
  pastaAtual: string;
}

/**
 * Decide DE ONDE o `.env` é lido.
 *
 * - Em desenvolvimento: raiz do projeto (como sempre foi).
 * - No app instalado: o `.env` NÃO vai dentro do instalador (teria a senha do banco
 *   dentro do pacote, e cada loja tem o seu banco). Ele fica fora do pacote:
 *     1º `%APPDATA%\Locadora Esportiva\.env`  — por usuário, não precisa de administrador;
 *     2º ao lado do `.exe`                     — para quem instalou numa pasta própria.
 *   No app instalado a "pasta atual" não serve: aberto pelo menu Iniciar ela costuma ser
 *   C:\Windows\System32.
 */
export class LocalArquivoEnv {
  static readonly NOME = '.env';

  constructor(
    private readonly info: InfoApp,
    private readonly existe: (caminho: string) => boolean = existsSync
  ) {}

  /** Lugares procurados, na ordem de preferência. */
  candidatos(): string[] {
    if (!this.info.empacotado) return [resolve(this.info.pastaAtual, LocalArquivoEnv.NOME)];
    return [
      join(this.info.pastaDados, LocalArquivoEnv.NOME),
      join(dirname(this.info.executavel), LocalArquivoEnv.NOME)
    ];
  }

  /**
   * O primeiro candidato que existe. Se nenhum existir, devolve o primeiro: o app abre
   * mesmo assim e a tela "Status do sistema" mostra o que falta configurar.
   */
  caminho(): string {
    const candidatos = this.candidatos();
    return candidatos.find((c) => this.existe(c)) ?? candidatos[0]!;
  }
}
