import { estadoErro } from '../components/Estados';
import { el } from './dom';
import { encontrarRota, separarHash, type DefinicaoRota } from '../util/rotas';
import type { Tela } from './Tela';

export const NOME_APP = 'Locadora Esportiva';

/** Muda de tela. Ex.: navegar('/clientes/7'). */
export function navegar(caminho: string): void {
  window.location.hash = '#' + caminho;
}

/**
 * Troca a tela exibida conforme o endereço (#/caminho).
 * A cada navegação: desmonta a tela anterior, monta a nova, atualiza o título
 * da janela e leva o foco ao título da tela (para quem usa leitor de tela).
 */
export class Roteador {
  private telaAtual: Tela | null = null;
  /** Evita que uma tela lenta "apareça" depois que o usuário já trocou de tela. */
  private navegacao = 0;

  constructor(
    private readonly rotas: readonly DefinicaoRota<Tela>[],
    private readonly alvo: HTMLElement,
    private readonly aoMudarCaminho?: (caminho: string) => void
  ) {}

  iniciar(): void {
    window.addEventListener('hashchange', () => void this.renderizar());
    if (window.location.hash === '' || window.location.hash === '#') {
      window.location.replace('#/');
    }
    void this.renderizar();
  }

  private async renderizar(): Promise<void> {
    const hash = window.location.hash;
    const numero = ++this.navegacao;

    this.telaAtual?.desmontar?.();
    this.telaAtual = null;

    const container = el('div', { classe: 'tela' });
    this.alvo.replaceChildren(container);
    this.alvo.scrollTop = 0;
    this.aoMudarCaminho?.(separarHash(hash).caminho);

    const encontrada = encontrarRota(this.rotas, hash);
    if (!encontrada) {
      document.title = `Página não encontrada · ${NOME_APP}`;
      container.append(estadoErro('Página não encontrada.'));
      return;
    }

    const tela = encontrada.rota.criar(encontrada.parametros, encontrada.consulta);
    this.telaAtual = tela;
    document.title = `${tela.titulo} · ${NOME_APP}`;

    try {
      await tela.montar(container);
    } catch (erro) {
      console.error('Falha ao montar a tela', erro);
      if (numero === this.navegacao) {
        container.replaceChildren(estadoErro('Não foi possível abrir esta tela.'));
      }
      return;
    }

    if (numero === this.navegacao) this.focarTitulo(container);
  }

  private focarTitulo(container: HTMLElement): void {
    const titulo = container.querySelector('h1');
    if (!titulo) return;
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
  }
}
