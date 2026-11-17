// Os estilos são carregados por <link> no index.html (ver comentário lá sobre a CSP).
import { App } from './App';

async function iniciar(): Promise<void> {
  const raiz = document.getElementById('app');
  if (!raiz) return;

  // Fora do Electron (navegador comum, só em desenvolvimento) usamos um window.api falso.
  const semPreload = !('api' in window);
  if (semPreload && import.meta.env.DEV) {
    const { criarApiSimulada } = await import('./dev/apiSimulada');
    Object.defineProperty(window, 'api', { value: criarApiSimulada() });
  }

  new App(raiz).iniciar(semPreload);
}

void iniciar();
