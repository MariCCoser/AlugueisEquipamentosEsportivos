/**
 * Todos os canais IPC do sistema, no padrão `dominio:acao`.
 * Main (ipcMain.handle) e preload (ipcRenderer.invoke) importam daqui,
 * então um nome de canal nunca é digitado como string solta.
 *
 * Novos domínios (auth, clientes, reservas...) entram aqui conforme
 * forem implementados — ver docs/Proposta_Arquitetura_e_Banco.md, seção 6.
 */
export const IPC = {
  app: {
    info: 'app:info',
    statusBanco: 'app:statusBanco'
  }
} as const;

type Valores<T> = T extends string ? T : { [K in keyof T]: Valores<T[K]> }[keyof T];

/** União de todos os nomes de canal válidos. */
export type CanalIpc = Valores<typeof IPC>;
