import type { FornecedorDTO } from '@shared/dto/fornecedor.dto';
import type { TipoFornecedor } from '@shared/models/enums';
import { formatarCnpj } from '@shared/validadores/cnpj';
import { Abas } from '../../components/Abas';
import { cabecalhoTela } from '../../components/CabecalhoTela';
import { CampoTexto } from '../../components/Campos';
import { confirmar } from '../../components/ConfirmDialog';
import { Consulta } from '../../components/Consulta';
import { Tabela } from '../../components/Tabela';
import { Toast } from '../../components/Toast';
import { botao, el } from '../../nucleo/dom';
import type { Tela } from '../../nucleo/Tela';
import { formatarTelefone } from '../../util/formatadores';
import { FornecedorFormulario, ROTULOS_TIPO } from './FornecedorFormulario';

/** Espera a pessoa parar de digitar antes de buscar (evita uma chamada por tecla). */
const ESPERA_BUSCA_MS = 300;

/**
 * Cadastro de fornecedores com abas COMPRA / MANUTENÇÃO e busca por razão social ou CNPJ.
 * A aba pode vir no endereço: #/fornecedores?aba=MANUTENCAO
 */
export class FornecedoresTela implements Tela {
  readonly titulo = 'Fornecedores';
  private aba: TipoFornecedor;
  private busca = '';
  private consulta: Consulta<FornecedorDTO[]> | null = null;
  private temporizador: number | undefined;

  private readonly tabela = new Tabela<FornecedorDTO>({
    legenda: 'Fornecedores cadastrados',
    colunas: [
      {
        titulo: 'Razão social',
        valor: (f) => f.razaoSocial,
        ordenar: (a, b) => a.razaoSocial.localeCompare(b.razaoSocial)
      },
      { titulo: 'CNPJ', valor: (f) => formatarCnpj(f.cnpj), semQuebra: true },
      { titulo: 'Contato', valor: (f) => f.contato ?? '—' },
      {
        titulo: 'Telefone',
        valor: (f) => (f.telefone ? formatarTelefone(f.telefone) : '—'),
        semQuebra: true
      },
      { titulo: 'E-mail', valor: (f) => f.email ?? '—' }
    ],
    acoes: (f) => [
      botao('Editar', () => this.abrirFormulario(f), 'padrao', {
        'aria-label': `Editar o fornecedor ${f.razaoSocial}`
      }),
      botao('Excluir', () => void this.excluir(f), 'perigo', {
        'aria-label': `Excluir o fornecedor ${f.razaoSocial}`
      })
    ]
  });

  constructor(consulta?: URLSearchParams) {
    this.aba = consulta?.get('aba') === 'MANUTENCAO' ? 'MANUTENCAO' : 'COMPRA';
  }

  montar(alvo: HTMLElement): void {
    const abas = new Abas<TipoFornecedor>(
      [
        { id: 'COMPRA', rotulo: ROTULOS_TIPO.COMPRA },
        { id: 'MANUTENCAO', rotulo: ROTULOS_TIPO.MANUTENCAO }
      ],
      this.aba,
      (id) => {
        this.aba = id;
        void this.consulta?.carregar();
      },
      'Tipo de fornecedor'
    );

    const campoBusca = new CampoTexto({
      nome: 'busca',
      rotulo: 'Buscar por razão social ou CNPJ',
      maximo: 150
    });
    campoBusca.elemento.classList.add('campo--busca');
    campoBusca.controle.setAttribute('type', 'search');
    campoBusca.controle.addEventListener('input', () => {
      window.clearTimeout(this.temporizador);
      this.temporizador = window.setTimeout(() => {
        this.busca = campoBusca.valor.trim();
        void this.consulta?.carregar();
      }, ESPERA_BUSCA_MS);
    });

    const area = el('div');
    abas.painel.append(
      el('div', { classe: 'filtros', atributos: { role: 'search' } }, [campoBusca.elemento]),
      area
    );

    alvo.append(
      cabecalhoTela(this.titulo, [
        botao('Novo fornecedor', () => this.abrirFormulario(null), 'primario')
      ]),
      abas.elemento
    );

    this.consulta = new Consulta(area, {
      buscar: () =>
        window.api.fornecedores.listar({ tipo: this.aba, busca: this.busca || undefined }),
      estaVazio: (lista) => lista.length === 0,
      textoVazio: () =>
        this.busca
          ? `Nenhum fornecedor encontrado para "${this.busca}".`
          : 'Nenhum fornecedor cadastrado nesta aba.',
      acaoVazio: () =>
        this.busca
          ? undefined
          : botao('Cadastrar fornecedor', () => this.abrirFormulario(null), 'primario'),
      renderizar: (lista) => this.tabela.renderizar(lista)
    });
    void this.consulta.carregar();
  }

  desmontar(): void {
    window.clearTimeout(this.temporizador);
  }

  private abrirFormulario(fornecedor: FornecedorDTO | null): void {
    new FornecedorFormulario(fornecedor, this.aba, () => void this.consulta?.carregar()).abrir();
  }

  /** Se houver equipamentos ou manutenções vinculados, o Main recusa e explica quantos. */
  private async excluir(f: FornecedorDTO): Promise<void> {
    const confirmado = await confirmar({
      titulo: 'Excluir fornecedor',
      mensagem: `Excluir o fornecedor "${f.razaoSocial}"? Essa ação não pode ser desfeita.`
    });
    if (!confirmado) return;

    const resposta = await window.api.fornecedores.excluir({ id: f.id });
    if (resposta.ok) {
      Toast.sucesso(`Fornecedor "${f.razaoSocial}" excluído.`);
      void this.consulta?.carregar();
    } else {
      Toast.erro(resposta.erro.mensagem);
    }
  }
}
