import type { CategoriaDTO } from '@shared/dto/categoria.dto';
import type { Resposta } from '@shared/dto/resposta';
import { aplicarErros, CampoCheckbox, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';

/**
 * Modal de cadastro/edição de categoria.
 * A tela faz uma checagem rápida (nome obrigatório) para dar resposta imediata;
 * a validação de verdade é a do Main (categoria.schema.ts), cujos erros por campo
 * aparecem embaixo de cada campo.
 */
export class CategoriaFormulario {
  private readonly nome: CampoTexto;
  private readonly descricao: CampoTexto;
  private readonly sensivelClima: CampoCheckbox;
  private readonly salvar: HTMLButtonElement;
  private readonly modal: Modal;

  constructor(
    private readonly existente: CategoriaDTO | null,
    private readonly aoSalvar: (categoria: CategoriaDTO) => void
  ) {
    this.nome = new CampoTexto({
      nome: 'nome',
      rotulo: 'Nome',
      valor: existente?.nome,
      obrigatorio: true,
      maximo: 60
    });
    this.descricao = new CampoTexto({
      nome: 'descricao',
      rotulo: 'Descrição (opcional)',
      valor: existente?.descricao,
      maximo: 255
    });
    this.sensivelClima = new CampoCheckbox({
      nome: 'sensivelClima',
      rotulo: 'Exibir alerta de previsão do tempo nas reservas desta categoria',
      ajuda: 'Use para itens usados ao ar livre, como caiaque, bicicleta e prancha.',
      marcado: existente?.sensivelClima ?? false
    });

    const idFormulario = novoId('form-categoria');
    const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
      this.nome.elemento,
      this.descricao.elemento,
      this.sensivelClima.elemento
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
      titulo: existente ? `Editar categoria` : 'Nova categoria',
      conteudo: [formulario],
      rodape: [botao('Cancelar', () => this.modal.fechar()), this.salvar]
    });
  }

  abrir(): void {
    this.modal.abrir();
    this.nome.focar();
  }

  private async enviar(): Promise<void> {
    const campos = [this.nome, this.descricao, this.sensivelClima];
    const nome = this.nome.valor.trim();
    if (nome.length < 2) {
      aplicarErros(campos, {
        nome: nome ? 'Nome deve ter pelo menos 2 letras.' : 'Nome é obrigatório.'
      });
      return;
    }
    aplicarErros(campos, undefined);

    const dados = {
      nome,
      descricao: this.descricao.valor.trim(),
      sensivelClima: this.sensivelClima.marcado
    };

    this.ocupado(true);
    let resposta: Resposta<CategoriaDTO>;
    try {
      resposta = this.existente
        ? await window.api.categorias.atualizar({ id: this.existente.id, ...dados })
        : await window.api.categorias.criar(dados);
    } catch {
      resposta = {
        ok: false,
        erro: { codigo: 'INTERNO', mensagem: 'Não foi possível se comunicar com o sistema.' }
      };
    }
    this.ocupado(false);

    if (resposta.ok) {
      Toast.sucesso(this.existente ? 'Categoria atualizada.' : 'Categoria cadastrada.');
      this.modal.fechar();
      this.aoSalvar(resposta.dados);
    } else if (!aplicarErros(campos, resposta.erro.campos)) {
      Toast.erro(resposta.erro.mensagem);
    }
  }

  /** Evita clique duplo enquanto o Main responde. */
  private ocupado(sim: boolean): void {
    this.salvar.disabled = sim;
    this.salvar.textContent = sim ? 'Salvando...' : 'Salvar';
  }
}
