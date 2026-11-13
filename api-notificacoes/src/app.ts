import { timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Mensageiro, MensageiroSimulado } from './Mensageiro';
import { textoAvisoMulta, textoLembrete } from './mensagens';
import { PedidoInvalidoError, validarPedidoAvisoMulta, validarPedidoLembrete } from './validacao';

export interface OpcoesApp {
  /** Chave que o app precisa mandar no cabeçalho `Authorization: Bearer <chave>`. */
  chave: string;
  mensageiro: Mensageiro;
  /** Se for o simulado, a rota GET /notificacoes mostra o que foi enviado. */
  historico?: MensageiroSimulado;
}

/** Compara a chave em tempo constante (não dá para "adivinhar" pela demora da resposta). */
function chaveCorreta(recebida: string, esperada: string): boolean {
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Monta a API (sem ligar o servidor — isso fica no server.ts).
 *
 * Rotas:
 * - GET  /saude                          -> a API está no ar? (sem chave)
 * - POST /notificacoes/lembrete-devolucao -> lembra o cliente da devolução
 * - POST /notificacoes/aviso-multa        -> avisa o cliente da multa
 * - GET  /notificacoes                    -> últimas enviadas (só no modo simulado)
 */
export function criarApp({ chave, mensageiro, historico }: OpcoesApp): express.Express {
  const app = express();
  app.disable('x-powered-by'); // não conta para ninguém que é Express
  app.use(express.json({ limit: '10kb' }));

  app.get('/saude', (_req, res) => {
    res.json({ ok: true });
  });

  // Daqui para baixo, toda rota exige a chave.
  app.use((req, res, next) => {
    const cabecalho = req.get('authorization') ?? '';
    const recebida = cabecalho.startsWith('Bearer ') ? cabecalho.slice('Bearer '.length) : '';
    if (!chaveCorreta(recebida, chave)) {
      res.status(401).json({ erro: 'Chave de acesso inválida.' });
      return;
    }
    next();
  });

  app.post('/notificacoes/lembrete-devolucao', async (req, res) => {
    const pedido = validarPedidoLembrete(req.body);
    const notificacao = await mensageiro.enviar({
      tipo: 'LEMBRETE_DEVOLUCAO',
      destinatario: pedido.cliente,
      mensagem: textoLembrete(pedido)
    });
    res.status(201).json(notificacao);
  });

  app.post('/notificacoes/aviso-multa', async (req, res) => {
    const pedido = validarPedidoAvisoMulta(req.body);
    const notificacao = await mensageiro.enviar({
      tipo: 'AVISO_MULTA',
      destinatario: pedido.cliente,
      mensagem: textoAvisoMulta(pedido)
    });
    res.status(201).json(notificacao);
  });

  app.get('/notificacoes', (_req, res) => {
    res.json(historico?.historico() ?? []);
  });

  app.use((_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
  });

  // Tratamento de erros: dado inválido -> 400; o resto -> 500 sem detalhes técnicos.
  // O Express só reconhece o tratador de erros se ele tiver os 4 parâmetros.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (erro instanceof PedidoInvalidoError) {
      res.status(400).json({ erro: erro.message });
      return;
    }
    const status = (erro as { status?: number }).status;
    if (status === 400 || status === 413) {
      // JSON malformado ou corpo grande demais (vem do express.json)
      res.status(status).json({ erro: status === 413 ? 'Corpo grande demais.' : 'JSON inválido.' });
      return;
    }
    console.error('[api-notificacoes]', erro);
    res.status(500).json({ erro: 'Erro inesperado na API de notificações.' });
  });

  return app;
}
