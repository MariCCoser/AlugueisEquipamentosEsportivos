import { describe, expect, it } from 'vitest';
import { IPC, TODOS_OS_CANAIS } from '../../src/shared/ipc-channels';

describe('ipc-channels', () => {
  it('tem os 78 canais da proposta, mais os 2 do app', () => {
    const daProposta = TODOS_OS_CANAIS.filter((canal) => !canal.startsWith('app:'));
    expect(daProposta).toHaveLength(78);
    expect(TODOS_OS_CANAIS).toHaveLength(80);
  });

  it('a quantidade por domínio bate com a tabela 6.14 da proposta', () => {
    const contar = (dominio: keyof typeof IPC) => Object.keys(IPC[dominio]).length;
    expect(contar('auth')).toBe(4);
    expect(contar('usuarios')).toBe(5);
    expect(contar('clientes')).toBe(6);
    expect(contar('categorias')).toBe(5);
    expect(contar('fornecedores')).toBe(6);
    expect(contar('equipamentos')).toBe(8);
    // reservas + itensReserva = 14, devoluções + multas = 9 (a devolução fica em reservas)
    expect(contar('reservas') - 1 + contar('itensReserva')).toBe(14);
    expect(1 + contar('multas')).toBe(9);
    expect(contar('manutencoes')).toBe(8);
    expect(contar('pagamentos')).toBe(7);
    expect(contar('integracoes')).toBe(3);
    expect(contar('notificacoes')).toBe(2);
    expect(contar('dashboard')).toBe(1);
  });

  it('todo canal segue o padrão dominio:acao, com o domínio do grupo onde está', () => {
    for (const [dominio, acoes] of Object.entries(IPC)) {
      for (const [acao, canal] of Object.entries(acoes)) {
        expect(canal).toBe(`${dominio}:${acao}`);
      }
    }
  });

  it('não tem canal repetido', () => {
    expect(new Set(TODOS_OS_CANAIS).size).toBe(TODOS_OS_CANAIS.length);
  });
});
