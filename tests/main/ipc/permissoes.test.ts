import { describe, expect, it } from 'vitest';
import { TODOS_OS_CANAIS } from '../../../src/shared/ipc-channels';
import { PERMISSOES } from '../../../src/main/ipc/permissoes';

describe('permissões dos canais', () => {
  it('todo canal tem uma permissão válida, e não sobra permissão de canal inexistente', () => {
    for (const canal of TODOS_OS_CANAIS) {
      expect(['PUBLICO', 'LOGADO', 'ADMIN']).toContain(PERMISSOES[canal]);
    }
    expect(Object.keys(PERMISSOES).sort()).toEqual([...TODOS_OS_CANAIS].sort());
  });

  it('só o mínimo é público (tela inicial, login e sessão atual)', () => {
    const publicos = TODOS_OS_CANAIS.filter((canal) => PERMISSOES[canal] === 'PUBLICO');
    expect(publicos.sort()).toEqual(
      ['app:info', 'app:statusBanco', 'auth:login', 'auth:sessaoAtual'].sort()
    );
  });

  it('gestão de usuários é só para ADMIN', () => {
    const deUsuarios = TODOS_OS_CANAIS.filter((canal) => canal.startsWith('usuarios:'));
    for (const canal of deUsuarios) expect(PERMISSOES[canal]).toBe('ADMIN');
  });

  it('excluir é só para ADMIN (menos item de reserva PENDENTE, que o funcionário pode)', () => {
    const excluir = TODOS_OS_CANAIS.filter((canal) => canal.endsWith(':excluir'));
    for (const canal of excluir) {
      expect(PERMISSOES[canal]).toBe(canal === 'itensReserva:excluir' ? 'LOGADO' : 'ADMIN');
    }
  });
});
