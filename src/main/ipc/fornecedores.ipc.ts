import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { FornecedorDTO } from '@shared/dto/fornecedor.dto';
import type { FornecedorService } from '../services/FornecedorService';
import { idSchema } from '../security/validators/campos.schema';
import {
  atualizarFornecedorSchema,
  criarFornecedorSchema,
  filtroFornecedorSchema,
  tipoFornecedorSchema
} from '../security/validators/fornecedor.schema';
import { Validador } from '../security/validators/Validador';
import type { RegistroIpc } from './registrarHandlers';

/**
 * Canais `fornecedores:*`. Quem pode usar cada um está em permissoes.ts:
 * listar/buscar = qualquer usuário logado; criar/atualizar/excluir = só ADMIN.
 */
export function registrarFornecedoresIpc(
  registro: RegistroIpc,
  fornecedores: FornecedorService
): void {
  registro.registrar<FornecedorDTO>(IPC.fornecedores.criar, async (entrada) =>
    sucesso(await fornecedores.criar(Validador.validar(criarFornecedorSchema, entrada)))
  );

  registro.registrar<FornecedorDTO[]>(IPC.fornecedores.listar, async (entrada) =>
    sucesso(await fornecedores.listar(Validador.validar(filtroFornecedorSchema, entrada)))
  );

  registro.registrar<FornecedorDTO[]>(IPC.fornecedores.listarPorTipo, async (entrada) =>
    sucesso(await fornecedores.listarPorTipo(Validador.validar(tipoFornecedorSchema, entrada).tipo))
  );

  registro.registrar<FornecedorDTO>(IPC.fornecedores.buscarPorId, async (entrada) =>
    sucesso(await fornecedores.buscarPorId(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<FornecedorDTO>(IPC.fornecedores.atualizar, async (entrada) =>
    sucesso(await fornecedores.atualizar(Validador.validar(atualizarFornecedorSchema, entrada)))
  );

  registro.registrar<void>(IPC.fornecedores.excluir, async (entrada) => {
    await fornecedores.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });
}
