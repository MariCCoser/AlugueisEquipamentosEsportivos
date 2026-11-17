import { Layout, type ItemMenu } from './components/Layout';
import { NOME_APP, Roteador } from './nucleo/Roteador';
import type { DefinicaoRota } from './util/rotas';
import type { Tela } from './nucleo/Tela';
import { CategoriasTela } from './pages/categorias/CategoriasTela';
import { EmConstrucaoTela } from './pages/EmConstrucaoTela';
import { InicioTela } from './pages/InicioTela';

/** Itens do menu lateral, na ordem em que aparecem. */
const MENU: readonly ItemMenu[] = [
  { caminho: '/', rotulo: 'Painel' },
  { caminho: '/reservas/nova', rotulo: 'Nova reserva' },
  { caminho: '/devolucoes', rotulo: 'Devoluções' },
  { caminho: '/equipamentos', rotulo: 'Inventário' },
  { caminho: '/clientes', rotulo: 'Clientes' },
  { caminho: '/categorias', rotulo: 'Categorias' },
  { caminho: '/fornecedores', rotulo: 'Fornecedores' },
  { caminho: '/manutencoes', rotulo: 'Manutenções' },
  { caminho: '/pagamentos', rotulo: 'Pagamentos' },
  { caminho: '/usuarios', rotulo: 'Usuários' }
];

/** Telas ainda não construídas apontam para EmConstrucaoTela com o nome do menu. */
const emConstrucao = (caminho: string): DefinicaoRota<Tela> => {
  const titulo = MENU.find((item) => item.caminho === caminho)?.rotulo ?? 'Em construção';
  return { caminho, criar: () => new EmConstrucaoTela(titulo) };
};

/** Telas já construídas. */
const TELAS: readonly DefinicaoRota<Tela>[] = [
  { caminho: '/', criar: () => new InicioTela() },
  { caminho: '/categorias', criar: () => new CategoriasTela() }
];

const ROTAS: readonly DefinicaoRota<Tela>[] = [
  ...TELAS,
  ...MENU.filter((item) => !TELAS.some((t) => t.caminho === item.caminho)).map((item) =>
    emConstrucao(item.caminho)
  )
];

/** Monta a janela: layout com menu + roteador desenhando as telas no conteúdo. */
export class App {
  constructor(private readonly raiz: HTMLElement) {}

  /** `modoSimulado`: aberto fora do Electron (só em desenvolvimento), com dados de exemplo. */
  iniciar(modoSimulado = false): void {
    const layout = new Layout(MENU, NOME_APP, 'Carregando versão...');
    this.raiz.replaceChildren(layout.elemento);

    new Roteador(ROTAS, layout.conteudo, (caminho) => layout.marcarAtivo(caminho)).iniciar();

    void window.api.app.info().then((info) => {
      const versao = info.ok ? `Versão ${info.dados.versao}` : '';
      layout.atualizarRodape(modoSimulado ? `${versao} · modo simulado` : versao);
    });
  }
}
