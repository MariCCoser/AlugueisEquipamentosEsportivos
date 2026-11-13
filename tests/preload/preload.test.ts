import { describe, expect, it, vi } from 'vitest';
import { TODOS_OS_CANAIS } from '../../src/shared/ipc-channels';

// Trocamos o Electron por versões de mentira para ver o que o preload expõe e chama.
const exposto: Record<string, unknown> = {};
const invoke = vi.fn(async (canal: string, dados?: unknown) => ({ canal, dados }));
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (nome: string, valor: unknown) => (exposto[nome] = valor)
  },
  ipcRenderer: { invoke }
}));

await import('../../src/preload/preload');
const api = exposto['api'] as Record<string, Record<string, (dados?: unknown) => Promise<unknown>>>;

describe('preload', () => {
  it('expõe só `window.api`', () => {
    expect(Object.keys(exposto)).toEqual(['api']);
  });

  it('tem uma função para cada canal, e cada uma chama o canal com o mesmo nome', async () => {
    const chamados: string[] = [];
    for (const [dominio, funcoes] of Object.entries(api)) {
      for (const [acao, funcao] of Object.entries(funcoes)) {
        expect(typeof funcao).toBe('function');
        await funcao({ teste: true });
        expect(invoke).toHaveBeenLastCalledWith(`${dominio}:${acao}`, { teste: true });
        chamados.push(`${dominio}:${acao}`);
      }
    }
    expect(chamados.sort()).toEqual([...TODOS_OS_CANAIS].sort());
  });

  it('não expõe o ipcRenderer nem nada além de funções', () => {
    for (const funcoes of Object.values(api)) {
      for (const valor of Object.values(funcoes)) expect(typeof valor).toBe('function');
    }
    expect(JSON.stringify(Object.keys(api))).not.toContain('ipcRenderer');
  });
});
