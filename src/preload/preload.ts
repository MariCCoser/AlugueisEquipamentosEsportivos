import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CanalIpc } from '@shared/ipc-channels';
import type { ApiExposta } from '@shared/api';

/**
 * Cria a função que a tela chama para usar um canal.
 * A tela só consegue usar os canais listados abaixo — o `ipcRenderer` em si nunca é exposto.
 */
function chamar(canal: CanalIpc) {
  return (dados?: unknown) => ipcRenderer.invoke(canal, dados);
}

/** Única ponte entre a tela (Renderer) e o sistema (Main). */
const api: ApiExposta = {
  app: {
    info: chamar(IPC.app.info),
    statusBanco: chamar(IPC.app.statusBanco)
  },

  auth: {
    login: chamar(IPC.auth.login),
    logout: chamar(IPC.auth.logout),
    sessaoAtual: chamar(IPC.auth.sessaoAtual),
    alterarSenha: chamar(IPC.auth.alterarSenha)
  },

  usuarios: {
    criar: chamar(IPC.usuarios.criar),
    listar: chamar(IPC.usuarios.listar),
    buscarPorId: chamar(IPC.usuarios.buscarPorId),
    atualizar: chamar(IPC.usuarios.atualizar),
    excluir: chamar(IPC.usuarios.excluir)
  },

  clientes: {
    criar: chamar(IPC.clientes.criar),
    listar: chamar(IPC.clientes.listar),
    buscarPorId: chamar(IPC.clientes.buscarPorId),
    atualizar: chamar(IPC.clientes.atualizar),
    excluir: chamar(IPC.clientes.excluir),
    historico: chamar(IPC.clientes.historico)
  },

  categorias: {
    criar: chamar(IPC.categorias.criar),
    listar: chamar(IPC.categorias.listar),
    buscarPorId: chamar(IPC.categorias.buscarPorId),
    atualizar: chamar(IPC.categorias.atualizar),
    excluir: chamar(IPC.categorias.excluir)
  },

  fornecedores: {
    criar: chamar(IPC.fornecedores.criar),
    listar: chamar(IPC.fornecedores.listar),
    listarPorTipo: chamar(IPC.fornecedores.listarPorTipo),
    buscarPorId: chamar(IPC.fornecedores.buscarPorId),
    atualizar: chamar(IPC.fornecedores.atualizar),
    excluir: chamar(IPC.fornecedores.excluir)
  },

  equipamentos: {
    criar: chamar(IPC.equipamentos.criar),
    listar: chamar(IPC.equipamentos.listar),
    buscarPorId: chamar(IPC.equipamentos.buscarPorId),
    atualizar: chamar(IPC.equipamentos.atualizar),
    excluir: chamar(IPC.equipamentos.excluir),
    verificarDisponibilidade: chamar(IPC.equipamentos.verificarDisponibilidade),
    listarDisponiveis: chamar(IPC.equipamentos.listarDisponiveis),
    alterarStatus: chamar(IPC.equipamentos.alterarStatus)
  },

  reservas: {
    criar: chamar(IPC.reservas.criar),
    listar: chamar(IPC.reservas.listar),
    buscarPorId: chamar(IPC.reservas.buscarPorId),
    atualizar: chamar(IPC.reservas.atualizar),
    excluir: chamar(IPC.reservas.excluir),
    confirmarRetirada: chamar(IPC.reservas.confirmarRetirada),
    cancelar: chamar(IPC.reservas.cancelar),
    listarAtivas: chamar(IPC.reservas.listarAtivas),
    listarAtrasadas: chamar(IPC.reservas.listarAtrasadas),
    registrarDevolucao: chamar(IPC.reservas.registrarDevolucao)
  },

  itensReserva: {
    criar: chamar(IPC.itensReserva.criar),
    listarPorReserva: chamar(IPC.itensReserva.listarPorReserva),
    buscarPorId: chamar(IPC.itensReserva.buscarPorId),
    atualizar: chamar(IPC.itensReserva.atualizar),
    excluir: chamar(IPC.itensReserva.excluir)
  },

  multas: {
    calcular: chamar(IPC.multas.calcular),
    criar: chamar(IPC.multas.criar),
    listar: chamar(IPC.multas.listar),
    listarEmAberto: chamar(IPC.multas.listarEmAberto),
    buscarPorId: chamar(IPC.multas.buscarPorId),
    atualizar: chamar(IPC.multas.atualizar),
    excluir: chamar(IPC.multas.excluir),
    quitar: chamar(IPC.multas.quitar)
  },

  manutencoes: {
    criar: chamar(IPC.manutencoes.criar),
    listar: chamar(IPC.manutencoes.listar),
    listarAbertas: chamar(IPC.manutencoes.listarAbertas),
    listarPorEquipamento: chamar(IPC.manutencoes.listarPorEquipamento),
    buscarPorId: chamar(IPC.manutencoes.buscarPorId),
    atualizar: chamar(IPC.manutencoes.atualizar),
    registrarRetorno: chamar(IPC.manutencoes.registrarRetorno),
    excluir: chamar(IPC.manutencoes.excluir)
  },

  pagamentos: {
    criar: chamar(IPC.pagamentos.criar),
    listar: chamar(IPC.pagamentos.listar),
    listarPorReserva: chamar(IPC.pagamentos.listarPorReserva),
    buscarPorId: chamar(IPC.pagamentos.buscarPorId),
    atualizar: chamar(IPC.pagamentos.atualizar),
    excluir: chamar(IPC.pagamentos.excluir),
    devolverCaucao: chamar(IPC.pagamentos.devolverCaucao)
  },

  integracoes: {
    buscarCep: chamar(IPC.integracoes.buscarCep),
    previsaoClima: chamar(IPC.integracoes.previsaoClima),
    calcularRota: chamar(IPC.integracoes.calcularRota)
  },

  notificacoes: {
    enviarLembrete: chamar(IPC.notificacoes.enviarLembrete),
    enviarAvisoMulta: chamar(IPC.notificacoes.enviarAvisoMulta)
  },

  dashboard: {
    resumo: chamar(IPC.dashboard.resumo)
  }
};

contextBridge.exposeInMainWorld('api', api);
