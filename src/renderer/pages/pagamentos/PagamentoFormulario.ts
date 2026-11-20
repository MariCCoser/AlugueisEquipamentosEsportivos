import type { PagamentoDTO } from '@shared/dto/pagamento.dto';
import type { ReservaDTO } from '@shared/dto/reserva.dto';
import type { FormaPagamento, TipoPagamento } from '@shared/models/enums';
import { aplicarErros, CampoSelect, CampoTexto } from '../../components/Campos';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { botao, el, novoId } from '../../nucleo/dom';
import { lerDinheiro } from '../../util/dinheiro';
import { formatarMoeda } from '../../util/formatadores';
import { ROTULOS_FORMA_PAGAMENTO, opcoesDe } from '../../util/rotulos';

/**
 * Lançamento de pagamento de ALUGUEL ou CAUÇÃO de uma reserva.
 * Ao informar o número da reserva, a tela mostra quanto já foi pago e sugere o que falta.
 * Pagamento de MULTA não é lançado aqui: ele sai pelo botão "Quitar" da aba de multas
 * (multas:quitar), que já marca a multa como paga.
 */
export class PagamentoFormulario {
  private readonly reserva: CampoTexto;
  private readonly tipo: CampoSelect;
  private readonly forma: CampoSelect;
  private readonly valor: CampoTexto;
  private readonly resumo = el('p', {
    classe: 'assistente__escolhido',
    atributos: { 'aria-live': 'polite' }
  });
  private readonly salvar: HTMLButtonElement;
  private readonly modal: Modal;
  private encontrada: ReservaDTO | null = null;
  private busca = 0;

  constructor(
    reservaInicial: number | null,
    private readonly aoSalvar: (pagamento: PagamentoDTO) => void
  ) {
    this.reserva = new CampoTexto({
      nome: 'reservaId',
      rotulo: 'Número da reserva',
      tipo: 'number',
      valor: reservaInicial ? String(reservaInicial) : '',
      obrigatorio: true
    });
    this.reserva.controle.min = '1';
    this.reserva.controle.addEventListener('change', () => void this.buscarReserva());

    this.tipo = new CampoSelect({
      nome: 'tipo',
      rotulo: 'O que está sendo pago',
      opcoes: [
        { valor: 'ALUGUEL', rotulo: 'Aluguel' },
        { valor: 'CAUCAO', rotulo: 'Caução (garantia)' }
      ],
      valor: 'ALUGUEL',
      aoMudar: () => this.sugerirValor()
    });
    this.forma = new CampoSelect({
      nome: 'forma',
      rotulo: 'Forma de pagamento',
      opcoes: opcoesDe(ROTULOS_FORMA_PAGAMENTO),
      valor: 'PIX'
    });
    this.valor = new CampoTexto({
      nome: 'valor',
      rotulo: 'Valor (R$)',
      tipo: 'number',
      obrigatorio: true
    });
    this.valor.controle.min = '0.01';
    this.valor.controle.step = '0.01';

    const idFormulario = novoId('form-pagamento');
    const formulario = el('form', { atributos: { id: idFormulario, novalidate: true } }, [
      this.reserva.elemento,
      this.resumo,
      el('div', { classe: 'grade-2' }, [this.tipo.elemento, this.forma.elemento]),
      this.valor.elemento
    ]);
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      void this.enviar();
    });

    this.salvar = el('button', {
      classe: 'botao botao--primario',
      texto: 'Registrar',
      atributos: { type: 'submit', form: idFormulario }
    });
    this.modal = new Modal({
      titulo: 'Registrar pagamento',
      conteudo: [formulario],
      rodape: [botao('Cancelar', () => this.modal.fechar()), this.salvar]
    });
    if (reservaInicial) void this.buscarReserva();
  }

  abrir(): void {
    this.modal.abrir();
    this.reserva.focar();
  }

  private async buscarReserva(): Promise<void> {
    const id = Number(this.reserva.valor);
    this.encontrada = null;
    this.resumo.textContent = '';
    if (!Number.isInteger(id) || id <= 0) return;
    const numero = ++this.busca;
    this.resumo.textContent = 'Buscando reserva...';
    const resposta = await window.api.reservas.buscarPorId({ id }).catch(() => null);
    if (numero !== this.busca) return;
    if (!resposta?.ok) {
      this.resumo.textContent = '';
      this.reserva.definirErro(resposta?.erro.mensagem ?? 'Não foi possível buscar a reserva.');
      return;
    }
    this.reserva.definirErro(undefined);
    const r = resposta.dados;
    this.encontrada = r;
    this.resumo.textContent =
      `${r.clienteNome} · total ${formatarMoeda(r.valorTotal)} · ` +
      `já pago ${formatarMoeda(r.totalPago)}` +
      (r.valorCaucao > 0 ? ` · caução ${formatarMoeda(r.valorCaucao)}` : '');
    this.sugerirValor();
  }

  /** Sugere o que falta do aluguel, ou o valor da caução combinada. */
  private sugerirValor(): void {
    const r = this.encontrada;
    if (!r) return;
    const sugestao =
      this.tipo.valor === 'CAUCAO' ? r.valorCaucao : Math.max(r.valorTotal - r.totalPago, 0);
    if (sugestao > 0) this.valor.valor = sugestao.toFixed(2);
  }

  private async enviar(): Promise<void> {
    const erros: Record<string, string> = {};
    const reservaId = Number(this.reserva.valor);
    if (!Number.isInteger(reservaId) || reservaId <= 0) {
      erros['reservaId'] = 'Informe o número da reserva.';
    }
    const valor = lerDinheiro(this.valor.valor);
    if (valor.erro !== undefined) erros['valor'] = valor.erro;
    if (aplicarErros([this.reserva, this.tipo, this.forma, this.valor], erros)) return;

    this.salvar.disabled = true;
    const resposta = await window.api.pagamentos
      .criar({
        reservaId,
        tipo: this.tipo.valor as TipoPagamento,
        forma: this.forma.valor as FormaPagamento,
        valor: valor.valor!
      })
      .catch(() => null);
    this.salvar.disabled = false;

    if (!resposta) return Toast.erro('Não foi possível se comunicar com o sistema.');
    if (resposta.ok) {
      Toast.sucesso(`Pagamento de ${formatarMoeda(resposta.dados.valor)} registrado.`);
      this.modal.fechar();
      this.aoSalvar(resposta.dados);
    } else if (
      !aplicarErros([this.reserva, this.tipo, this.forma, this.valor], resposta.erro.campos)
    ) {
      Toast.erro(resposta.erro.mensagem);
    }
  }
}
