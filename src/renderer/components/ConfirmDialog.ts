import { botao, el, novoId } from '../nucleo/dom';
import { Modal } from './Modal';

export interface OpcoesConfirmacao {
  titulo: string;
  /** Deve citar o item: "Excluir a categoria Caiaque?" */
  mensagem: string;
  textoConfirmar?: string;
  /** Texto do botão que só fecha (padrão: "Cancelar"). */
  textoCancelar?: string;
  /** Botão vermelho para ações destrutivas (padrão: true). */
  perigo?: boolean;
}

/**
 * Pergunta antes de uma ação irreversível (ex.: excluir).
 * Devolve `true` só se o usuário clicar em confirmar; Esc, × e Cancelar devolvem `false`.
 *
 *   if (await confirmar({ titulo: 'Excluir categoria', mensagem: `Excluir a categoria ${c.nome}?` })) { ... }
 */
export function confirmar(opcoes: OpcoesConfirmacao): Promise<boolean> {
  return new Promise((resolver) => {
    let confirmado = false;

    const cancelar = botao(opcoes.textoCancelar ?? 'Cancelar', () => modal.fechar());
    const confirmarBotao = botao(
      opcoes.textoConfirmar ?? 'Excluir',
      () => {
        confirmado = true;
        modal.fechar();
      },
      opcoes.perigo === false ? 'primario' : 'perigo'
    );

    // A pergunta é lida junto com o título quando o diálogo abre.
    const idMensagem = novoId('confirmacao');
    const modal = new Modal({
      titulo: opcoes.titulo,
      conteudo: [el('p', { texto: opcoes.mensagem, atributos: { id: idMensagem } })],
      descritoPor: idMensagem,
      rodape: [cancelar, confirmarBotao],
      aoFechar: () => resolver(confirmado)
    });

    modal.abrir();
    // Foco inicial no "Cancelar": Enter por engano não exclui nada.
    cancelar.focus();
  });
}
