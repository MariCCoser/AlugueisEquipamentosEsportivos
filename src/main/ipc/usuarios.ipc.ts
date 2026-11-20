import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { UsuarioDTO } from '@shared/dto/usuario.dto';
import type { UsuarioService } from '../services/UsuarioService';
import { idSchema } from '../security/validators/campos.schema';
import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  filtroUsuarioSchema
} from '../security/validators/usuario.schema';
import { Validador } from '../security/validators/Validador';
import type { RegistroIpc } from './registrarHandlers';

/** Canais `usuarios:*` (Pessoa 3). Todos são só para ADMIN (ver permissoes.ts). */
export function registrarUsuariosIpc(registro: RegistroIpc, usuarios: UsuarioService): void {
  registro.registrar<UsuarioDTO>(IPC.usuarios.criar, async (entrada) =>
    sucesso(await usuarios.criar(Validador.validar(criarUsuarioSchema, entrada)))
  );

  registro.registrar<UsuarioDTO[]>(IPC.usuarios.listar, async (entrada) =>
    sucesso(await usuarios.listar(Validador.validar(filtroUsuarioSchema, entrada)))
  );

  registro.registrar<UsuarioDTO>(IPC.usuarios.buscarPorId, async (entrada) =>
    sucesso(await usuarios.buscarPorId(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<UsuarioDTO>(IPC.usuarios.atualizar, async (entrada) =>
    sucesso(await usuarios.atualizar(Validador.validar(atualizarUsuarioSchema, entrada)))
  );

  registro.registrar<void>(IPC.usuarios.excluir, async (entrada) => {
    await usuarios.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });
}
