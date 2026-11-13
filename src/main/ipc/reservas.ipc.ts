import { IPC } from '@shared/ipc-channels';
import { sucesso, type Paginado } from '@shared/dto/resposta';
import type {
  ItemReservaDTO,
  ReservaAtrasadaDTO,
  ReservaDTO,
  ReservaResumoDTO
} from '@shared/dto/reserva.dto';
import { NaoAutorizadoError } from '../errors/DominioError';
import type { Sessao } from '../security/Sessao';
import { idSchema } from '../security/validators/campos.schema';
import {
  atualizarItemReservaSchema,
  atualizarReservaSchema,
  cancelarReservaSchema,
  criarItemReservaSchema,
  criarReservaSchema,
  filtroReservaSchema,
  reservaIdSchema
} from '../security/validators/reserva.schema';
import { Validador } from '../security/validators/Validador';
import type { ItemReservaService } from '../services/reserva/ItemReservaService';
import type { ReservaService } from '../services/reserva/ReservaService';
import type { RegistroIpc } from './registrarHandlers';

/**
 * Canais `reservas:*` e `itensReserva:*`.
 * `reservas:registrarDevolucao` entra na etapa 4 (devolução e multas).
 */
export function registrarReservasIpc(
  registro: RegistroIpc,
  reservas: ReservaService,
  itens: ItemReservaService,
  sessao: Pick<Sessao, 'usuarioAtual'>
): void {
  // ---------- reservas ----------
  registro.registrar<ReservaDTO>(IPC.reservas.criar, async (entrada) => {
    const dados = Validador.validar(criarReservaSchema, entrada);
    // Quem registrou a reserva vem da sessão no Main, nunca da tela
    const usuario = sessao.usuarioAtual();
    if (!usuario) throw new NaoAutorizadoError('Faça login para continuar.');
    return sucesso(await reservas.criar(dados, usuario.id));
  });

  registro.registrar<Paginado<ReservaResumoDTO>>(IPC.reservas.listar, async (entrada) =>
    sucesso(await reservas.listar(Validador.validar(filtroReservaSchema, entrada)))
  );

  registro.registrar<ReservaDTO>(IPC.reservas.buscarPorId, async (entrada) =>
    sucesso(await reservas.buscarPorId(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<ReservaDTO>(IPC.reservas.atualizar, async (entrada) =>
    sucesso(await reservas.atualizar(Validador.validar(atualizarReservaSchema, entrada)))
  );

  registro.registrar<void>(IPC.reservas.excluir, async (entrada) => {
    await reservas.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });

  registro.registrar<ReservaDTO>(IPC.reservas.confirmarRetirada, async (entrada) =>
    sucesso(await reservas.confirmarRetirada(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<ReservaDTO>(IPC.reservas.cancelar, async (entrada) =>
    sucesso(await reservas.cancelar(Validador.validar(cancelarReservaSchema, entrada)))
  );

  registro.registrar<ReservaResumoDTO[]>(IPC.reservas.listarAtivas, async () =>
    sucesso(await reservas.listarAtivas())
  );

  registro.registrar<ReservaAtrasadaDTO[]>(IPC.reservas.listarAtrasadas, async () =>
    sucesso(await reservas.listarAtrasadas())
  );

  // ---------- itens da reserva ----------
  registro.registrar<ItemReservaDTO>(IPC.itensReserva.criar, async (entrada) =>
    sucesso(await itens.criar(Validador.validar(criarItemReservaSchema, entrada)))
  );

  registro.registrar<ItemReservaDTO[]>(IPC.itensReserva.listarPorReserva, async (entrada) =>
    sucesso(await itens.listarPorReserva(Validador.validar(reservaIdSchema, entrada)))
  );

  registro.registrar<ItemReservaDTO>(IPC.itensReserva.buscarPorId, async (entrada) =>
    sucesso(await itens.buscarPorId(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<ItemReservaDTO>(IPC.itensReserva.atualizar, async (entrada) =>
    sucesso(await itens.atualizar(Validador.validar(atualizarItemReservaSchema, entrada)))
  );

  registro.registrar<void>(IPC.itensReserva.excluir, async (entrada) => {
    await itens.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });
}
