/**
 * Logs sem dados pessoais (LGPD).
 *
 * Mensagens de erro técnicas podem carregar dados do cliente. Exemplo real do MySQL:
 * "Duplicate entry '52998224725' for key 'uk_clientes_cpf'". Antes de ir para o
 * terminal, o texto passa por `mascarar`, que troca:
 * - CPF (com ou sem pontuação) e qualquer sequência de 10 ou 11 dígitos (telefone) por `[número]`;
 * - e-mails por `[e-mail]`;
 * - o texto de busca de URLs (`?q=...`, que pode ter endereço) por `?[...]`.
 *
 * Só o nome do erro, o código e a mensagem mascarada vão para o log. Os campos
 * extras do erro do mysql2 (`sql`, `sqlMessage`, `values`) ficam de fora.
 */
export class LogSeguro {
  private static readonly CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  /** 10 ou 11 dígitos seguidos (telefone com DDD, CPF sem pontuação). */
  private static readonly DIGITOS = /\b\d{10,11}\b/g;
  /** Telefone formatado, ex.: (11) 98765-4321. */
  private static readonly TELEFONE = /(?:\(\d{2}\)\s?)?\b\d{4,5}-\d{4}\b/g;
  private static readonly EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
  private static readonly BUSCA_URL = /\?[^\s'"]*/g;

  static mascarar(texto: string): string {
    return texto
      .replace(LogSeguro.EMAIL, '[e-mail]')
      .replace(LogSeguro.BUSCA_URL, '?[...]')
      .replace(LogSeguro.CPF, '[número]')
      .replace(LogSeguro.DIGITOS, '[número]')
      .replace(LogSeguro.TELEFONE, '[número]');
  }

  /** Descrição curta e mascarada de um erro: "Error ER_DUP_ENTRY: Duplicate entry '[número]'..." */
  static descrever(erro: unknown): string {
    if (erro instanceof Error) {
      const codigo = (erro as { code?: unknown }).code;
      const prefixo = typeof codigo === 'string' ? `${erro.name} ${codigo}` : erro.name;
      return `${prefixo}: ${LogSeguro.mascarar(erro.message)}`;
    }
    return LogSeguro.mascarar(String(erro));
  }

  static erro(contexto: string, erro: unknown): void {
    console.error(contexto, LogSeguro.descrever(erro));
  }

  static aviso(contexto: string, texto: string): void {
    console.warn(contexto, LogSeguro.mascarar(texto));
  }
}
