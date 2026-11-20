import { botao, el } from '../nucleo/dom';
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

    const modal = new Modal({
      titulo: opcoes.titulo,
      conteudo: [el('p', { texto: opcoes.mensagem })],
      rodape: [cancelar, confirmarBotao],
      aoFechar: () => resolver(confirmado)
    });

    modal.abrir();
    // Foco inicial no "Cancelar": Enter por engano não exclui nada.
    cancelar.focus();
  });
}
