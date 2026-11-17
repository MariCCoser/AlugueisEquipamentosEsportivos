import type { CriarFornecedorDTO, FornecedorDTO } from '@shared/dto/fornecedor.dto';
import type { Resposta } from '@shared/dto/resposta';
import type { TipoFornecedor } from '@shared/models/enums';
import { cnpjValido, formatarCnpj, somenteDigitos } from '@shared/validadores/cnpj';
import { aplicarErros, CampoSelect, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { formatarTelefone } from '../../util/formatadores';

export const ROTULOS_TIPO: Record<TipoFornecedor, string> = {
  COMPRA: 'Compra',
  MANUTENCAO: 'Manutenção'
};

/**
 * Modal de cadastro/edição de fornecedor.
 * CNPJ e telefone recebem máscara enquanto a pessoa digita; o CNPJ é conferido
 * com o mesmo validador do Main (shared/validadores/cnpj.ts). O Main valida tudo
 * de novo e os erros dele aparecem embaixo de cada campo.
 */
export class FornecedorFormulario {
  private readonly razaoSocial: CampoTexto;
  private readonly cnpj: CampoTexto;
  private readonly tipo: CampoSelect;
  private readonly contato: CampoTexto;
  private readonly telefone: CampoTexto;
  private readonly email: CampoTexto;
  private readonly salvar: HTMLButtonElement;
  private readonly modal: Modal;

  constructor(
    private readonly existente: FornecedorDTO | null,
    tipoInicial: TipoFornecedor,
    private readonly aoSalvar: (fornecedor: FornecedorDTO) => void
  ) {
    this.razaoSocial = new CampoTexto({
      nome: 'razaoSocial',
      rotulo: 'Razão social',
      valor: existente?.razaoSocial,
      obrigatorio: true,
      maximo: 150
    });
    this.cnpj = new CampoTexto({
      nome: 'cnpj',
      rotulo: 'CNPJ',
      valor: existente ? formatarCnpj(existente.cnpj) : '',
      obrigatorio: true,
      maximo: 18,
      ajuda: 'Somente números; a pontuação é colocada automaticamente.'
    });
    this.tipo = new CampoSelect({
      nome: 'tipo',
      rotulo: 'Tipo',
      opcoes: [
        { valor: 'COMPRA', rotulo: 'Compra (de quem compramos equipamentos)' },
        { valor: 'MANUTENCAO', rotulo: 'Manutenção (quem conserta os equipamentos)' }
      ],
      valor: existente?.tipo ?? tipoInicial,
      obrigatorio: true
    });
    this.contato = new CampoTexto({
      nome: 'contato',
      rotulo: 'Pessoa de contato (opcional)',
      valor: existente?.contato,
      maximo: 100
    });
    this.telefone = new CampoTexto({
      nome: 'telefone',
      rotulo: 'Telefone (opcional)',
      tipo: 'tel',
      valor: existente?.telefone ? formatarTelefone(existente.telefone) : '',
      maximo: 15
    });
    this.email = new CampoTexto({
      nome: 'email',
      rotulo: 'E-mail (opcional)',
      tipo: 'email',
      valor: existente?.email,
      maximo: 150
    });

    this.aplicarMascara(this.cnpj, formatarCnpj);
    this.aplicarMascara(this.telefone, formatarTelefone);
    this.cnpj.controle.addEventListener('blur', () => this.conferirCnpj());

    const idFormulario = novoId('form-fornecedor');
    const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
      this.razaoSocial.elemento,
      this.cnpj.elemento,
      this.tipo.elemento,
      this.contato.elemento,
      this.telefone.elemento,
      this.email.elemento
    ]);
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      void this.enviar();
    });

    this.salvar = el('button', {
      classe: 'botao botao--primario',
      texto: 'Salvar',
      atributos: { type: 'submit', form: idFormulario }
    });

    this.modal = new Modal({
      titulo: existente ? 'Editar fornecedor' : 'Novo fornecedor',
      conteudo: [formulario],
      rodape: [botao('Cancelar', () => this.modal.fechar()), this.salvar]
    });
  }

  abrir(): void {
    this.modal.abrir();
    this.razaoSocial.focar();
  }

  private get campos() {
    return [this.razaoSocial, this.cnpj, this.tipo, this.contato, this.telefone, this.email];
  }

  private aplicarMascara(campo: CampoTexto, formatar: (valor: string) => string): void {
    campo.controle.addEventListener('input', () => {
      campo.valor = formatar(campo.valor);
    });
  }

  /** Avisa já ao sair do campo, sem esperar o "Salvar". Devolve a mensagem de erro, se houver. */
  private conferirCnpj(): string | undefined {
    const digitos = somenteDigitos(this.cnpj.valor);
    let erro: string | undefined;
    if (!digitos) erro = 'CNPJ é obrigatório.';
    else if (digitos.length !== 14) erro = 'CNPJ deve ter 14 dígitos.';
    else if (!cnpjValido(digitos)) erro = 'CNPJ inválido: confira os números.';
    this.cnpj.definirErro(erro);
    return erro;
  }

  private async enviar(): Promise<void> {
    const erros: Record<string, string> = {};
    const razao = this.razaoSocial.valor.trim();
    if (razao.length < 3) {
      erros['razaoSocial'] = razao
        ? 'Razão social deve ter pelo menos 3 letras.'
        : 'Razão social é obrigatório.';
    }
    const erroCnpj = this.conferirCnpj();
    if (erroCnpj) erros['cnpj'] = erroCnpj;
    if (aplicarErros(this.campos, erros)) return;

    const dados: CriarFornecedorDTO = {
      razaoSocial: razao,
      cnpj: somenteDigitos(this.cnpj.valor),
      tipo: this.tipo.valor as TipoFornecedor,
      // Enviados mesmo vazios: na edição, vazio significa "apagar".
      contato: this.contato.valor.trim(),
      telefone: somenteDigitos(this.telefone.valor),
      email: this.email.valor.trim()
    };

    this.ocupado(true);
    let resposta: Resposta<FornecedorDTO>;
    try {
      resposta = this.existente
        ? await window.api.fornecedores.atualizar({ id: this.existente.id, ...dados })
        : await window.api.fornecedores.criar(dados);
    } catch {
      resposta = {
        ok: false,
        erro: { codigo: 'INTERNO', mensagem: 'Não foi possível se comunicar com o sistema.' }
      };
    }
    this.ocupado(false);

    if (resposta.ok) {
      Toast.sucesso(this.existente ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.');
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
