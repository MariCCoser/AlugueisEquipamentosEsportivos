import type { Resposta } from '@shared/dto/resposta';
import { carregando, estadoErro, estadoVazio } from './Estados';

export interface OpcoesConsulta<T> {
  /** Chamada ao Main. Ex.: () => window.api.categorias.listar() */
  buscar: () => Promise<Resposta<T>>;
  /** Desenha os dados quando a resposta chega com sucesso. */
  renderizar: (dados: T) => Node;
  /** Diz se a resposta deve ser tratada como "nada cadastrado". */
  estaVazio?: (dados: T) => boolean;
  /** Texto do estado vazio; pode ser uma função (ex.: muda quando há busca). */
  textoVazio?: string | (() => string);
  /** Botão opcional no estado vazio (ex.: "Cadastrar"); `undefined` = sem botão. */
  acaoVazio?: () => HTMLElement | undefined;
  textoCarregando?: string;
}

/**
 * Busca dados no Main e mostra, nesta ordem: carregando → erro / vazio / dados.
 * Faz o papel do "useConsulta" do guia, mas em classe (TypeScript puro).
 *
 *   const consulta = new Consulta(area, {
 *     buscar: () => window.api.categorias.listar(),
 *     estaVazio: (lista) => lista.length === 0,
 *     textoVazio: 'Nenhuma categoria cadastrada.',
 *     renderizar: (lista) => tabela.renderizar(lista)
 *   });
 *   await consulta.carregar();   // e depois de salvar: consulta.carregar() de novo
 */
export class Consulta<T> {
  /** Garante que só a resposta da última chamada seja desenhada. */
  private chamada = 0;

  constructor(
    private readonly alvo: HTMLElement,
    private readonly opcoes: OpcoesConsulta<T>
  ) {}

  async carregar(): Promise<void> {
    const numero = ++this.chamada;
    this.alvo.setAttribute('aria-busy', 'true');
    this.alvo.replaceChildren(carregando(this.opcoes.textoCarregando));

    let resposta: Resposta<T>;
    try {
      resposta = await this.opcoes.buscar();
    } catch (erro) {
      console.error('Falha na comunicação com o processo principal', erro);
      resposta = {
        ok: false,
        erro: { codigo: 'INTERNO', mensagem: 'Não foi possível se comunicar com o sistema.' }
      };
    }

    if (numero !== this.chamada) return;
    this.alvo.removeAttribute('aria-busy');

    if (!resposta.ok) {
      this.alvo.replaceChildren(estadoErro(resposta.erro.mensagem, () => void this.carregar()));
      return;
    }

    const { estaVazio, textoVazio, acaoVazio } = this.opcoes;
    if (estaVazio?.(resposta.dados)) {
      this.alvo.replaceChildren(
        estadoVazio(
          (typeof textoVazio === 'function' ? textoVazio() : textoVazio) ??
            'Nenhum registro encontrado.',
          acaoVazio?.()
        )
      );
      return;
    }

    this.alvo.replaceChildren(this.opcoes.renderizar(resposta.dados));
  }
}
