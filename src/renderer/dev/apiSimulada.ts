import type { ApiExposta } from '@shared/api';
import type { Resposta } from '@shared/dto/resposta';

/**
 * window.api FALSO, usado só em desenvolvimento quando a tela é aberta
 * num navegador comum (sem Electron/preload). Permite trabalhar nas telas
 * antes de os canais das outras pessoas ficarem prontos.
 *
 * Nunca entra no app instalado: o main.ts só importa este arquivo quando
 * `import.meta.env.DEV` é verdadeiro e o preload não existe.
 *
 * Para simular um domínio, acrescente-o em `respostas` com dados fixos.
 */
const respostas: Partial<Record<string, Record<string, (...args: unknown[]) => unknown>>> = {
  app: {
    info: () => ({
      nome: 'Locadora Esportiva',
      versao: '0.1.0',
      electron: '—',
      plataforma: 'navegador'
    }),
    statusBanco: () => ({
      conectado: true,
      banco: 'simulado',
      tabelas: [
        { tabela: 'categorias', registros: 5 },
        { tabela: 'equipamentos', registros: 18 },
        { tabela: 'clientes', registros: 7 },
        { tabela: 'reservas', registros: 4 }
      ]
    })
  }
};

function naoSimulado<T>(dominio: string, metodo: string): Resposta<T> {
  return {
    ok: false,
    erro: {
      codigo: 'INTERNO',
      mensagem: `Modo simulado: ${dominio}.${metodo} ainda não tem dados de exemplo.`
    }
  };
}

export function criarApiSimulada(): ApiExposta {
  // Proxy: qualquer window.api.<dominio>.<metodo>() responde, mesmo sem simulação definida.
  return new Proxy({} as ApiExposta, {
    get: (_alvo, dominio: string) =>
      new Proxy(
        {},
        {
          get:
            (_a, metodo: string) =>
            async (...args: unknown[]) => {
              await new Promise((r) => setTimeout(r, 300)); // simula a ida e volta do IPC
              const simular = respostas[dominio]?.[metodo];
              return simular ? { ok: true, dados: simular(...args) } : naoSimulado(dominio, metodo);
            }
        }
      )
  });
}
