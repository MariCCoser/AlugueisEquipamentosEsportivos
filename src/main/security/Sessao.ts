import type { UsuarioSessaoDTO } from '@shared/dto/auth.dto';
import type { Perfil } from '@shared/models/enums';

/**
 * Guarda quem está logado. Fica no Main, nunca na tela:
 * assim a tela não consegue "fingir" que é outro usuário ou que é ADMIN.
 *
 * O login (auth:login) chama `iniciar` depois de conferir a senha,
 * e o logout chama `encerrar`.
 */
export class Sessao {
  private usuario: UsuarioSessaoDTO | null = null;

  iniciar(usuario: UsuarioSessaoDTO): void {
    this.usuario = { ...usuario };
  }

  encerrar(): void {
    this.usuario = null;
  }

  /** Quem está logado agora, ou `null`. */
  usuarioAtual(): UsuarioSessaoDTO | null {
    return this.usuario ? { ...this.usuario } : null;
  }

  /** Perfil de quem está logado, ou `null` se ninguém estiver. */
  perfilAtual(): Perfil | null {
    return this.usuario?.perfil ?? null;
  }
}
