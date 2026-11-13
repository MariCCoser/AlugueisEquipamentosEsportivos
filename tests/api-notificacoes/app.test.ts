import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NotificacaoDTO } from '../../src/shared/dto/notificacao.dto';
import { criarApp } from '../../api-notificacoes/src/app';
import { MensageiroSimulado } from '../../api-notificacoes/src/Mensageiro';

const CHAVE = 'chave-de-teste-com-mais-de-16';
const mostradas: string[] = [];
const mensageiro = new MensageiroSimulado(100, (texto) => mostradas.push(texto));
let servidor: Server;
let base: string;

beforeAll(async () => {
  const app = criarApp({ chave: CHAVE, mensageiro, historico: mensageiro });
  servidor = await new Promise<Server>((pronto) => {
    const s = app.listen(0, '127.0.0.1', () => pronto(s)); // porta 0 = qualquer porta livre
  });
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((fim) => servidor.close(() => fim())));

/** Faz um POST com a chave certa (ou outra, se passada). */
function postar(caminho: string, corpo: unknown, chave = CHAVE) {
  return fetch(`${base}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
  });
}

const ana = { nome: 'Ana Souza', email: 'ana@email.com', telefone: '11987654321' };
const lembrete = {
  cliente: ana,
  reservaId: 3,
  dataDevolucaoPrevista: '2026-11-20',
  equipamentos: ['Caiaque Duplo', 'Remo', 'Colete']
};

describe('API de notificações', () => {
  it('GET /saude responde sem precisar de chave', async () => {
    const resposta = await fetch(`${base}/saude`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
    expect(resposta.headers.get('x-powered-by')).toBeNull();
  });

  it('recusa sem chave ou com chave errada (401)', async () => {
    expect((await postar('/notificacoes/lembrete-devolucao', lembrete, '')).status).toBe(401);
    expect((await postar('/notificacoes/lembrete-devolucao', lembrete, 'errada')).status).toBe(401);
    expect((await fetch(`${base}/notificacoes`)).status).toBe(401);
  });

  it('envia lembrete por e-mail quando o cliente tem e-mail', async () => {
    const resposta = await postar('/notificacoes/lembrete-devolucao', lembrete);
    expect(resposta.status).toBe(201);
    const notificacao = (await resposta.json()) as NotificacaoDTO;
    expect(notificacao).toMatchObject({
      tipo: 'LEMBRETE_DEVOLUCAO',
      canal: 'EMAIL',
      destinatario: 'ana@email.com',
      simulada: true
    });
    expect(notificacao.mensagem).toBe(
      'Olá, Ana! Lembramos que a devolução da reserva nº 3 (Caiaque Duplo, Remo e Colete) ' +
        'está prevista para 20/11/2026. Devoluções em atraso geram multa. Obrigado!'
    );
    expect(mostradas.at(-1)).toContain('[EMAIL simulado] para ana@email.com');
  });

  it('usa WhatsApp quando o cliente não tem e-mail', async () => {
    const semEmail = { ...lembrete, cliente: { nome: 'Carla', telefone: '41991234567' } };
    const resposta = await postar('/notificacoes/lembrete-devolucao', semEmail);
    const notificacao = (await resposta.json()) as NotificacaoDTO;
    expect(notificacao.canal).toBe('WHATSAPP');
    expect(notificacao.destinatario).toBe('41991234567');
  });

  it('envia aviso de multa com o valor em reais', async () => {
    const resposta = await postar('/notificacoes/aviso-multa', {
      cliente: ana,
      multaId: 1,
      reservaId: 2,
      diasAtraso: 2,
      valor: 24
    });
    expect(resposta.status).toBe(201);
    const notificacao = (await resposta.json()) as NotificacaoDTO;
    expect(notificacao.tipo).toBe('AVISO_MULTA');
    expect(notificacao.mensagem).toContain('com 2 dias de atraso');
    expect(notificacao.mensagem).toContain('multa de R$ 24,00');
  });

  it('GET /notificacoes mostra as enviadas, mais recentes primeiro', async () => {
    const resposta = await fetch(`${base}/notificacoes`, {
      headers: { Authorization: `Bearer ${CHAVE}` }
    });
    const lista = (await resposta.json()) as NotificacaoDTO[];
    expect(lista.length).toBeGreaterThanOrEqual(3);
    expect(lista[0].tipo).toBe('AVISO_MULTA');
  });

  it('dados inválidos respondem 400 com explicação', async () => {
    const casos: [unknown, string][] = [
      [{ ...lembrete, reservaId: 0 }, '"reservaId"'],
      [{ ...lembrete, dataDevolucaoPrevista: '20/11/2026' }, 'AAAA-MM-DD'],
      [{ ...lembrete, equipamentos: [] }, '"equipamentos"'],
      [{ ...lembrete, cliente: { ...ana, telefone: '(11) 9876' } }, 'telefone'],
      [{ ...lembrete, cliente: { ...ana, email: 'sem-arroba' } }, 'e-mail'],
      [{ ...lembrete, cliente: undefined }, '"cliente"']
    ];
    for (const [corpo, trecho] of casos) {
      const resposta = await postar('/notificacoes/lembrete-devolucao', corpo);
      expect(resposta.status).toBe(400);
      const resultado = (await resposta.json()) as { erro: string };
      expect(resultado.erro).toContain(trecho);
    }
  });

  it('JSON quebrado responde 400 e corpo grande demais responde 413', async () => {
    expect((await postar('/notificacoes/aviso-multa', '{ quebrado')).status).toBe(400);
    const enorme = { ...lembrete, equipamentos: ['x'.repeat(20_000)] };
    expect((await postar('/notificacoes/lembrete-devolucao', enorme)).status).toBe(413);
  });

  it('rota desconhecida responde 404', async () => {
    expect((await postar('/nao-existe', {})).status).toBe(404);
  });
});
