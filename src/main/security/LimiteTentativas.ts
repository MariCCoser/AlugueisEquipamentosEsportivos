/** Quantas senhas erradas seguidas bloqueiam o e-mail. */
export const MAXIMO_TENTATIVAS = 5;

/** Por quanto tempo o e-mail fica bloqueado depois disso. */
export const BLOQUEIO_MS = 5 * 60 * 1000;

interface Registro {
  erros: number;
  bloqueadoAte: number;
}

/**
 * Limite de tentativas de login, por e-mail, guardado na memória do Main.
 *
 * Depois de 5 senhas erradas seguidas o e-mail fica bloqueado por 5 minutos,
 * mesmo que a senha certa seja digitada. Isso impede alguém de testar uma lista
 * de senhas na tela de login. Um login certo zera a contagem.
 *
 * O relógio é recebido no construtor para os testes não precisarem esperar 5 minutos.
 */
export class LimiteTentativas {
  private readonly registros = new Map<string, Registro>();

  constructor(
    private readonly maximo = MAXIMO_TENTATIVAS,
    private readonly bloqueioMs = BLOQUEIO_MS,
    private readonly agora: () => number = Date.now
  ) {}

  /** Minutos que faltam para liberar o e-mail, ou 0 se ele pode tentar. */
  minutosBloqueado(email: string): number {
    const registro = this.registros.get(LimiteTentativas.chave(email));
    if (!registro) return 0;
    const restante = registro.bloqueadoAte - this.agora();
    return restante > 0 ? Math.ceil(restante / 60_000) : 0;
  }

  registrarErro(email: string): void {
    const chave = LimiteTentativas.chave(email);
    const registro = this.registros.get(chave) ?? { erros: 0, bloqueadoAte: 0 };
    // Bloqueio já venceu: começa a contar de novo
    if (registro.bloqueadoAte && registro.bloqueadoAte <= this.agora()) {
      registro.erros = 0;
      registro.bloqueadoAte = 0;
    }
    registro.erros += 1;
    if (registro.erros >= this.maximo) registro.bloqueadoAte = this.agora() + this.bloqueioMs;
    this.registros.set(chave, registro);
  }

  registrarAcerto(email: string): void {
    this.registros.delete(LimiteTentativas.chave(email));
  }

  /** Mesmo e-mail com maiúsculas ou espaços conta como o mesmo. */
  private static chave(email: string): string {
    return email.trim().toLowerCase();
  }
}
