import { vi } from 'vitest';
import type { FuncaoFetch } from '../../../src/main/integrations/ClienteHttp';

/** Resposta HTTP de mentira com corpo JSON. */
export function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * `fetch` de mentira: cada chamada devolve a próxima resposta da lista
 * (ou executa a função, para simular erro de rede).
 */
export function fetchFalso(...respostas: (Response | (() => Promise<Response>))[]) {
  const fila = [...respostas];
  return vi.fn<FuncaoFetch>(async () => {
    const proxima = fila.shift();
    if (!proxima) throw new Error('fetchFalso: nenhuma resposta sobrando');
    return typeof proxima === 'function' ? proxima() : proxima;
  });
}

/** URL pedida na chamada `n` (começa em 0) do fetch de mentira. */
export function urlDaChamada(buscar: ReturnType<typeof fetchFalso>, n = 0): URL {
  return new URL(String(buscar.mock.calls[n]?.[0]));
}
