import { describe, expect, it, vi } from 'vitest';
import { IntegracaoError } from '../../../src/main/errors/ErroApp';
import { CacheMemoria } from '../../../src/main/integrations/CacheMemoria';
import { ClienteHttp } from '../../../src/main/integrations/ClienteHttp';
import { fetchFalso, respostaJson } from './apoio';

function cliente(buscar: ReturnType<typeof fetchFalso>, tempoLimiteMs = 1000) {
  return new ClienteHttp({
    nome: 'o serviço de teste',
    dica: 'Tente de novo.',
    cabecalhos: { 'User-Agent': 'teste' },
    tempoLimiteMs,
    buscar
  });
}

describe('ClienteHttp.obterJson', () => {
  it('devolve o JSON e manda os cabeçalhos configurados', async () => {
    const buscar = fetchFalso(respostaJson({ ok: 1 }));
    expect(await cliente(buscar).obterJson('https://api.teste/x')).toEqual({ ok: 1 });
    const opcoes = buscar.mock.calls[0]?.[1];
    expect(opcoes?.headers).toMatchObject({ 'User-Agent': 'teste', Accept: 'application/json' });
    expect(opcoes?.signal).toBeInstanceOf(AbortSignal);
  });

  it('sem internet vira IntegracaoError com mensagem amigável', async () => {
    const buscar = fetchFalso(() => Promise.reject(new TypeError('fetch failed')));
    const erro = await cliente(buscar)
      .obterJson('https://api.teste/x')
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(IntegracaoError);
    expect((erro as Error).message).toBe(
      'Não foi possível falar com o serviço de teste. Confira a internet. Tente de novo.'
    );
  });

  it('desiste depois do tempo limite (AbortController)', async () => {
    vi.useFakeTimers();
    try {
      const buscar = vi.fn(
        (_url: string | URL | Request, opcoes?: RequestInit) =>
          new Promise<Response>((_, rejeitar) => {
            opcoes?.signal?.addEventListener('abort', () => rejeitar(new Error('abortado')));
          })
      );
      const http = new ClienteHttp({ nome: 'o serviço de teste', tempoLimiteMs: 500, buscar });
      const pedido = http.obterJson('https://api.teste/lento').catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(500);
      expect(((await pedido) as Error).message).toBe(
        'O serviço de teste demorou demais para responder.'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('limite de uso (429) e erro do servidor viram mensagens diferentes', async () => {
    const buscar = fetchFalso(respostaJson({ reason: 'limit' }, 429), respostaJson({}, 503));
    const http = cliente(buscar);
    await expect(http.obterJson('https://api.teste/x')).rejects.toThrow(/consultas demais/);
    await expect(http.obterJson('https://api.teste/x')).rejects.toThrow(/código 503/);
  });

  it('resposta que não é JSON vira "resposta inválida"', async () => {
    const buscar = fetchFalso(new Response('<html>', { status: 200 }));
    await expect(cliente(buscar).obterJson('https://api.teste/x')).rejects.toThrow(
      /resposta inválida/
    );
  });
});

describe('CacheMemoria', () => {
  it('guarda até vencer a validade', () => {
    const relogio = { agora: 0 };
    const cache = new CacheMemoria<string>(1000, 10, () => relogio.agora);
    cache.guardar('a', 'valor');
    relogio.agora = 999;
    expect(cache.obter('a')).toBe('valor');
    relogio.agora = 1000;
    expect(cache.obter('a')).toBeUndefined();
  });

  it('respeita o limite de itens descartando o mais antigo', () => {
    const cache = new CacheMemoria<number>(10_000, 2);
    cache.guardar('a', 1);
    cache.guardar('b', 2);
    cache.guardar('c', 3);
    expect(cache.obter('a')).toBeUndefined();
    expect(cache.obter('c')).toBe(3);
    expect(cache.tamanho).toBe(2);
  });

  it('obterOuBuscar só chama a API na primeira vez e não guarda erros', async () => {
    const cache = new CacheMemoria<number>(10_000);
    const buscar = vi.fn(async () => 42);
    expect(await cache.obterOuBuscar('x', buscar)).toBe(42);
    expect(await cache.obterOuBuscar('x', buscar)).toBe(42);
    expect(buscar).toHaveBeenCalledTimes(1);

    await expect(
      cache.obterOuBuscar('y', () => Promise.reject(new Error('falhou')))
    ).rejects.toThrow();
    expect(cache.obter('y')).toBeUndefined();
  });
});
