import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { MultaCalculadaDTO, MultaDTO } from '@shared/dto/multa.dto';
import type { PagamentoDTO } from '@shared/dto/pagamento.dto';
import type { ReservaDTO } from '@shared/dto/reserva.dto';
import { idSchema } from '../security/validators/campos.schema';
import {
  atualizarMultaSchema,
  atualizarPagamentoSchema,
  calcularMultaSchema,
  criarMultaSchema,
  criarPagamentoSchema,
  devolverCaucaoSchema,
  filtroMultaSchema,
  filtroPagamentoSchema,
  quitarMultaSchema
} from '../security/validators/financeiro.schema';
import { reservaIdSchema } from '../security/validators/reserva.schema';
import { Validador } from '../security/validators/Validador';
import type { MultaService } from '../services/financeiro/MultaService';
import type { PagamentoService } from '../services/financeiro/PagamentoService';
import type { RegistroIpc } from './registrarHandlers';

/** Canais `multas:*` e `pagamentos:*`: valida (zod) → service → `sucesso`. */
export function registrarFinanceiroIpc(
  registro: RegistroIpc,
  multas: MultaService,
  pagamentos: PagamentoService
): void {
  // ---------- multas ----------
  registro.registrar<MultaCalculadaDTO>(IPC.multas.calcular, async (entrada) =>
    sucesso(await multas.calcular(Validador.validar(calcularMultaSchema, entrada)))
  );
  registro.registrar<MultaDTO>(IPC.multas.criar, async (entrada) =>
    sucesso(await multas.criar(Validador.validar(criarMultaSchema, entrada)))
  );
  registro.registrar<MultaDTO[]>(IPC.multas.listar, async (entrada) =>
    sucesso(await multas.listar(Validador.validar(filtroMultaSchema, entrada)))
  );
  registro.registrar<MultaDTO[]>(IPC.multas.listarEmAberto, async () =>
    sucesso(await multas.listarEmAberto())
  );
  registro.registrar<MultaDTO>(IPC.multas.buscarPorId, async (entrada) =>
    sucesso(await multas.buscarPorId(Validador.validar(idSchema, entrada).id))
  );
  registro.registrar<MultaDTO>(IPC.multas.atualizar, async (entrada) =>
    sucesso(await multas.atualizar(Validador.validar(atualizarMultaSchema, entrada)))
  );
  registro.registrar<void>(IPC.multas.excluir, async (entrada) => {
    await multas.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });
  registro.registrar<MultaDTO>(IPC.multas.quitar, async (entrada) =>
    sucesso(await multas.quitar(Validador.validar(quitarMultaSchema, entrada)))
  );

  // ---------- pagamentos ----------
  registro.registrar<PagamentoDTO>(IPC.pagamentos.criar, async (entrada) =>
    sucesso(await pagamentos.criar(Validador.validar(criarPagamentoSchema, entrada)))
  );
  registro.registrar<PagamentoDTO[]>(IPC.pagamentos.listar, async (entrada) =>
    sucesso(await pagamentos.listar(Validador.validar(filtroPagamentoSchema, entrada)))
  );
  registro.registrar<PagamentoDTO[]>(IPC.pagamentos.listarPorReserva, async (entrada) =>
    sucesso(await pagamentos.listarPorReserva(Validador.validar(reservaIdSchema, entrada)))
  );
  registro.registrar<PagamentoDTO>(IPC.pagamentos.buscarPorId, async (entrada) =>
    sucesso(await pagamentos.buscarPorId(Validador.validar(idSchema, entrada).id))
  );
  registro.registrar<PagamentoDTO>(IPC.pagamentos.atualizar, async (entrada) =>
    sucesso(await pagamentos.atualizar(Validador.validar(atualizarPagamentoSchema, entrada)))
  );
  registro.registrar<void>(IPC.pagamentos.excluir, async (entrada) => {
    await pagamentos.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });
  registro.registrar<ReservaDTO>(IPC.pagamentos.devolverCaucao, async (entrada) =>
    sucesso(await pagamentos.devolverCaucao(Validador.validar(devolverCaucaoSchema, entrada)))
  );
}
