import type { Resposta } from '@shared/dto/resposta';
import type { AtualizarUsuarioDTO, CriarUsuarioDTO, UsuarioDTO } from '@shared/dto/usuario.dto';
import type { Perfil } from '@shared/models/enums';
import { aplicarErros, CampoSelect, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { ROTULOS_PERFIL, opcoesDe } from '../../util/rotulos';

/** Tamanho mínimo da senha pedido na tela; o Main (Pessoa 3) confere de novo. */
export const SENHA_MINIMO = 8;

/**
 * Modal de cadastro/edição de usuário do sistema (só ADMIN chega aqui).
 * - Novo usuário: senha e confirmação obrigatórias.
 * - Edição: "Nova senha" é opcional; em branco, a senha atual continua valendo.
 * A senha só trafega até o Main, que grava o hash (bcrypt); ela nunca volta para a tela.
 */
export class UsuarioFormulario {
  private readonly nome: CampoTexto;
  private readonly email: CampoTexto;
  private readonly perfil: CampoSelect;
  private readonly senha: CampoTexto;
  private readonly confirmacao: CampoTexto;
  private readonly salvar: HTMLButtonElement;
  private readonly modal: Modal;

  constructor(
    private readonly existente: UsuarioDTO | null,
    /** Quem está logado: não pode tirar de si mesmo o perfil de administrador. */
    idLogado: number | null,
    private readonly aoSalvar: (usuario: UsuarioDTO) => void
  ) {
    this.nome = new CampoTexto({
      nome: 'nome',
      rotulo: 'Nome',
      valor: existente?.nome,
      obrigatorio: true,
      maximo: 120
    });
    this.email = new CampoTexto({
      nome: 'email',
      rotulo: 'E-mail (usado no login)',
      tipo: 'email',
      valor: existente?.email,
      obrigatorio: true,
      maximo: 150,
      autocompletar: 'off'
    });
    const ehOProprio = existente !== null && existente.id === idLogado;
    this.perfil = new CampoSelect({
      nome: 'perfil',
      rotulo: 'Perfil',
      opcoes: opcoesDe(ROTULOS_PERFIL),
      valor: existente?.perfil ?? 'FUNCIONARIO',
      obrigatorio: true,
      ajuda: ehOProprio
        ? 'Você não pode mudar o seu próprio perfil.'
        : 'Administrador também gerencia usuários.'
    });
    this.perfil.controle.disabled = ehOProprio;

    this.senha = new CampoTexto({
      nome: existente ? 'novaSenha' : 'senha',
      rotulo: existente ? 'Nova senha (opcional)' : 'Senha',
      tipo: 'password',
      obrigatorio: !existente,
      autocompletar: 'new-password',
      ajuda: existente
        ? 'Deixe em branco para manter a senha atual.'
        : `Pelo menos ${SENHA_MINIMO} caracteres.`
    });
    this.confirmacao = new CampoTexto({
      nome: 'confirmacao',
      rotulo: 'Repita a senha',
      tipo: 'password',
      obrigatorio: !existente,
      autocompletar: 'new-password'
    });

    const idFormulario = novoId('form-usuario');
    const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
      this.nome.elemento,
      this.email.elemento,
      this.perfil.elemento,
      el('div', { classe: 'grade-2' }, [this.senha.elemento, this.confirmacao.elemento])
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
      titulo: existente ? 'Editar usuário' : 'Novo usuário',
      conteudo: [formulario],
      rodape: [botao('Cancelar', () => this.modal.fechar()), this.salvar]
    });
  }

  abrir(): void {
    this.modal.abrir();
    this.nome.focar();
  }

  private get campos() {
    return [this.nome, this.email, this.perfil, this.senha, this.confirmacao];
  }

  private validarNaTela(): Record<string, string> {
    const erros: Record<string, string> = {};
    if (!this.nome.valor.trim()) erros['nome'] = 'Nome é obrigatório.';
    const email = this.email.valor.trim();
    if (!email) erros['email'] = 'E-mail é obrigatório.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros['email'] = 'E-mail inválido.';

    const senha = this.senha.valor;
    if (!this.existente || senha) {
      if (senha.length < SENHA_MINIMO) {
        erros[this.senha.nome] = `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`;
      } else if (senha !== this.confirmacao.valor) {
        erros['confirmacao'] = 'As senhas não são iguais.';
      }
    }
    return erros;
  }

  private async enviar(): Promise<void> {
    if (aplicarErros(this.campos, this.validarNaTela())) return;

    const nome = this.nome.valor.trim();
    const email = this.email.valor.trim();
    const perfil = this.perfil.valor as Perfil;

    this.ocupado(true);
    let resposta: Resposta<UsuarioDTO>;
    try {
      if (this.existente) {
        const dados: AtualizarUsuarioDTO = { id: this.existente.id, nome, email };
        if (!this.perfil.controle.disabled) dados.perfil = perfil;
        if (this.senha.valor) dados.novaSenha = this.senha.valor;
        resposta = await window.api.usuarios.atualizar(dados);
      } else {
        const dados: CriarUsuarioDTO = { nome, email, perfil, senha: this.senha.valor };
        resposta = await window.api.usuarios.criar(dados);
      }
    } catch {
      resposta = {
        ok: false,
        erro: { codigo: 'INTERNO', mensagem: 'Não foi possível se comunicar com o sistema.' }
      };
    }
    this.ocupado(false);

    if (resposta.ok) {
      Toast.sucesso(this.existente ? 'Usuário atualizado.' : 'Usuário cadastrado.');
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
