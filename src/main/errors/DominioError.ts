import type { CodigoErro } from '@shared/dto/resposta';

/**
 * Base de todos os erros de regra do sistema.
 *
 * A mensagem é sempre amigável (pode ir direto para a tela). O `codigo` diz ao
 * registro de IPC qual `Resposta` de erro devolver. Erros que NÃO herdam desta
 * classe são tratados como inesperados e viram 'INTERNO' (sem detalhes).
 */
export abstract class DominioError extends Error {
  abstract readonly codigo: CodigoErro;

  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** Uma regra de negócio impede a operação (ex.: excluir cliente com reservas). */
export class RegraNegocioError extends DominioError {
  readonly codigo = 'REGRA_NEGOCIO';
}

/** O registro pedido não existe. */
export class NaoEncontradoError extends DominioError {
  readonly codigo = 'NAO_ENCONTRADO';

  constructor(entidade: string, id: number) {
    super(`${entidade} #${id} não encontrado(a).`);
  }
}

/** Dado com formato ou valor inválido que chegou até o domínio. */
export class ValidacaoError extends DominioError {
  readonly codigo = 'VALIDACAO';

  constructor(
    mensagem: string,
    readonly campos?: Record<string, string>
  ) {
    super(mensagem);
  }
}
