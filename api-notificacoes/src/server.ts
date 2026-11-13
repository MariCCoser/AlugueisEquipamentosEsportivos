/* eslint-disable no-console -- programa de terminal: o console é a saída dele */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { criarApp } from './app';
import { MensageiroSimulado } from './Mensageiro';

/**
 * Liga a API de notificações: `npm run api:notificacoes`.
 * Lê a porta e a chave do mesmo .env do projeto.
 */
dotenv.config({ path: resolve(process.cwd(), '.env') });

const chave = process.env['NOTIFICACOES_CHAVE']?.trim();
if (!chave || chave.length < 16) {
  console.error('✖ Defina NOTIFICACOES_CHAVE no .env (pelo menos 16 caracteres).');
  process.exit(1);
}

const url = new URL(process.env['NOTIFICACOES_URL'] ?? 'http://127.0.0.1:3333');
const porta = Number(url.port || 3333);
// Só aceita conexões da própria máquina: ninguém da rede consegue chamar a API.
const HOST = '127.0.0.1';

const mensageiro = new MensageiroSimulado();
const app = criarApp({ chave, mensageiro, historico: mensageiro });

app.listen(porta, HOST, (erro?: Error) => {
  if (erro) {
    console.error(`✖ Não consegui abrir a porta ${porta}: ${erro.message}`);
    process.exit(1);
  }
  console.log(`✔ API de notificações no ar em http://${HOST}:${porta} (envios simulados)`);
});
