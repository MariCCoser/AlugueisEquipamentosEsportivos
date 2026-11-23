import { aplicarErros, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { SENHA_MINIMO } from './UsuarioFormulario';

/**
 * Troca da própria senha (canal auth:alterarSenha). Pede a senha atual para confirmar
 * que é a própria pessoa (alguém que achou o computador destravado não troca a senha).
 */
export function abrirAlterarSenha(): void {
  const campo = (nome: string, rotulo: string, ajuda?: string) =>
    new CampoTexto({
      nome,
      rotulo,
      tipo: 'password',
      obrigatorio: true,
      autocompletar: nome === 'senhaAtual' ? 'current-password' : 'new-password',
      ajuda
    });
  const atual = campo('senhaAtual', 'Senha atual');
  const nova = campo('novaSenha', 'Nova senha', `Pelo menos ${SENHA_MINIMO} caracteres.`);
  const repetir = campo('confirmacao', 'Repita a nova senha');
  const campos = [atual, nova, repetir];

  const idFormulario = novoId('form-senha');
  const salvar = el('button', {
    classe: 'botao botao--primario',
    texto: 'Trocar senha',
    atributos: { type: 'submit', form: idFormulario }
  });
  const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
    atual.elemento,
    nova.elemento,
    repetir.elemento
  ]);
  const modal: Modal = new Modal({
    titulo: 'Trocar minha senha',
    conteudo: [formulario],
    rodape: [botao('Cancelar', () => modal.fechar()), salvar],
    // As senhas digitadas não ficam nos campos depois que o modal fecha.
    aoFechar: () => campos.forEach((c) => (c.valor = ''))
  });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    void (async () => {
      const erros: Record<string, string> = {};
      if (!atual.valor) erros['senhaAtual'] = 'Informe a senha atual.';
      if (nova.valor.length < SENHA_MINIMO) {
        erros['novaSenha'] = `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`;
      } else if (nova.valor === atual.valor) {
        erros['novaSenha'] = 'A nova senha precisa ser diferente da atual.';
      } else if (nova.valor !== repetir.valor) {
        erros['confirmacao'] = 'As senhas não são iguais.';
      }
      if (aplicarErros(campos, erros)) return;

      salvar.disabled = true;
      const resposta = await window.api.auth
        .alterarSenha({ senhaAtual: atual.valor, novaSenha: nova.valor })
        .catch(() => null);
      salvar.disabled = false;
      if (!resposta) return Toast.erro('Não foi possível se comunicar com o sistema.');
      if (resposta.ok) {
        Toast.sucesso('Senha trocada. Use a nova senha no próximo login.');
        modal.fechar();
      } else if (!aplicarErros(campos, resposta.erro.campos)) {
        Toast.erro(resposta.erro.mensagem);
      }
    })();
  });

  modal.abrir();
  atual.focar();
}
