import type { CriarEquipamentoDTO, EquipamentoDTO } from '@shared/dto/equipamento.dto';
import type { Resposta } from '@shared/dto/resposta';
import type { EstadoConservacao, Modalidade } from '@shared/models/enums';
import { aplicarErros, CampoSelect, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { ROTULOS_ESTADO_CONSERVACAO, opcoesDe } from '../../util/rotulos';

/** Data de hoje no formato do <input type="date">, no fuso do computador. */
function hojeISO(): string {
  const agora = new Date();
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

/**
 * Modal de cadastro/edição de equipamento do inventário.
 * Mostra "Valor da diária" para LOCAÇÃO e "Preço de venda" para VENDA (a mesma regra
 * do EquipamentoDominio). As listas de categorias e de fornecedores de COMPRA vêm do
 * Main antes de o modal abrir; se falharem, o modal não abre e a pessoa vê o motivo.
 * O status não aparece aqui: ele muda pela reserva, pela manutenção ou pelo botão
 * "Desativar/Reativar" da lista.
 */
export class EquipamentoFormulario {
  private readonly nome: CampoTexto;
  private readonly descricao: CampoTexto;
  private readonly categoria: CampoSelect;
  private readonly modalidade: CampoSelect;
  private readonly valorDiaria: CampoTexto;
  private readonly precoVenda: CampoTexto;
  private readonly estado: CampoSelect;
  private readonly dataAquisicao: CampoTexto;
  private readonly fornecedor: CampoSelect;
  private readonly salvar: HTMLButtonElement;
  private readonly modal: Modal;

  private constructor(
    private readonly existente: EquipamentoDTO | null,
    categorias: { valor: string; rotulo: string }[],
    fornecedores: { valor: string; rotulo: string }[],
    private readonly aoSalvar: (equipamento: EquipamentoDTO) => void
  ) {
    this.nome = new CampoTexto({
      nome: 'nome',
      rotulo: 'Nome',
      valor: existente?.nome,
      obrigatorio: true,
      maximo: 120
    });
    this.descricao = new CampoTexto({
      nome: 'descricao',
      rotulo: 'Descrição (opcional)',
      valor: existente?.descricao,
      maximo: 255,
      ajuda: 'Ex.: tamanho, acessórios inclusos.'
    });
    this.categoria = new CampoSelect({
      nome: 'categoriaId',
      rotulo: 'Categoria',
      opcoes: categorias,
      opcaoVazia: 'Escolha uma categoria',
      obrigatorio: true
    });
    this.categoria.valor = existente ? String(existente.categoriaId) : '';
    this.modalidade = new CampoSelect({
      nome: 'modalidade',
      rotulo: 'Modalidade',
      opcoes: [
        { valor: 'LOCACAO', rotulo: 'Locação (para alugar)' },
        { valor: 'VENDA', rotulo: 'Venda' }
      ],
      valor: existente?.modalidade ?? 'LOCACAO',
      obrigatorio: true,
      aoMudar: () => this.mostrarPreco()
    });
    this.valorDiaria = this.campoDinheiro(
      'valorDiaria',
      'Valor da diária (R$)',
      existente?.valorDiaria
    );
    this.precoVenda = this.campoDinheiro(
      'precoVenda',
      'Preço de venda (R$)',
      existente?.precoVenda
    );
    this.estado = new CampoSelect({
      nome: 'estadoConservacao',
      rotulo: 'Estado de conservação',
      opcoes: opcoesDe(ROTULOS_ESTADO_CONSERVACAO),
      valor: existente?.estadoConservacao ?? 'NOVO',
      obrigatorio: true
    });
    this.dataAquisicao = new CampoTexto({
      nome: 'dataAquisicao',
      rotulo: 'Data de aquisição (opcional)',
      tipo: 'date',
      valor: existente?.dataAquisicao
    });
    this.dataAquisicao.controle.max = hojeISO();
    this.fornecedor = new CampoSelect({
      nome: 'fornecedorId',
      rotulo: 'Fornecedor (opcional)',
      opcoes: fornecedores,
      opcaoVazia: 'Não informado',
      ajuda: 'Só aparecem fornecedores do tipo Compra.'
    });
    this.fornecedor.valor = existente?.fornecedorId ? String(existente.fornecedorId) : '';

    const idFormulario = novoId('form-equipamento');
    const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
      this.nome.elemento,
      this.descricao.elemento,
      el('div', { classe: 'grade-2' }, [this.categoria.elemento, this.modalidade.elemento]),
      el('div', { classe: 'grade-2' }, [
        this.valorDiaria.elemento,
        this.precoVenda.elemento,
        this.estado.elemento
      ]),
      el('div', { classe: 'grade-2' }, [this.dataAquisicao.elemento, this.fornecedor.elemento])
    ]);
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      void this.enviar();
    });
    this.mostrarPreco();

    this.salvar = el('button', {
      classe: 'botao botao--primario',
      texto: 'Salvar',
      atributos: { type: 'submit', form: idFormulario }
    });

    this.modal = new Modal({
      titulo: existente ? 'Editar equipamento' : 'Novo equipamento',
      conteudo: [formulario],
      rodape: [botao('Cancelar', () => this.modal.fechar()), this.salvar]
    });
  }

  /** Busca categorias e fornecedores de COMPRA e só então abre o modal. */
  static async abrir(
    existente: EquipamentoDTO | null,
    aoSalvar: (equipamento: EquipamentoDTO) => void
  ): Promise<void> {
    const [categorias, fornecedores] = await Promise.all([
      window.api.categorias.listar(),
      window.api.fornecedores.listarPorTipo({ tipo: 'COMPRA' })
    ]);
    if (!categorias.ok) return Toast.erro(categorias.erro.mensagem);
    if (!fornecedores.ok) return Toast.erro(fornecedores.erro.mensagem);
    if (categorias.dados.length === 0) {
      return Toast.erro('Cadastre uma categoria antes de cadastrar equipamentos.');
    }

    const formulario = new EquipamentoFormulario(
      existente,
      categorias.dados.map((c) => ({ valor: String(c.id), rotulo: c.nome })),
      fornecedores.dados.map((f) => ({ valor: String(f.id), rotulo: f.razaoSocial })),
      aoSalvar
    );
    formulario.modal.abrir();
    formulario.nome.focar();
  }

  private get campos() {
    return [
      this.nome,
      this.descricao,
      this.categoria,
      this.modalidade,
      this.valorDiaria,
      this.precoVenda,
      this.estado,
      this.dataAquisicao,
      this.fornecedor
    ];
  }

  private campoDinheiro(nome: string, rotulo: string, valor?: number): CampoTexto {
    const campo = new CampoTexto({
      nome,
      rotulo,
      tipo: 'number',
      valor: valor !== undefined ? valor.toFixed(2) : '',
      obrigatorio: true
    });
    campo.controle.min = '0.01';
    campo.controle.step = '0.01';
    campo.controle.inputMode = 'decimal';
    return campo;
  }

  /** Mostra só o campo de preço que vale para a modalidade escolhida. */
  private mostrarPreco(): void {
    const locacao = this.modalidade.valor === 'LOCACAO';
    this.valorDiaria.elemento.hidden = !locacao;
    this.precoVenda.elemento.hidden = locacao;
  }

  /** Lê um valor em reais; devolve a mensagem de erro se não for um número positivo com até 2 casas. */
  private static lerDinheiro(texto: string): { valor?: number; erro?: string } {
    if (!texto.trim()) return { erro: 'Informe um valor maior que zero.' };
    const valor = Number(texto.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) return { erro: 'Informe um valor maior que zero.' };
    if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) {
      return { erro: 'Use no máximo 2 casas decimais.' };
    }
    return { valor };
  }

  private async enviar(): Promise<void> {
    const erros: Record<string, string> = {};
    const nome = this.nome.valor.trim();
    if (!nome) erros['nome'] = 'Nome é obrigatório.';
    if (!this.categoria.valor) erros['categoriaId'] = 'Escolha uma categoria.';

    const modalidade = this.modalidade.valor as Modalidade;
    const campoPreco = modalidade === 'LOCACAO' ? this.valorDiaria : this.precoVenda;
    const preco = EquipamentoFormulario.lerDinheiro(campoPreco.valor);
    if (preco.erro) erros[campoPreco.nome] = preco.erro;

    const data = this.dataAquisicao.valor;
    if (data && data > hojeISO()) erros['dataAquisicao'] = 'A data não pode ser no futuro.';
    if (aplicarErros(this.campos, erros)) return;

    const dados: CriarEquipamentoDTO = {
      nome,
      // Enviada mesmo vazia: na edição, vazio significa "apagar".
      descricao: this.descricao.valor.trim(),
      categoriaId: Number(this.categoria.valor),
      modalidade,
      estadoConservacao: this.estado.valor as EstadoConservacao,
      ...(modalidade === 'LOCACAO' ? { valorDiaria: preco.valor } : { precoVenda: preco.valor }),
      ...(data ? { dataAquisicao: data } : {}),
      ...(this.fornecedor.valor ? { fornecedorId: Number(this.fornecedor.valor) } : {})
    };

    this.ocupado(true);
    let resposta: Resposta<EquipamentoDTO>;
    try {
      resposta = this.existente
        ? await window.api.equipamentos.atualizar({ id: this.existente.id, ...dados })
        : await window.api.equipamentos.criar(dados);
    } catch {
      resposta = {
        ok: false,
        erro: { codigo: 'INTERNO', mensagem: 'Não foi possível se comunicar com o sistema.' }
      };
    }
    this.ocupado(false);

    if (resposta.ok) {
      Toast.sucesso(this.existente ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');
      this.modal.fechar();
      this.aoSalvar(resposta.dados);
    } else if (!aplicarErros(this.campos, resposta.erro.campos)) {
      Toast.erro(resposta.erro.mensagem);
    }
  }

  private ocupado(sim: boolean): void {
    this.salvar.disabled = sim;
    this.salvar.textContent = sim ? 'Salvando...' : 'Salvar';
  }
}
