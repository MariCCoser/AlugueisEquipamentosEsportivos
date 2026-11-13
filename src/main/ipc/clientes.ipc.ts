import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { ClienteDTO, HistoricoClienteDTO } from '@shared/dto/cliente.dto';
import type { Paginado } from '@shared/dto/resposta';
import type { ClienteService } from '../services/ClienteService';
import type { HistoricoClienteService } from '../services/HistoricoClienteService';
import { idSchema } from '../security/validators/campos.schema';
import {
  atualizarClienteSchema,
  criarClienteSchema,
  filtroClienteSchema
} from '../security/validators/cliente.schema';
import { Validador } from '../security/validators/Validador';
import type { RegistroIpc } from './registrarHandlers';

/**
 * Canais `clientes:*`. Cada handler só faz três coisas:
 * valida a entrada (zod) → chama o service → embrulha em `sucesso`.
 * Erros esperados (ErroApp) viram `falha` no RegistroIpc.
 */
export function registrarClientesIpc(
  registro: RegistroIpc,
  clientes: ClienteService,
  historico: HistoricoClienteService
): void {
  registro.registrar<ClienteDTO>(IPC.clientes.criar, async (entrada) =>
    sucesso(await clientes.criar(Validador.validar(criarClienteSchema, entrada)))
  );

  registro.registrar<Paginado<ClienteDTO>>(IPC.clientes.listar, async (entrada) =>
    sucesso(await clientes.listar(Validador.validar(filtroClienteSchema, entrada)))
  );

  registro.registrar<ClienteDTO>(IPC.clientes.buscarPorId, async (entrada) =>
    sucesso(await clientes.buscarPorId(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<ClienteDTO>(IPC.clientes.atualizar, async (entrada) =>
    sucesso(await clientes.atualizar(Validador.validar(atualizarClienteSchema, entrada)))
  );

  registro.registrar<void>(IPC.clientes.excluir, async (entrada) => {
    await clientes.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });

  registro.registrar<HistoricoClienteDTO>(IPC.clientes.historico, async (entrada) =>
    sucesso(await historico.historico(Validador.validar(idSchema, entrada).id))
  );
}
