import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { ManutencaoDTO } from '@shared/dto/manutencao.dto';
import { idSchema } from '../security/validators/campos.schema';
import {
  atualizarManutencaoSchema,
  criarManutencaoSchema,
  equipamentoIdSchema,
  filtroManutencaoSchema,
  registrarRetornoSchema
} from '../security/validators/manutencao.schema';
import { Validador } from '../security/validators/Validador';
import type { ManutencaoService } from '../services/ManutencaoService';
import type { RegistroIpc } from './registrarHandlers';

/** Canais `manutencoes:*` (envio para conserto e retorno). */
export function registrarManutencoesIpc(
  registro: RegistroIpc,
  manutencoes: ManutencaoService
): void {
  registro.registrar<ManutencaoDTO>(IPC.manutencoes.criar, async (entrada) =>
    sucesso(await manutencoes.criar(Validador.validar(criarManutencaoSchema, entrada)))
  );
  registro.registrar<ManutencaoDTO[]>(IPC.manutencoes.listar, async (entrada) =>
    sucesso(await manutencoes.listar(Validador.validar(filtroManutencaoSchema, entrada)))
  );
  registro.registrar<ManutencaoDTO[]>(IPC.manutencoes.listarAbertas, async () =>
    sucesso(await manutencoes.listarAbertas())
  );
  registro.registrar<ManutencaoDTO[]>(IPC.manutencoes.listarPorEquipamento, async (entrada) =>
    sucesso(await manutencoes.listarPorEquipamento(Validador.validar(equipamentoIdSchema, entrada)))
  );
  registro.registrar<ManutencaoDTO>(IPC.manutencoes.buscarPorId, async (entrada) =>
    sucesso(await manutencoes.buscarPorId(Validador.validar(idSchema, entrada).id))
  );
  registro.registrar<ManutencaoDTO>(IPC.manutencoes.atualizar, async (entrada) =>
    sucesso(await manutencoes.atualizar(Validador.validar(atualizarManutencaoSchema, entrada)))
  );
  registro.registrar<ManutencaoDTO>(IPC.manutencoes.registrarRetorno, async (entrada) =>
    sucesso(await manutencoes.registrarRetorno(Validador.validar(registrarRetornoSchema, entrada)))
  );
  registro.registrar<void>(IPC.manutencoes.excluir, async (entrada) => {
    await manutencoes.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });
}
