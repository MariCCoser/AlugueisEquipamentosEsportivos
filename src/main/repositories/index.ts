import type { Executor } from '../database/Database';
import { CategoriaRepository } from './CategoriaRepository';
import { ClienteRepository } from './ClienteRepository';
import { EquipamentoRepository } from './EquipamentoRepository';
import { FornecedorRepository } from './FornecedorRepository';
import { ItemReservaRepository } from './ItemReservaRepository';
import { ManutencaoRepository } from './ManutencaoRepository';
import { MultaRepository } from './MultaRepository';
import { PagamentoRepository } from './PagamentoRepository';
import { ReservaRepository } from './ReservaRepository';
import { UsuarioRepository } from './UsuarioRepository';

export * from './BaseRepository';
export {
  CategoriaRepository,
  ClienteRepository,
  EquipamentoRepository,
  FornecedorRepository,
  ItemReservaRepository,
  ManutencaoRepository,
  MultaRepository,
  PagamentoRepository,
  ReservaRepository,
  UsuarioRepository
};

export interface Repositorios {
  usuarios: UsuarioRepository;
  clientes: ClienteRepository;
  categorias: CategoriaRepository;
  fornecedores: FornecedorRepository;
  equipamentos: EquipamentoRepository;
  reservas: ReservaRepository;
  itensReserva: ItemReservaRepository;
  manutencoes: ManutencaoRepository;
  multas: MultaRepository;
  pagamentos: PagamentoRepository;
}

/**
 * Cria os 10 repositórios em cima do mesmo executor.
 *
 * ```ts
 * const repos = criarRepositorios(db);               // uso normal (pool)
 * await db.transacao(async (tx) => {
 *   const r = criarRepositorios(tx);                 // tudo na mesma transação
 *   const reserva = await r.reservas.criar({...});
 *   await r.itensReserva.criar({ reservaId: reserva.id, ... });
 * });
 * ```
 */
export function criarRepositorios(executor: Executor): Repositorios {
  return {
    usuarios: new UsuarioRepository(executor),
    clientes: new ClienteRepository(executor),
    categorias: new CategoriaRepository(executor),
    fornecedores: new FornecedorRepository(executor),
    equipamentos: new EquipamentoRepository(executor),
    reservas: new ReservaRepository(executor),
    itensReserva: new ItemReservaRepository(executor),
    manutencoes: new ManutencaoRepository(executor),
    multas: new MultaRepository(executor),
    pagamentos: new PagamentoRepository(executor)
  };
}
