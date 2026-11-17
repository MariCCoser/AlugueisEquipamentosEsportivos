import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { CategoriaDTO } from '@shared/dto/categoria.dto';
import type { CategoriaService } from '../services/CategoriaService';
import { idSchema } from '../security/validators/campos.schema';
import {
  atualizarCategoriaSchema,
  criarCategoriaSchema
} from '../security/validators/categoria.schema';
import { Validador } from '../security/validators/Validador';
import type { RegistroIpc } from './registrarHandlers';

/**
 * Canais `categorias:*`. Quem pode usar cada um está em permissoes.ts:
 * listar/buscar = qualquer usuário logado; criar/atualizar/excluir = só ADMIN
 * (categorias são cadastro de configuração).
 */
export function registrarCategoriasIpc(registro: RegistroIpc, categorias: CategoriaService): void {
  registro.registrar<CategoriaDTO>(IPC.categorias.criar, async (entrada) =>
    sucesso(await categorias.criar(Validador.validar(criarCategoriaSchema, entrada)))
  );

  registro.registrar<CategoriaDTO[]>(IPC.categorias.listar, async () =>
    sucesso(await categorias.listar())
  );

  registro.registrar<CategoriaDTO>(IPC.categorias.buscarPorId, async (entrada) =>
    sucesso(await categorias.buscarPorId(Validador.validar(idSchema, entrada).id))
  );

  registro.registrar<CategoriaDTO>(IPC.categorias.atualizar, async (entrada) =>
    sucesso(await categorias.atualizar(Validador.validar(atualizarCategoriaSchema, entrada)))
  );

  registro.registrar<void>(IPC.categorias.excluir, async (entrada) => {
    await categorias.excluir(Validador.validar(idSchema, entrada).id);
    return sucesso(undefined);
  });
}
