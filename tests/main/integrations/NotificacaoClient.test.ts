import { describe, expect, it, vi } from 'vitest';
import type { PedidoLembreteDTO } from '../../../src/shared/dto/notificacao.dto';
import { IntegracaoError } from '../../../src/main/errors/ErroApp';
import {
  NotificacaoClient,
  type FuncaoFetch
} from '../../../src/main/integrations/NotificacaoClient';

const config = { url: 'http://127.0.0.1:3333', chave: 'chave-secreta-123456', tempoLimiteMs: 50 };

const pedido: PedidoLembreteDTO = {
  cliente: { nome: 'Ana', telefone: '11987654321' },
  reservaId: 3,
  dataDevolucaoPrevista: '2026-11-20',
  equipamentos: ['Caiaque']
};

/** Um "fetch" de mentira que sempre devolve a resposta indicada. */
function fetchQueResponde(status: number, corpo: unknown) {
  return vi.fn<FuncaoFetch>(async () => new Response(JSON.stringify(corpo), { status }));
}

describe('NotificacaoClient', () => {
  it('manda POST com a chave e o pedido, e devolve a notificação', async () => {
    const notificacao = { id: 'abc', tipo: 'LEMBRETE_DEVOLUCAO', canal: 'WHATSAPP' };
    const buscar = fetchQueResponde(201, notificacao);

    const resultado = await new NotificacaoClient(config, buscar).enviarLembrete(pedido);

    expect(resultado).toEqual(notificacao);
    const [url, opcoes] = buscar.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:3333/notificacoes/lembrete-devolucao');
    expect(opcoes?.method).toBe('POST');
    expect((opcoes?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer chave-secreta-123456'
    );
    expect(JSON.parse(String(opcoes?.body))).toEqual(pedido);
  });

  it('aviso de multa vai para a rota certa', async () => {
    const buscar = fetchQueResponde(201, {});
    await new NotificacaoClient(config, buscar).enviarAvisoMulta({
      cliente: pedido.cliente,
      multaId: 1,
      reservaId: 2,
      diasAtraso: 2,
      valor: 24
    });
    expect(buscar.mock.calls[0]![0]).toBe('http://127.0.0.1:3333/notificacoes/aviso-multa');
  });

  it('API desligada vira mensagem amigável', async () => {
    const buscar = vi.fn<FuncaoFetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(new NotificacaoClient(config, buscar).enviarLembrete(pedido)).rejects.toThrow(
      'Ela está ligada?'
    );
  });

  it('API que demora demais é abandonada', async () => {
    // Fica "pendurado" até o tempo limite cancelar o pedido
    const buscar = vi.fn<FuncaoFetch>(
      (_url, opcoes) =>
        new Promise((_, falhar) =>
          opcoes?.signal?.addEventListener('abort', () => falhar(opcoes.signal!.reason))
        )
    );
    const erro = await new NotificacaoClient(config, buscar).enviarLembrete(pedido).catch((e) => e);
    expect(erro).toBeInstanceOf(IntegracaoError);
    expect(erro.message).toContain('demorou demais');
  });

  it('explica chave recusada, dado recusado e outros erros', async () => {
    const tentar = (status: number, corpo: unknown) =>
      new NotificacaoClient(config, fetchQueResponde(status, corpo)).enviarLembrete(pedido);

    await expect(tentar(401, { erro: 'x' })).rejects.toThrow('NOTIFICACOES_CHAVE');
    await expect(tentar(400, { erro: '"reservaId" inválido' })).rejects.toThrow(
      'recusou os dados: "reservaId" inválido'
    );
    await expect(tentar(500, { erro: 'x' })).rejects.toThrow('código 500');
    await expect(tentar(500, { erro: 'x' })).rejects.toMatchObject({ codigo: 'INTEGRACAO' });
  });
});
