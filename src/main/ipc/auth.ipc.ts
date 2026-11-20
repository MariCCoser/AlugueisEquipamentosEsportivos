import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { UsuarioSessaoDTO } from '@shared/dto/auth.dto';
import type { AuthService } from '../services/AuthService';
import { alterarSenhaSchema, loginSchema } from '../security/validators/usuario.schema';
import { Validador } from '../security/validators/Validador';
import type { RegistroIpc } from './registrarHandlers';

/**
 * Canais `auth:*` (Pessoa 3). Permissões em permissoes.ts:
 * - login e sessaoAtual são PUBLICOS (a tela chama antes de alguém entrar);
 * - logout e alterarSenha exigem alguém logado.
 */
export function registrarAuthIpc(registro: RegistroIpc, auth: AuthService): void {
  registro.registrar<UsuarioSessaoDTO>(IPC.auth.login, async (entrada) =>
    sucesso(await auth.login(Validador.validar(loginSchema, entrada)))
  );

  registro.registrar<void>(IPC.auth.logout, async () => {
    auth.logout();
    return sucesso(undefined);
  });

  registro.registrar<UsuarioSessaoDTO | null>(IPC.auth.sessaoAtual, async () =>
    sucesso(auth.sessaoAtual())
  );

  registro.registrar<void>(IPC.auth.alterarSenha, async (entrada) => {
    await auth.alterarSenha(Validador.validar(alterarSenhaSchema, entrada));
    return sucesso(undefined);
  });
}
