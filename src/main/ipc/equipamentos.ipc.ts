import { IPC } from '@shared/ipc-channels';
import { sucesso, type Paginado } from '@shared/dto/resposta';
import type { DisponibilidadeDTO, EquipamentoDTO } from '@shared/dto/equipamento.dto';
import type { DisponibilidadeService } from '../services/DisponibilidadeService';
import type { EquipamentoService } from '../services/EquipamentoService';
import { idSchema } from '../security/validators/campos.schema';
import {
  alterarStatusEquipamentoSchema,
  atualizarEquipamentoSchema,
  criarEquipamentoSchema,
  filtroEquipamentoSchema,
  listarDisponiveisSchema,
  verificarDisponibilidadeSchema
} from '../security/validators/equipamento.schema';
import { Validador } from '../security/validators/Validador';
import type { RegistroIpc } from './registrarHandlers';

/** Canais `equipamentos:*` (inventário e disponibilidade). Mesmo padrão de clientes.ipc.ts. */
export function registrarEquipamentosIpc(
  registro: RegistroIpc,
  equipamentos: EquipamentoService,
  disponibilidade: DisponibilidadeService
): void {
  registro.registrar<EquipamentoDTO>(IPC.equipamentos.criar, async (entrada) =>
    sucesso(await equipamentos.criar(Validador.validar(criarEquipamentoSchema, entrada)))
  );

  registro.registrar<Paginado<EquipamentoDTO>>(IPC.equipamentos.listar, async (entrada) =>
    sucesso(await equipamentos.listar(Validador.validar(filtroEquipamentoSchema, entrada)))
  );

  registro.registrar<EquipamentoDTO>(IPC.equipamentos.buscarPorId, async (entrada) =>
    sucesso(await equipamentos.buscarPorId(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<EquipamentoDTO>(IPC.equipamentos.atualizar, async (entrada) =>
    sucesso(await equipamentos.atualizar(Validador.validar(atualizarEquipamentoSchema, entrada)))
  );

  registro.registrar<void>(IPC.equipamentos.excluir, async (entrada) => {
    await equipamentos.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });

  registro.registrar<DisponibilidadeDTO>(
    IPC.equipamentos.verificarDisponibilidade,
    async (entrada) =>
      sucesso(
        await disponibilidade.verificar(Validador.validar(verificarDisponibilidadeSchema, entrada))
      )
  );

  registro.registrar<EquipamentoDTO[]>(IPC.equipamentos.listarDisponiveis, async (entrada) =>
    sucesso(
      await equipamentos.listarDisponiveis(Validador.validar(listarDisponiveisSchema, entrada))
    )
  );

  registro.registrar<EquipamentoDTO>(IPC.equipamentos.alterarStatus, async (entrada) =>
    sucesso(
      await equipamentos.alterarStatus(Validador.validar(alterarStatusEquipamentoSchema, entrada))
    )
  );
}
