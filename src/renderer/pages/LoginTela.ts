import type { UsuarioSessaoDTO } from '@shared/dto/auth.dto';
import { aplicarErros, CampoTexto } from '../components/Campos';
import { el, novoId } from '../nucleo/dom';
import { NOME_APP } from '../nucleo/Roteador';

/**
 * Porta de entrada do sistema: e-mail e senha (canal auth:login).
 *
 * Segurança (decisões da tela; quem garante é o Main, Pessoa 3):
 * - a mensagem de erro é a que o Main manda, genérica ("E-mail ou senha incorretos"),
 *   para não revelar se o e-mail existe;
 * - a senha sai do campo assim que o login falha ou dá certo (não fica na memória da tela);
 * - "Mostrar senha" é um botão com aria-pressed, e o aviso de Caps Lock é lido pelo leitor de tela.
 */
export class LoginTela {
  readonly titulo = 'Entrar';
  private readonly email: CampoTexto;
  private readonly senha: CampoTexto;
  private readonly entrar: HTMLButtonElement;
  private readonly mensagem = el('p', {
    classe: 'login__mensagem',
    atributos: { role: 'alert', hidden: true }
  });
  private readonly avisoCaps = el('p', {
    classe: 'login__caps',
    texto: 'Caps Lock está ligado.',
    atributos: { 'aria-live': 'polite', hidden: true }
  });

  constructor(
    private readonly aoEntrar: (usuario: UsuarioSessaoDTO) => void,
    /** Aviso para mostrar ao abrir (ex.: "Você saiu do sistema."). */
    private readonly avisoInicial?: string
  ) {
    this.email = new CampoTexto({
      nome: 'email',
      rotulo: 'E-mail',
      tipo: 'email',
      obrigatorio: true,
      maximo: 150,
      autocompletar: 'username'
    });
    this.senha = new CampoTexto({
      nome: 'senha',
      rotulo: 'Senha',
      tipo: 'password',
      obrigatorio: true,
      maximo: 128,
      autocompletar: 'current-password'
    });
    this.entrar = el('button', {
      classe: 'botao botao--primario login__entrar',
      texto: 'Entrar',
      atributos: { type: 'submit' }
    });
  }

  montar(alvo: HTMLElement): void {
    document.title = `${this.titulo} · ${NOME_APP}`;

    const mostrar = el('button', {
      classe: 'botao botao--pequeno login__mostrar',
      texto: 'Mostrar senha',
      atributos: {
        type: 'button',
        'aria-pressed': 'false',
        'aria-controls': this.senha.controle.id
      }
    });
    mostrar.addEventListener('click', () => {
      const visivel = this.senha.controle.type === 'password';
      this.senha.controle.type = visivel ? 'text' : 'password';
      mostrar.setAttribute('aria-pressed', String(visivel));
      mostrar.textContent = visivel ? 'Esconder senha' : 'Mostrar senha';
      this.senha.focar();
    });
    this.senha.elemento.append(mostrar, this.avisoCaps);
    this.senha.controle.addEventListener('keyup', (e) => this.conferirCaps(e));
    this.senha.controle.addEventListener('keydown', (e) => this.conferirCaps(e));

    const idTitulo = novoId('login-titulo');
    const formulario = el(
      'form',
      { classe: 'login__cartao', atributos: { novalidate: true, 'aria-labelledby': idTitulo } },
      [
        el('p', { classe: 'login__marca', texto: NOME_APP }),
        el('h1', { texto: 'Entrar no sistema', atributos: { id: idTitulo, tabindex: -1 } }),
        this.mensagem,
        this.email.elemento,
        this.senha.elemento,
        this.entrar
      ]
    );
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      void this.enviar();
    });

    alvo.replaceChildren(el('main', { classe: 'login' }, [formulario]));
    if (this.avisoInicial) this.mostrarMensagem(this.avisoInicial, 'info');
    this.email.focar();
  }

  /** Mostra uma mensagem acima dos campos (erro ou aviso). */
  mostrarMensagem(texto: string, tipo: 'erro' | 'info' = 'erro'): void {
    this.mensagem.textContent = texto;
    this.mensagem.className = `login__mensagem login__mensagem--${tipo}`;
    this.mensagem.hidden = false;
  }

  private conferirCaps(evento: KeyboardEvent): void {
    this.avisoCaps.hidden = !evento.getModifierState?.('CapsLock');
  }

  private async enviar(): Promise<void> {
    const email = this.email.valor.trim();
    const erros: Record<string, string> = {};
    if (!email) erros['email'] = 'Informe o e-mail.';
    if (!this.senha.valor) erros['senha'] = 'Informe a senha.';
    if (aplicarErros([this.email, this.senha], erros)) return;

    this.entrar.disabled = true;
    this.entrar.textContent = 'Entrando...';
    const resposta = await window.api.auth
      .login({ email, senha: this.senha.valor })
      .catch(() => null);
    // A senha não fica no campo depois da tentativa, nem em caso de erro.
    this.senha.valor = '';
    this.entrar.disabled = false;
    this.entrar.textContent = 'Entrar';

    if (resposta?.ok) {
      this.aoEntrar(resposta.dados);
      return;
    }
    this.mostrarMensagem(resposta?.erro.mensagem ?? 'Não foi possível se comunicar com o sistema.');
    if (!aplicarErros([this.email, this.senha], resposta?.erro.campos)) this.senha.focar();
  }
}
