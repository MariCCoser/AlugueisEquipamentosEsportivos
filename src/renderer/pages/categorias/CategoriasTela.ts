import type { CategoriaDTO } from '@shared/dto/categoria.dto';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { confirmar } from '../../components/ConfirmDialog';
import { Consulta } from '../../components/Consulta';
import { Tabela } from '../../components/Tabela';
import { Toast } from '../../components/Toast';
import { botao, el } from '../../nucleo/dom';
import type { Tela } from '../../nucleo/Tela';
import { pluralizar } from '../../util/formatadores';
import { CategoriaFormulario } from './CategoriaFormulario';

/**
 * Cadastro de categorias: lista, nova, editar e excluir.
 * Criar/editar/excluir são só para ADMIN; o Main recusa os outros perfis
 * (quando o login existir, os botões também serão escondidos para FUNCIONARIO).
 */
export class CategoriasTela implements Tela {
  readonly titulo = 'Categorias';
  private consulta: Consulta<CategoriaDTO[]> | null = null;

  private readonly tabela = new Tabela<CategoriaDTO>({
    legenda: 'Categorias cadastradas',
    colunas: [
      { titulo: 'Nome', valor: (c) => c.nome, ordenar: (a, b) => a.nome.localeCompare(b.nome) },
      { titulo: 'Descrição', valor: (c) => c.descricao ?? '—' },
      {
        titulo: 'Alerta de clima',
        valor: (c) =>
          c.sensivelClima
            ? el('span', { classe: 'etiqueta etiqueta--alerta', texto: 'Sim' })
            : el('span', { classe: 'etiqueta', texto: 'Não' })
      },
      {
        titulo: 'Equipamentos',
        valor: (c) => c.qtdEquipamentos,
        numerica: true,
        ordenar: (a, b) => a.qtdEquipamentos - b.qtdEquipamentos
      }
    ],
    acoes: (c) => [
      botao('Editar', () => this.abrirFormulario(c), 'padrao', {
        'aria-label': `Editar a categoria ${c.nome}`
      }),
      this.botaoExcluir(c)
    ]
  });

  montar(alvo: HTMLElement): void {
    const area = el('div');
    alvo.append(
      cabecalhoTela(this.titulo, [
        botao('Nova categoria', () => this.abrirFormulario(null), 'primario')
      ]),
      area
    );

    this.consulta = new Consulta(area, {
      buscar: () => window.api.categorias.listar(),
      estaVazio: (lista) => lista.length === 0,
      textoVazio: 'Nenhuma categoria cadastrada.',
      acaoVazio: () => botao('Cadastrar categoria', () => this.abrirFormulario(null), 'primario'),
      renderizar: (lista) => this.tabela.renderizar(lista)
    });
    void this.consulta.carregar();
  }

  private abrirFormulario(categoria: CategoriaDTO | null): void {
    new CategoriaFormulario(categoria, () => void this.consulta?.carregar()).abrir();
  }

  /** Categoria em uso não pode ser excluída: o botão já vem desabilitado e explica o motivo. */
  private botaoExcluir(c: CategoriaDTO): HTMLButtonElement {
    const emUso = c.qtdEquipamentos > 0;
    return botao('Excluir', () => void this.excluir(c), 'perigo', {
      'aria-label': `Excluir a categoria ${c.nome}`,
      disabled: emUso,
      title: emUso
        ? `Não é possível excluir: ${pluralizar(c.qtdEquipamentos, 'equipamento usa', 'equipamentos usam')} esta categoria.`
        : undefined
    });
  }

  private async excluir(c: CategoriaDTO): Promise<void> {
    const confirmado = await confirmar({
      titulo: 'Excluir categoria',
      mensagem: `Excluir a categoria "${c.nome}"? Essa ação não pode ser desfeita.`
    });
    if (!confirmado) return;

    const resposta = await window.api.categorias.excluir({ id: c.id });
    if (resposta.ok) {
      Toast.sucesso(`Categoria "${c.nome}" excluída.`);
      void this.consulta?.carregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }
}
