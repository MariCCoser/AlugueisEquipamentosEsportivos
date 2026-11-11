import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { ApiExposta } from '@shared/api';

/**
 * Única ponte entre Renderer e Main. Expõe funções específicas por canal,
 * nunca o ipcRenderer inteiro.
 */
const api: ApiExposta = {
  app: {
    info: () => ipcRenderer.invoke(IPC.app.info),
    statusBanco: () => ipcRenderer.invoke(IPC.app.statusBanco)
  }
};

contextBridge.exposeInMainWorld('api', api);
