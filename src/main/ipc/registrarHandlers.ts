import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { TODOS_OS_CANAIS, type CanalIpc } from '@shared/ipc-channels';
import { falha, type Resposta } from '@shared/dto/resposta';
import type { Perfil } from '@shared/models/enums';
import { PERMISSOES } from './permissoes';

/**
 * Função que atende um canal.
 * `entrada` é `unknown` de propósito: veio da tela, então ainda não é confiável —
 * o handler precisa validar antes de usar (ex.: com zod).
 */
export type Handler<T = unknown> = (
  entrada: unknown,
  evento: IpcMainInvokeEvent
) => Promise<Resposta<T>>;

/** O que o registro precisa saber para decidir se uma chamada pode passar. */
export interface Guarda {
  /** A chamada veio da nossa própria tela? */
  origemConfiavel(url: string): boolean;
  /** Perfil de quem está logado (`null` = ninguém). */
  perfilAtual(): Perfil | null;
}

/**
 * Registro central dos canais IPC.
 *
 * Como usar (no main.ts):
 * ```ts
 * const registro = new RegistroIpc(guarda);
 * registrarAppIpc(registro, ...);        // cada domínio registra os seus handlers
 * registrarClientesIpc(registro, ...);
 * registro.ativar();                     // liga TODOS os canais no Electron
 * ```
 *
 * Toda chamada passa, nesta ordem, por:
 * 1. origem: só a nossa tela pode chamar;
 * 2. permissão: PUBLICO / LOGADO / ADMIN (ver permissoes.ts);
 * 3. handler do domínio — ou "ainda não implementado", se ninguém registrou;
 * 4. try/catch: um erro inesperado vira mensagem amigável, sem mostrar detalhes técnicos.
 */
export class RegistroIpc {
  private readonly handlers = new Map<CanalIpc, Handler>();
  private ativado = false;

  constructor(private readonly guarda: Guarda) {}

  /** Diz qual função atende o canal. Cada canal só pode ter um handler. */
  registrar<T>(canal: CanalIpc, handler: Handler<T>): void {
    if (this.ativado) {
      throw new Error(`Registre o canal ${canal} antes de chamar ativar().`);
    }
    if (this.handlers.has(canal)) {
      throw new Error(`O canal ${canal} foi registrado duas vezes.`);
    }
    this.handlers.set(canal, handler as Handler);
  }

  /** Canais que ainda não têm handler (útil para acompanhar o andamento do grupo). */
  canaisPendentes(): CanalIpc[] {
    return TODOS_OS_CANAIS.filter((canal) => !this.handlers.has(canal));
  }

  /** Liga todos os canais no Electron. Chame uma vez só, depois de registrar os domínios. */
  ativar(): void {
    if (this.ativado) return;
    this.ativado = true;
    for (const canal of TODOS_OS_CANAIS) {
      ipcMain.handle(canal, (evento, entrada: unknown) => this.atender(canal, evento, entrada));
    }
  }

  /** Atende uma chamada da tela. Público para poder ser testado sem abrir o Electron. */
  async atender(
    canal: CanalIpc,
    evento: IpcMainInvokeEvent,
    entrada: unknown
  ): Promise<Resposta<unknown>> {
    const urlDaTela = evento.senderFrame?.url ?? '';
    if (!this.guarda.origemConfiavel(urlDaTela)) {
      return falha('NAO_AUTORIZADO', 'Origem da requisição não permitida.');
    }

    const recusa = this.verificarPermissao(canal);
    if (recusa) return recusa;

    const handler = this.handlers.get(canal);
    if (!handler) {
      return falha('INTERNO', 'Esta função ainda não foi implementada.');
    }

    try {
      return await handler(entrada, evento);
    } catch (erro) {
      // O detalhe vai só para o terminal; a tela recebe uma mensagem genérica.
      console.error(`[IPC ${canal}]`, erro);
      return falha('INTERNO', 'Erro inesperado. Tente novamente.');
    }
  }

  /** Devolve a resposta de recusa, ou `null` se a pessoa pode usar o canal. */
  private verificarPermissao(canal: CanalIpc): Resposta<never> | null {
    const quemPode = PERMISSOES[canal];
    if (quemPode === 'PUBLICO') return null;

    const perfil = this.guarda.perfilAtual();
    if (!perfil) {
      return falha('NAO_AUTORIZADO', 'Faça login para continuar.');
    }
    if (quemPode === 'ADMIN' && perfil !== 'ADMIN') {
      return falha('NAO_AUTORIZADO', 'Somente administradores podem fazer isso.');
    }
    return null;
  }
}
