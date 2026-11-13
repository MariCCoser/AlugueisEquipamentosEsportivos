import type { CodigoErro } from '@shared/dto/resposta';

/**
 * Erro "esperado", com uma mensagem que pode ir direto para a tela.
 * O registro IPC transforma este erro em `{ ok: false, erro: { codigo, mensagem, campos } }`.
 *
 * Erros que NÃO são ErroApp (bug, falha do banco...) aparecem para o usuário
 * só como "Erro inesperado", para não vazar detalhes técnicos.
 */
export class ErroApp extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
    /** Mensagem por campo do formulário (só em erros de validação). */
    readonly campos?: Record<string, string>
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** Dados enviados pela tela estão errados. `campos` diz qual campo e por quê. */
export class ValidacaoError extends ErroApp {
  constructor(mensagem: string, campos?: Record<string, string>) {
    super('VALIDACAO', mensagem, campos);
  }
}

/**
 * O registro pedido não existe. Duas formas de usar:
 * - `new NaoEncontradoError('Reserva não encontrada.')` → mensagem pronta;
 * - `new NaoEncontradoError('Cliente', 7)` → "Cliente #7 não encontrado(a)."
 */
export class NaoEncontradoError extends ErroApp {
  constructor(mensagemOuEntidade: string, id?: number) {
    super(
      'NAO_ENCONTRADO',
      id === undefined ? mensagemOuEntidade : `${mensagemOuEntidade} #${id} não encontrado(a).`
    );
  }
}

/** A ação vai contra uma regra do negócio (ex.: excluir cliente que tem reservas). */
export class RegraNegocioError extends ErroApp {
  constructor(mensagem: string) {
    super('REGRA_NEGOCIO', mensagem);
  }
}

/** A operação exige alguém logado (ou com permissão) e não há. */
export class NaoAutorizadoError extends ErroApp {
  constructor(mensagem: string) {
    super('NAO_AUTORIZADO', mensagem);
  }
}

/** Uma API externa falhou (fora do ar, demorou demais, recusou...). */
export class IntegracaoError extends ErroApp {
  constructor(mensagem: string) {
    super('INTEGRACAO', mensagem);
  }
}
