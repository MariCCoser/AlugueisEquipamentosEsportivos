import type { ApiExposta } from '@shared/api';
import type { ErroDTO, Resposta } from '@shared/dto/resposta';
import { simularCategorias } from './simulacoes/categorias';
import { simularClientes, simularIntegracoes } from './simulacoes/clientes';
import { simularDashboard } from './simulacoes/dashboard';
import { simularEquipamentos } from './simulacoes/equipamentos';
import { simularFornecedores } from './simulacoes/fornecedores';
import { simularAuth, simularUsuarios } from './simulacoes/usuarios';

/**
 * window.api FALSO, usado só em desenvolvimento quando a tela é aberta
 * num navegador comum (sem Electron/preload). Permite trabalhar nas telas
 * antes de os canais das outras pessoas ficarem prontos.
 *
 * Nunca entra no app instalado: o main.ts só importa este arquivo quando
 * `import.meta.env.DEV` é verdadeiro e o preload não existe.
 *
 * Para simular um domínio, acrescente-o em `respostas`. Para simular um erro,
 * a função lança `new ErroSimulado({ codigo, mensagem, campos })`.
 */
export type Simulacao = Record<string, (...args: never[]) => unknown>;

export class ErroSimulado extends Error {
  constructor(readonly erro: ErroDTO) {
    super(erro.mensagem);
  }
}

const respostas: Partial<Record<string, Simulacao>> = {
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
  },
  categorias: simularCategorias(),
  fornecedores: simularFornecedores(),
  dashboard: simularDashboard(),
  equipamentos: simularEquipamentos(),
  clientes: simularClientes(),
  integracoes: simularIntegracoes(),
  auth: simularAuth(),
  usuarios: simularUsuarios()
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
            async (...args: never[]): Promise<Resposta<unknown>> => {
              await new Promise((r) => setTimeout(r, 300)); // simula a ida e volta do IPC
              const simular = respostas[dominio]?.[metodo];
              if (!simular) return naoSimulado(dominio, metodo);
              try {
                // structuredClone imita o IPC: a tela recebe uma cópia, nunca o objeto guardado.
                return { ok: true, dados: structuredClone(simular(...args)) };
              } catch (erro) {
                if (erro instanceof ErroSimulado) return { ok: false, erro: erro.erro };
                throw erro;
              }
            }
        }
      )
  });
}
