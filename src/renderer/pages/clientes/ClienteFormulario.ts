import type { ClienteDTO, CriarClienteDTO } from '@shared/dto/cliente.dto';
import type { Resposta } from '@shared/dto/resposta';
import { somenteDigitos } from '@shared/validadores/cnpj';
import { cpfValido, formatarCpf } from '@shared/validadores/cpf';
import { aplicarErros, CampoSelect, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { formatarCep, formatarTelefone } from '../../util/formatadores';

const UFS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO'
];

/**
 * Modal de cadastro/edição de cliente.
 * - CPF, telefone e CEP recebem máscara enquanto a pessoa digita; o CPF é conferido
 *   com o mesmo validador que o Main pode usar (shared/validadores/cpf.ts).
 * - Ao completar os 8 dígitos do CEP, o endereço é buscado (canal integracoes:buscarCep,
 *   API ViaCEP no Main) e preenche rua, bairro, cidade e UF. Se a busca falhar, a pessoa
 *   continua podendo digitar o endereço à mão.
 */
export class ClienteFormulario {
  private readonly nome: CampoTexto;
  private readonly cpf: CampoTexto;
  private readonly telefone: CampoTexto;
  private readonly email: CampoTexto;
  private readonly cep: CampoTexto;
  private readonly rua: CampoTexto;
  private readonly numero: CampoTexto;
  private readonly complemento: CampoTexto;
  private readonly bairro: CampoTexto;
  private readonly cidade: CampoTexto;
  private readonly uf: CampoSelect;
  private readonly avisoCep: HTMLElement;
  private readonly salvar: HTMLButtonElement;
  private readonly modal: Modal;
  /** Último CEP pesquisado (evita buscar de novo o mesmo) e número da busca em andamento. */
  private cepPesquisado = '';
  private buscaCep = 0;

  constructor(
    private readonly existente: ClienteDTO | null,
    private readonly aoSalvar: (cliente: ClienteDTO) => void
  ) {
    const texto = (
      nome: keyof CriarClienteDTO,
      rotulo: string,
      maximo: number,
      extras: Partial<ConstructorParameters<typeof CampoTexto>[0]> = {}
    ) =>
      new CampoTexto({
        nome,
        rotulo,
        maximo,
        valor: existente?.[nome] ?? '',
        obrigatorio: !rotulo.includes('opcional'),
        ...extras
      });

    this.nome = texto('nome', 'Nome completo', 120, { autocompletar: 'off' });
    this.cpf = texto('cpf', 'CPF', 14, {
      valor: existente ? formatarCpf(existente.cpf) : '',
      ajuda: 'Somente números; a pontuação é colocada automaticamente.'
    });
    this.telefone = texto('telefone', 'Telefone', 15, {
      tipo: 'tel',
      valor: existente ? formatarTelefone(existente.telefone) : ''
    });
    this.email = texto('email', 'E-mail (opcional)', 150, { tipo: 'email' });
    this.cep = texto('cep', 'CEP', 9, {
      valor: existente ? formatarCep(existente.cep) : '',
      ajuda: 'O endereço é preenchido sozinho ao digitar o CEP.'
    });
    this.rua = texto('rua', 'Rua', 150);
    this.numero = texto('numero', 'Número', 10);
    this.complemento = texto('complemento', 'Complemento (opcional)', 60);
    this.bairro = texto('bairro', 'Bairro', 80);
    this.cidade = texto('cidade', 'Cidade', 80);
    this.uf = new CampoSelect({
      nome: 'uf',
      rotulo: 'UF',
      opcoes: UFS.map((uf) => ({ valor: uf, rotulo: uf })),
      opcaoVazia: '—',
      valor: existente?.uf ?? '',
      obrigatorio: true
    });
    this.avisoCep = el('p', {
      classe: 'aviso-cep',
      atributos: { role: 'status', 'aria-live': 'polite' }
    });
    if (existente) this.cepPesquisado = existente.cep;

    this.aplicarMascara(this.cpf, formatarCpf);
    this.aplicarMascara(this.telefone, formatarTelefone);
    this.aplicarMascara(this.cep, formatarCep);
    this.cpf.controle.addEventListener('blur', () => this.conferirCpf());
    this.cep.controle.addEventListener('input', () => {
      if (somenteDigitos(this.cep.valor).length === 8) void this.buscarEndereco();
    });

    const idFormulario = novoId('form-cliente');
    const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
      el('fieldset', { classe: 'grupo-campos' }, [
        el('legend', { texto: 'Dados pessoais' }),
        this.nome.elemento,
        el('div', { classe: 'grade-2' }, [this.cpf.elemento, this.telefone.elemento]),
        this.email.elemento
      ]),
      el('fieldset', { classe: 'grupo-campos' }, [
        el('legend', { texto: 'Endereço' }),
        el('div', { classe: 'grade-2' }, [this.cep.elemento, this.avisoCep]),
        this.rua.elemento,
        el('div', { classe: 'grade-2' }, [this.numero.elemento, this.complemento.elemento]),
        el('div', { classe: 'grade-endereco' }, [
          this.bairro.elemento,
          this.cidade.elemento,
          this.uf.elemento
        ])
      ])
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
      titulo: existente ? 'Editar cliente' : 'Novo cliente',
      conteudo: [formulario],
      rodape: [botao('Cancelar', () => this.modal.fechar()), this.salvar]
    });
  }

  abrir(): void {
    this.modal.abrir();
    this.nome.focar();
  }

  private get campos() {
    return [
      this.nome,
      this.cpf,
      this.telefone,
      this.email,
      this.cep,
      this.rua,
      this.numero,
      this.complemento,
      this.bairro,
      this.cidade,
      this.uf
    ];
  }

  private aplicarMascara(campo: CampoTexto, formatar: (valor: string) => string): void {
    campo.controle.addEventListener('input', () => {
      campo.valor = formatar(campo.valor);
    });
  }

  private conferirCpf(): string | undefined {
    const digitos = somenteDigitos(this.cpf.valor);
    let erro: string | undefined;
    if (!digitos) erro = 'CPF é obrigatório.';
    else if (digitos.length !== 11) erro = 'CPF deve ter 11 dígitos.';
    else if (!cpfValido(digitos)) erro = 'CPF inválido: confira os números.';
    this.cpf.definirErro(erro);
    return erro;
  }

  /** Preenche o endereço pelo CEP. Só a resposta da última busca é usada. */
  private async buscarEndereco(): Promise<void> {
    const cep = somenteDigitos(this.cep.valor);
    if (cep === this.cepPesquisado) return;
    this.cepPesquisado = cep;
    const numero = ++this.buscaCep;

    this.cep.definirErro(undefined);
    this.avisoCep.textContent = 'Buscando endereço...';
    let resposta;
    try {
      resposta = await window.api.integracoes.buscarCep({ cep });
    } catch {
      resposta = null;
    }
    if (numero !== this.buscaCep) return;

    if (!resposta?.ok) {
      this.avisoCep.textContent = '';
      this.cep.definirErro(
        resposta?.erro.mensagem ?? 'Não foi possível buscar o CEP. Preencha o endereço à mão.'
      );
      this.cepPesquisado = '';
      return;
    }
    const endereco = resposta.dados;
    this.rua.valor = endereco.rua;
    this.bairro.valor = endereco.bairro;
    this.cidade.valor = endereco.cidade;
    this.uf.valor = endereco.uf;
    for (const campo of [this.rua, this.bairro, this.cidade, this.uf]) campo.definirErro(undefined);
    this.avisoCep.textContent = `✓ Endereço encontrado: ${endereco.cidade}/${endereco.uf}.`;
    // O próximo campo que a pessoa precisa preencher é o número.
    this.numero.focar();
  }

  private validarNaTela(): Record<string, string> {
    const erros: Record<string, string> = {};
    const obrigatorios = [this.nome, this.rua, this.numero, this.bairro, this.cidade];
    for (const campo of obrigatorios) {
      if (!campo.valor.trim()) erros[campo.nome] = 'Campo obrigatório.';
    }
    const erroCpf = this.conferirCpf();
    if (erroCpf) erros['cpf'] = erroCpf;
    const telefone = somenteDigitos(this.telefone.valor);
    if (telefone.length < 10) erros['telefone'] = 'Telefone deve ter DDD + número.';
    const email = this.email.valor.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros['email'] = 'E-mail inválido.';
    if (somenteDigitos(this.cep.valor).length !== 8) erros['cep'] = 'CEP deve ter 8 dígitos.';
    if (!this.uf.valor) erros['uf'] = 'Escolha a UF.';
    return erros;
  }

  private async enviar(): Promise<void> {
    if (aplicarErros(this.campos, this.validarNaTela())) return;

    const dados: CriarClienteDTO = {
      nome: this.nome.valor.trim(),
      cpf: somenteDigitos(this.cpf.valor),
      telefone: somenteDigitos(this.telefone.valor),
      // Enviados mesmo vazios: na edição, vazio significa "apagar".
      email: this.email.valor.trim(),
      cep: somenteDigitos(this.cep.valor),
      rua: this.rua.valor.trim(),
      numero: this.numero.valor.trim(),
      complemento: this.complemento.valor.trim(),
      bairro: this.bairro.valor.trim(),
      cidade: this.cidade.valor.trim(),
      uf: this.uf.valor
    };

    this.ocupado(true);
    let resposta: Resposta<ClienteDTO>;
    try {
      resposta = this.existente
        ? await window.api.clientes.atualizar({ id: this.existente.id, ...dados })
        : await window.api.clientes.criar(dados);
    } catch {
      resposta = {
        ok: false,
        erro: { codigo: 'INTERNO', mensagem: 'Não foi possível se comunicar com o sistema.' }
      };
    }
    this.ocupado(false);

    if (resposta.ok) {
      Toast.sucesso(this.existente ? 'Cliente atualizado.' : 'Cliente cadastrado.');
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
