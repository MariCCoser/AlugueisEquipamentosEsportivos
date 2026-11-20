import type { ReservaDTO } from '@shared/dto/reserva.dto';
import type { EstadoConservacao } from '@shared/models/enums';
import { aplicarErros, CampoCheckbox, CampoSelect, CampoTexto } from '../../components/Campos';
import { confirmar } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { hojeISO } from '../../util/datas';
import { formatarData, formatarMoeda, pluralizar } from '../../util/formatadores';
import { ROTULOS_ESTADO_CONSERVACAO, opcoesDe } from '../../util/rotulos';

/**
 * Registro da devolução de uma reserva ATIVA:
 * - data real da devolução (hoje ou antes) e o estado de cada equipamento;
 * - a multa é simulada pelo Main (multas:calcular) a cada troca de data, para a pessoa
 *   ver o valor ANTES de confirmar;
 * - se houver multa e caução retida, dá para abater a multa com a caução.
 * Depois de registrar, se ainda sobrar caução, pergunta se ela já foi devolvida ao cliente.
 */
export class DevolucaoFormulario {
  private readonly data: CampoTexto;
  private readonly estados: CampoSelect[];
  private readonly usarCaucao: CampoCheckbox;
  private readonly avisoMulta = el('div', {
    classe: 'aviso-multa',
    atributos: { role: 'status', 'aria-live': 'polite' }
  });
  private readonly salvar: HTMLButtonElement;
  private readonly modal: Modal;
  private simulacao = 0;

  private constructor(
    private readonly reserva: ReservaDTO,
    private readonly aoConcluir: () => void
  ) {
    const hoje = hojeISO();
    this.data = new CampoTexto({
      nome: 'dataDevolucaoReal',
      rotulo: 'Data da devolução',
      tipo: 'date',
      valor: hoje,
      obrigatorio: true,
      ajuda: `Prevista para ${formatarData(reserva.dataDevolucaoPrevista)}.`
    });
    this.data.controle.max = hoje;
    this.data.controle.min = reserva.dataRetirada;
    this.data.controle.addEventListener('change', () => void this.simularMulta());

    this.estados = reserva.itens.map(
      (item) =>
        new CampoSelect({
          nome: `estado-${item.id}`,
          rotulo: item.equipamentoNome,
          opcoes: opcoesDe(ROTULOS_ESTADO_CONSERVACAO),
          valor: item.estadoRetirada,
          ajuda: `Saiu como: ${ROTULOS_ESTADO_CONSERVACAO[item.estadoRetirada]}.`
        })
    );

    this.usarCaucao = new CampoCheckbox({
      nome: 'reterCaucao',
      rotulo: `Usar a caução (${formatarMoeda(reserva.valorCaucao)}) para abater a multa`,
      marcado: true,
      ajuda: 'O que sobrar da caução continua guardado para devolver ao cliente.'
    });
    this.usarCaucao.elemento.hidden = true;

    const idFormulario = novoId('form-devolucao');
    const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
      el('p', {
        classe: 'texto-suave',
        texto: `${reserva.clienteNome} · retirada em ${formatarData(reserva.dataRetirada)}`
      }),
      this.data.elemento,
      this.avisoMulta,
      el('fieldset', { classe: 'grupo-campos' }, [
        el('legend', { texto: 'Como cada equipamento voltou' }),
        ...this.estados.map((campo) => campo.elemento)
      ]),
      this.usarCaucao.elemento
    ]);
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      void this.enviar();
    });

    this.salvar = el('button', {
      classe: 'botao botao--primario',
      texto: 'Registrar devolução',
      atributos: { type: 'submit', form: idFormulario }
    });
    this.modal = new Modal({
      titulo: `Devolução da reserva #${reserva.id}`,
      conteudo: [formulario],
      rodape: [botao('Cancelar', () => this.modal.fechar()), this.salvar]
    });
  }

  /** Busca a reserva completa (com os itens) e abre o modal. */
  static async abrir(reservaId: number, aoConcluir: () => void): Promise<void> {
    const resposta = await window.api.reservas.buscarPorId({ id: reservaId });
    if (!resposta.ok) return Toast.erro(resposta.erro.mensagem);
    const formulario = new DevolucaoFormulario(resposta.dados, aoConcluir);
    formulario.modal.abrir();
    formulario.data.focar();
    void formulario.simularMulta();
  }

  private async simularMulta(): Promise<void> {
    const data = this.data.valor;
    if (!data) return;
    const numero = ++this.simulacao;
    this.avisoMulta.textContent = 'Calculando multa...';
    const resposta = await window.api.multas
      .calcular({ reservaId: this.reserva.id, dataDevolucao: data })
      .catch(() => null);
    if (numero !== this.simulacao) return;

    if (!resposta?.ok) {
      this.avisoMulta.className = 'aviso-multa';
      this.avisoMulta.textContent = resposta
        ? `Não foi possível calcular a multa: ${resposta.erro.mensagem}`
        : 'Não foi possível calcular a multa.';
      return;
    }
    const { diasAtraso, valor } = resposta.dados;
    const temMulta = diasAtraso > 0 && valor > 0;
    this.avisoMulta.className = temMulta ? 'aviso-multa aviso-multa--atraso' : 'aviso-multa';
    this.avisoMulta.textContent = temMulta
      ? `${pluralizar(diasAtraso, 'dia', 'dias')} de atraso: multa de ${formatarMoeda(valor)}.`
      : '✓ Devolução no prazo: sem multa.';
    this.usarCaucao.elemento.hidden = !(temMulta && this.reserva.caucaoStatus === 'RETIDA');
  }

  private async enviar(): Promise<void> {
    const data = this.data.valor;
    const erros: Record<string, string> = {};
    if (!data) erros['dataDevolucaoReal'] = 'Informe a data da devolução.';
    else if (data > hojeISO()) erros['dataDevolucaoReal'] = 'Use hoje ou uma data passada.';
    else if (data < this.reserva.dataRetirada) {
      erros['dataDevolucaoReal'] = 'A devolução não pode ser antes da retirada.';
    }
    if (aplicarErros([this.data], erros)) return;

    this.salvar.disabled = true;
    this.salvar.textContent = 'Registrando...';
    const resposta = await window.api.reservas
      .registrarDevolucao({
        reservaId: this.reserva.id,
        dataDevolucaoReal: data,
        itens: this.reserva.itens.map((item, i) => ({
          itemReservaId: item.id,
          estadoDevolucao: this.estados[i]!.valor as EstadoConservacao
        })),
        reterCaucao: !this.usarCaucao.elemento.hidden && this.usarCaucao.marcado
      })
      .catch(() => null);
    this.salvar.disabled = false;
    this.salvar.textContent = 'Registrar devolução';

    if (!resposta) return Toast.erro('Não foi possível se comunicar com o sistema.');
    if (!resposta.ok) {
      if (!aplicarErros([this.data], resposta.erro.campos)) Toast.erro(resposta.erro.mensagem);
      return;
    }

    this.modal.fechar();
    const { reserva, multaGerada } = resposta.dados;
    Toast.sucesso(`Devolução da reserva #${reserva.id} registrada.`);
    if (multaGerada && !multaGerada.quitada) {
      const falta = multaGerada.valor - multaGerada.valorPago;
      Toast.erro(
        `Multa de ${formatarMoeda(multaGerada.valor)} lançada; falta pagar ${formatarMoeda(falta)} (veja em Pagamentos).`
      );
    }
    if (reserva.caucaoStatus === 'RETIDA') await DevolucaoFormulario.devolverCaucao(reserva);
    this.aoConcluir();
  }

  /** Fecha o ciclo da caução: devolvida ao cliente agora ou continua guardada. */
  private static async devolverCaucao(reserva: ReservaDTO): Promise<void> {
    const devolver = await confirmar({
      titulo: 'Caução',
      mensagem:
        `A caução de ${formatarMoeda(reserva.valorCaucao)} (ou o que sobrou dela, se abateu a multa) ` +
        'ainda está guardada. Ela já foi devolvida ao cliente?',
      textoConfirmar: 'Sim, foi devolvida',
      textoCancelar: 'Ainda não',
      perigo: false
    });
    if (!devolver) return;
    const resposta = await window.api.pagamentos.devolverCaucao({
      reservaId: reserva.id,
      reter: false
    });
    if (resposta.ok) Toast.sucesso('Caução marcada como devolvida.');
    else Toast.erro(resposta.erro.mensagem);
  }
}
