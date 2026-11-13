/**
 * Nomes de todos os canais IPC do sistema, no padrão `dominio:acao`.
 *
 * O Main (ipcMain.handle) e o preload (ipcRenderer.invoke) importam daqui,
 * então nenhum nome de canal é digitado "solto" — um erro de digitação vira erro de compilação.
 *
 * O que cada canal recebe e devolve está em `api.ts`; quem pode usar cada um,
 * em `src/main/ipc/permissoes.ts`. Lista completa: docs/Proposta_Arquitetura_e_Banco.md, seção 6.
 */
export const IPC = {
  /** Informações do próprio app (tela inicial). Não fazem parte dos 78 da proposta. */
  app: {
    info: 'app:info',
    statusBanco: 'app:statusBanco'
  },

  auth: {
    login: 'auth:login',
    logout: 'auth:logout',
    sessaoAtual: 'auth:sessaoAtual',
    alterarSenha: 'auth:alterarSenha'
  },

  usuarios: {
    criar: 'usuarios:criar',
    listar: 'usuarios:listar',
    buscarPorId: 'usuarios:buscarPorId',
    atualizar: 'usuarios:atualizar',
    excluir: 'usuarios:excluir'
  },

  clientes: {
    criar: 'clientes:criar',
    listar: 'clientes:listar',
    buscarPorId: 'clientes:buscarPorId',
    atualizar: 'clientes:atualizar',
    excluir: 'clientes:excluir',
    historico: 'clientes:historico'
  },

  categorias: {
    criar: 'categorias:criar',
    listar: 'categorias:listar',
    buscarPorId: 'categorias:buscarPorId',
    atualizar: 'categorias:atualizar',
    excluir: 'categorias:excluir'
  },

  fornecedores: {
    criar: 'fornecedores:criar',
    listar: 'fornecedores:listar',
    listarPorTipo: 'fornecedores:listarPorTipo',
    buscarPorId: 'fornecedores:buscarPorId',
    atualizar: 'fornecedores:atualizar',
    excluir: 'fornecedores:excluir'
  },

  equipamentos: {
    criar: 'equipamentos:criar',
    listar: 'equipamentos:listar',
    buscarPorId: 'equipamentos:buscarPorId',
    atualizar: 'equipamentos:atualizar',
    excluir: 'equipamentos:excluir',
    verificarDisponibilidade: 'equipamentos:verificarDisponibilidade',
    listarDisponiveis: 'equipamentos:listarDisponiveis',
    alterarStatus: 'equipamentos:alterarStatus'
  },

  reservas: {
    criar: 'reservas:criar',
    listar: 'reservas:listar',
    buscarPorId: 'reservas:buscarPorId',
    atualizar: 'reservas:atualizar',
    excluir: 'reservas:excluir',
    confirmarRetirada: 'reservas:confirmarRetirada',
    cancelar: 'reservas:cancelar',
    listarAtivas: 'reservas:listarAtivas',
    listarAtrasadas: 'reservas:listarAtrasadas',
    registrarDevolucao: 'reservas:registrarDevolucao'
  },

  itensReserva: {
    criar: 'itensReserva:criar',
    listarPorReserva: 'itensReserva:listarPorReserva',
    buscarPorId: 'itensReserva:buscarPorId',
    atualizar: 'itensReserva:atualizar',
    excluir: 'itensReserva:excluir'
  },

  multas: {
    calcular: 'multas:calcular',
    criar: 'multas:criar',
    listar: 'multas:listar',
    listarEmAberto: 'multas:listarEmAberto',
    buscarPorId: 'multas:buscarPorId',
    atualizar: 'multas:atualizar',
    excluir: 'multas:excluir',
    quitar: 'multas:quitar'
  },

  manutencoes: {
    criar: 'manutencoes:criar',
    listar: 'manutencoes:listar',
    listarAbertas: 'manutencoes:listarAbertas',
    listarPorEquipamento: 'manutencoes:listarPorEquipamento',
    buscarPorId: 'manutencoes:buscarPorId',
    atualizar: 'manutencoes:atualizar',
    registrarRetorno: 'manutencoes:registrarRetorno',
    excluir: 'manutencoes:excluir'
  },

  pagamentos: {
    criar: 'pagamentos:criar',
    listar: 'pagamentos:listar',
    listarPorReserva: 'pagamentos:listarPorReserva',
    buscarPorId: 'pagamentos:buscarPorId',
    atualizar: 'pagamentos:atualizar',
    excluir: 'pagamentos:excluir',
    devolverCaucao: 'pagamentos:devolverCaucao'
  },

  /** APIs externas 1, 2 e 3. */
  integracoes: {
    buscarCep: 'integracoes:buscarCep',
    previsaoClima: 'integracoes:previsaoClima',
    calcularRota: 'integracoes:calcularRota'
  },

  /** API 4 — a nossa API de notificações. */
  notificacoes: {
    enviarLembrete: 'notificacoes:enviarLembrete',
    enviarAvisoMulta: 'notificacoes:enviarAvisoMulta'
  },

  dashboard: {
    resumo: 'dashboard:resumo'
  }
} as const;

/** Nome de um domínio: 'clientes', 'reservas'... */
export type DominioIpc = keyof typeof IPC;

/** Qualquer nome de canal válido: 'clientes:criar', 'reservas:cancelar'... */
export type CanalIpc = {
  [Dominio in DominioIpc]: (typeof IPC)[Dominio][keyof (typeof IPC)[Dominio]];
}[DominioIpc];

/** Lista com todos os canais, para percorrer (registrar no Main, testar...). */
export const TODOS_OS_CANAIS: readonly CanalIpc[] = Object.values(IPC).flatMap(
  (dominio) => Object.values(dominio) as CanalIpc[]
);
