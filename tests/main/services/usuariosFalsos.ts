import { vi } from 'vitest';
import type { NovoUsuario, Usuario } from '@shared/models/entidades';
import type { FiltroUsuario } from '../../../src/main/repositories/UsuarioRepository';
import { umUsuario } from './dadosTeste';

/**
 * Tabela `usuarios` em memória, com os mesmos métodos do UsuarioRepository
 * que o AuthService e o UsuarioService usam.
 */
export function criarRepoUsuarios(iniciais: Usuario[] = [umUsuario()]) {
  let itens = iniciais.map((u) => ({ ...u }));
  let proximoId = Math.max(0, ...itens.map((u) => u.id)) + 1;
  /** Reservas registradas por usuário (id -> quantidade). */
  const reservas = new Map<number, number>();

  const repo = {
    criar: vi.fn(async (dados: NovoUsuario) => {
      const criado = umUsuario({ ...dados, id: proximoId++ });
      itens.push(criado);
      return { ...criado };
    }),
    buscarPorId: vi.fn(async (id: number) => {
      const u = itens.find((x) => x.id === id);
      return u ? { ...u } : null;
    }),
    buscarPorEmail: vi.fn(async (email: string) => {
      const u = itens.find((x) => x.email === email.trim().toLowerCase());
      return u ? { ...u } : null;
    }),
    listarFiltrado: vi.fn(async (filtro: FiltroUsuario = {}) =>
      itens
        .filter((u) => !filtro.perfil || u.perfil === filtro.perfil)
        .filter((u) => filtro.ativo === undefined || u.ativo === filtro.ativo)
        .map((u) => ({ ...u }))
    ),
    atualizar: vi.fn(async (id: number, dados: Partial<NovoUsuario>) => {
      const atual = itens.find((u) => u.id === id);
      if (!atual) return null;
      for (const [campo, valor] of Object.entries(dados)) {
        if (valor !== undefined) Object.assign(atual, { [campo]: valor });
      }
      return { ...atual };
    }),
    excluir: vi.fn(async (id: number) => {
      const antes = itens.length;
      itens = itens.filter((u) => u.id !== id);
      return itens.length < antes;
    }),
    contarReservas: vi.fn(async (id: number) => reservas.get(id) ?? 0),
    registrarLogin: vi.fn(async (id: number) => {
      const u = itens.find((x) => x.id === id);
      if (u) u.ultimoLogin = '2026-11-20 10:00:00';
    })
  };

  return { repo, reservas, itens: () => itens };
}
