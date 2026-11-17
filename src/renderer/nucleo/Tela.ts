/**
 * Contrato que toda tela do sistema segue.
 * O Roteador cria a tela, chama `montar` e, ao sair dela, chama `desmontar`.
 */
export interface Tela {
  /** Usado no título da janela e no cabeçalho da tela. */
  readonly titulo: string;
  montar(alvo: HTMLElement): void | Promise<void>;
  /** Limpa timers e ouvintes globais criados pela tela (opcional). */
  desmontar?(): void;
}
