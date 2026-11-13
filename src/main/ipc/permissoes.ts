import type { CanalIpc } from '@shared/ipc-channels';

/**
 * Quem pode usar cada canal (coluna "Quem pode" da proposta, seção 6):
 * - PUBLICO: qualquer um, mesmo sem login (ex.: a própria tela de login);
 * - LOGADO: qualquer usuário logado (ADMIN ou FUNCIONARIO);
 * - ADMIN: só administradores.
 *
 * A checagem é feita no Main, antes do handler rodar — esconder o botão na tela não basta.
 */
export type QuemPode = 'PUBLICO' | 'LOGADO' | 'ADMIN';

/**
 * Permissão de cada canal. Por ser um `Record<CanalIpc, ...>`, o TypeScript
 * dá erro se um canal novo for criado em `ipc-channels.ts` e esquecido aqui.
 */
export const PERMISSOES: Record<CanalIpc, QuemPode> = {
  // app (tela inicial, antes do login)
  'app:info': 'PUBLICO',
  'app:statusBanco': 'PUBLICO',

  // auth
  'auth:login': 'PUBLICO',
  'auth:logout': 'LOGADO',
  'auth:sessaoAtual': 'PUBLICO', // responde null quando ninguém está logado
  'auth:alterarSenha': 'LOGADO',

  // usuarios — tudo só ADMIN
  'usuarios:criar': 'ADMIN',
  'usuarios:listar': 'ADMIN',
  'usuarios:buscarPorId': 'ADMIN',
  'usuarios:atualizar': 'ADMIN',
  'usuarios:excluir': 'ADMIN',

  // clientes
  'clientes:criar': 'LOGADO',
  'clientes:listar': 'LOGADO',
  'clientes:buscarPorId': 'LOGADO',
  'clientes:atualizar': 'LOGADO',
  'clientes:excluir': 'ADMIN',
  'clientes:historico': 'LOGADO',

  // categorias
  'categorias:criar': 'ADMIN',
  'categorias:listar': 'LOGADO',
  'categorias:buscarPorId': 'LOGADO',
  'categorias:atualizar': 'ADMIN',
  'categorias:excluir': 'ADMIN',

  // fornecedores
  'fornecedores:criar': 'ADMIN',
  'fornecedores:listar': 'LOGADO',
  'fornecedores:listarPorTipo': 'LOGADO',
  'fornecedores:buscarPorId': 'LOGADO',
  'fornecedores:atualizar': 'ADMIN',
  'fornecedores:excluir': 'ADMIN',

  // equipamentos
  'equipamentos:criar': 'ADMIN',
  'equipamentos:listar': 'LOGADO',
  'equipamentos:buscarPorId': 'LOGADO',
  'equipamentos:atualizar': 'ADMIN',
  'equipamentos:excluir': 'ADMIN',
  'equipamentos:verificarDisponibilidade': 'LOGADO',
  'equipamentos:listarDisponiveis': 'LOGADO',
  'equipamentos:alterarStatus': 'ADMIN',

  // reservas (inclui a devolução)
  'reservas:criar': 'LOGADO',
  'reservas:listar': 'LOGADO',
  'reservas:buscarPorId': 'LOGADO',
  'reservas:atualizar': 'LOGADO',
  'reservas:excluir': 'ADMIN',
  'reservas:confirmarRetirada': 'LOGADO',
  'reservas:cancelar': 'LOGADO',
  'reservas:listarAtivas': 'LOGADO',
  'reservas:listarAtrasadas': 'LOGADO',
  'reservas:registrarDevolucao': 'LOGADO',

  // itens da reserva
  'itensReserva:criar': 'LOGADO',
  'itensReserva:listarPorReserva': 'LOGADO',
  'itensReserva:buscarPorId': 'LOGADO',
  'itensReserva:atualizar': 'LOGADO',
  'itensReserva:excluir': 'LOGADO',

  // multas
  'multas:calcular': 'LOGADO',
  'multas:criar': 'ADMIN',
  'multas:listar': 'LOGADO',
  'multas:listarEmAberto': 'LOGADO',
  'multas:buscarPorId': 'LOGADO',
  'multas:atualizar': 'ADMIN',
  'multas:excluir': 'ADMIN',
  'multas:quitar': 'LOGADO',

  // manutencoes
  'manutencoes:criar': 'LOGADO',
  'manutencoes:listar': 'LOGADO',
  'manutencoes:listarAbertas': 'LOGADO',
  'manutencoes:listarPorEquipamento': 'LOGADO',
  'manutencoes:buscarPorId': 'LOGADO',
  'manutencoes:atualizar': 'ADMIN',
  'manutencoes:registrarRetorno': 'LOGADO',
  'manutencoes:excluir': 'ADMIN',

  // pagamentos
  'pagamentos:criar': 'LOGADO',
  'pagamentos:listar': 'LOGADO',
  'pagamentos:listarPorReserva': 'LOGADO',
  'pagamentos:buscarPorId': 'LOGADO',
  'pagamentos:atualizar': 'ADMIN',
  'pagamentos:excluir': 'ADMIN',
  'pagamentos:devolverCaucao': 'LOGADO',

  // integracoes (APIs externas)
  'integracoes:buscarCep': 'LOGADO',
  'integracoes:previsaoClima': 'LOGADO',
  'integracoes:calcularRota': 'LOGADO',

  // notificacoes (nossa API)
  'notificacoes:enviarLembrete': 'LOGADO',
  'notificacoes:enviarAvisoMulta': 'LOGADO',

  // dashboard
  'dashboard:resumo': 'LOGADO'
};
