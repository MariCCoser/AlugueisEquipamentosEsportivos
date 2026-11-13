import type { CodigoErro } from '@shared/dto/resposta';

/**
 * Erro "esperado", com uma mensagem que pode ir direto para a tela.
 * O registro IPC transforma este erro em `{ ok: false, erro: { codigo, mensagem } }`.
 *
 * Erros que NÃO são ErroApp (bug, falha do banco...) aparecem para o usuário
 * só como "Erro inesperado", para não vazar detalhes técnicos.
 */
export class ErroApp extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** Dados enviados pela tela estão errados. */
export class ValidacaoError extends ErroApp {
  constructor(mensagem: string) {
    super('VALIDACAO', mensagem);
  }
}

/** O registro pedido não existe. */
export class NaoEncontradoError extends ErroApp {
  constructor(mensagem: string) {
    super('NAO_ENCONTRADO', mensagem);
  }
}

/** A ação vai contra uma regra do negócio (ex.: lembrar devolução de reserva já devolvida). */
export class RegraNegocioError extends ErroApp {
  constructor(mensagem: string) {
    super('REGRA_NEGOCIO', mensagem);
  }
}

/** Uma API externa falhou (fora do ar, demorou demais, recusou...). */
export class IntegracaoError extends ErroApp {
  constructor(mensagem: string) {
    super('INTEGRACAO', mensagem);
  }
}
