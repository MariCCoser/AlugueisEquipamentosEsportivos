import { RegraNegocioError, ValidacaoError, type DominioError } from './DominioError';

/** Textos que o service passa para personalizar a mensagem de cada situação. */
export interface MensagensErroBanco {
  /** Excluir algo que outra tabela ainda usa (FK com ON DELETE RESTRICT). */
  emUso?: string;
  /** Valor repetido numa coluna UNIQUE (ex.: CPF, CNPJ). */
  duplicado?: string;
  /** Gravar um id que não existe em outra tabela (ex.: categoria apagada). */
  referenciaInexistente?: string;
}

/**
 * Converte erros conhecidos do MySQL em erros de domínio com mensagem amigável.
 * Assim a tela recebe "não é possível excluir: possui reservas" em vez de um
 * erro genérico, e o texto do MySQL (que cita tabelas e colunas) nunca vaza.
 *
 * Erros que não reconhece são devolvidos como estão (viram INTERNO no IPC).
 */
export class TradutorErroBanco {
  static traduzir(erro: unknown, mensagens: MensagensErroBanco = {}): unknown {
    switch (TradutorErroBanco.codigo(erro)) {
      case 'ER_ROW_IS_REFERENCED_2':
        return new RegraNegocioError(
          mensagens.emUso ?? 'Não é possível excluir: o registro está sendo usado.'
        );
      case 'ER_DUP_ENTRY':
        return new RegraNegocioError(
          mensagens.duplicado ?? 'Já existe um registro com esses dados.'
        );
      case 'ER_NO_REFERENCED_ROW_2':
        return new ValidacaoError(
          mensagens.referenciaInexistente ?? 'Um dos registros relacionados não existe.'
        );
      default:
        return erro;
    }
  }

  /** Executa `operacao` e, se o MySQL reclamar, lança o erro já traduzido. */
  static async proteger<T>(
    operacao: () => Promise<T>,
    mensagens: MensagensErroBanco = {}
  ): Promise<T> {
    try {
      return await operacao();
    } catch (erro) {
      throw TradutorErroBanco.traduzir(erro, mensagens) as DominioError | Error;
    }
  }

  private static codigo(erro: unknown): string | undefined {
    if (typeof erro === 'object' && erro !== null && 'code' in erro) {
      const { code } = erro as { code: unknown };
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }
}
