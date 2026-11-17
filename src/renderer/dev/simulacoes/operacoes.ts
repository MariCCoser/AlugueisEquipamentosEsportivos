import type { IdDTO, ReservaIdDTO } from '@shared/dto';
import type { ClienteDTO } from '@shared/dto/cliente.dto';
import type { EquipamentoDTO, ListarDisponiveisDTO } from '@shared/dto/equipamento.dto';
import type {
  CalcularRotaDTO,
  PrevisaoClimaDTO,
  PrevisaoClimaEntradaDTO,
  RotaDTO
} from '@shared/dto/integracao.dto';
import type {
  CriarManutencaoDTO,
  FiltroManutencaoDTO,
  ManutencaoDTO,
  RegistrarRetornoDTO
} from '@shared/dto/manutencao.dto';
import type {
  CalcularMultaDTO,
  MultaCalculadaDTO,
  MultaDTO,
  QuitarMultaDTO
} from '@shared/dto/multa.dto';
import type { MultaIdDTO, NotificacaoDTO } from '@shared/dto/notificacao.dto';
import type {
  CriarPagamentoDTO,
  DevolverCaucaoDTO,
  FiltroPagamentoDTO,
  PagamentoDTO
} from '@shared/dto/pagamento.dto';
import type {
  CancelarReservaDTO,
  CriarReservaDTO,
  FiltroReservaDTO,
  ItemReservaDTO,
  ReservaAtrasadaDTO,
  ReservaDTO,
  ReservaResumoDTO
} from '@shared/dto/reserva.dto';
import type { DevolucaoResultadoDTO, RegistrarDevolucaoDTO } from '@shared/dto/devolucao.dto';
import type { Paginado } from '@shared/dto/resposta';
import { diariasDoPeriodo, diasEntre, hojeISO, somarDias } from '../../util/datas';
import { ErroSimulado, type Simulacao } from '../apiSimulada';

/** Multa padrão do Main (MultaPercentual): 10% da soma das diárias por dia de atraso. */
const PERCENTUAL_POR_DIA = 10;
const FORNECEDORES_MANUTENCAO: Record<number, string> = {
  3: 'Bike Reparos Oficina ME',
  4: 'Náutica Reparos Ltda'
};

const centavos = (valor: number): number => Math.round(valor * 100) / 100;
const erro = (codigo: 'REGRA_NEGOCIO' | 'NAO_ENCONTRADO' | 'VALIDACAO', mensagem: string) =>
  new ErroSimulado({ codigo, mensagem });

/**
 * Reservas, devoluções, multas, pagamentos, manutenções, notificações, clima e rota
 * em memória (só em desenvolvimento). Juntos num arquivo porque uma operação mexe em
 * várias coisas ao mesmo tempo (ex.: devolver libera o equipamento e gera multa),
 * como nas transações do Main. As datas de exemplo são relativas a hoje, para sempre
 * haver reserva no prazo, vencendo hoje e atrasada.
 */
export function simularOperacoes(equipamentosSim: Simulacao, clientesSim: Simulacao) {
  const hoje = hojeISO();
  const equipamento = (id: number) =>
    (equipamentosSim['buscarPorId'] as (d: IdDTO) => EquipamentoDTO)({ id });
  const todosEquipamentos = () =>
    (equipamentosSim['listar'] as (f: object) => Paginado<EquipamentoDTO>)({ porPagina: 1000 })
      .itens;
  const definirStatus = equipamentosSim['_definirStatus'] as (dados: {
    id: number;
    status: EquipamentoDTO['status'];
    estadoConservacao?: EquipamentoDTO['estadoConservacao'];
  }) => void;
  const cliente = (id: number) => (clientesSim['buscarPorId'] as (d: IdDTO) => ClienteDTO)({ id });

  // ---------- dados de exemplo ----------
  let proximoItem = 1;
  const itensDe = (reservaId: number, ids: number[]): ItemReservaDTO[] =>
    ids.map((equipamentoId) => {
      const e = equipamento(equipamentoId);
      return {
        id: proximoItem++,
        reservaId,
        equipamentoId,
        equipamentoNome: e.nome,
        valorDiaria: e.valorDiaria ?? 0,
        estadoRetirada: e.estadoConservacao
      };
    });

  type Reserva = Omit<ReservaDTO, 'totalPago' | 'multa' | 'clienteNome'>;
  const nova = (
    id: number,
    clienteId: number,
    status: Reserva['status'],
    retirada: number,
    devolucao: number,
    equipamentoIds: number[],
    valorCaucao = 0
  ): Reserva => {
    const itens = itensDe(id, equipamentoIds);
    const dataRetirada = somarDias(hoje, retirada);
    const dataDevolucaoPrevista = somarDias(hoje, devolucao);
    const diarias = diariasDoPeriodo(dataRetirada, dataDevolucaoPrevista);
    return {
      id,
      clienteId,
      usuarioId: 1,
      status,
      dataRetirada,
      dataDevolucaoPrevista,
      valorTotal: centavos(itens.reduce((t, i) => t + i.valorDiaria, 0) * diarias),
      valorCaucao,
      caucaoStatus: valorCaucao > 0 ? 'RETIDA' : 'NAO_APLICAVEL',
      itens
    };
  };

  const reservas: Reserva[] = [
    nova(1, 1, 'ATIVA', -7, -3, [1], 100),
    nova(2, 2, 'ATIVA', -2, 1, [4]),
    nova(3, 4, 'ATIVA', -1, 0, [7]),
    nova(4, 3, 'PENDENTE', 2, 4, [5], 50),
    { ...nova(5, 1, 'DEVOLVIDA', -60, -58, [2, 8]), dataDevolucaoReal: somarDias(hoje, -56) }
  ];
  let proximaReserva = 6;

  const multas: Omit<MultaDTO, 'clienteNome' | 'valorPago'>[] = [
    { id: 1, reservaId: 5, diasAtraso: 2, valor: 20, quitada: false }
  ];
  let proximaMulta = 2;

  const agoraTexto = (dias = 0) => `${somarDias(hoje, dias)} 10:00:00`;
  const pagamentos: PagamentoDTO[] = [
    { id: 1, reservaId: 1, tipo: 'ALUGUEL', forma: 'PIX', valor: 180, data: agoraTexto(-7) },
    { id: 2, reservaId: 1, tipo: 'CAUCAO', forma: 'DINHEIRO', valor: 100, data: agoraTexto(-7) },
    { id: 3, reservaId: 2, tipo: 'ALUGUEL', forma: 'CARTAO', valor: 270, data: agoraTexto(-2) },
    { id: 4, reservaId: 5, tipo: 'ALUGUEL', forma: 'PIX', valor: 200, data: agoraTexto(-60) },
    {
      id: 5,
      reservaId: 5,
      multaId: 1,
      tipo: 'MULTA',
      forma: 'PIX',
      valor: 5,
      data: agoraTexto(-56)
    }
  ];
  let proximoPagamento = 6;

  const manutencoes: Omit<ManutencaoDTO, 'equipamentoNome' | 'fornecedorNome'>[] = [
    {
      id: 1,
      equipamentoId: 3,
      fornecedorId: 3,
      tipo: 'CORRETIVA',
      descricao: 'Troca do câmbio traseiro',
      dataEnvio: somarDias(hoje, -5)
    },
    {
      id: 2,
      equipamentoId: 6,
      fornecedorId: 4,
      tipo: 'PREVENTIVA',
      descricao: 'Revisão das quilhas',
      dataEnvio: somarDias(hoje, -40),
      dataRetorno: somarDias(hoje, -35),
      custo: 80,
      estadoRetorno: 'MEDIO'
    }
  ];
  let proximaManutencao = 3;

  // ---------- montagem dos DTOs ----------
  const pagoNaReserva = (id: number) =>
    centavos(pagamentos.filter((p) => p.reservaId === id).reduce((t, p) => t + p.valor, 0));
  const multaDTO = (m: (typeof multas)[number]): MultaDTO => {
    const r = obterReserva(m.reservaId);
    const valorPago = centavos(
      pagamentos.filter((p) => p.multaId === m.id).reduce((t, p) => t + p.valor, 0)
    );
    return { ...m, clienteNome: cliente(r.clienteId).nome, valorPago };
  };
  const completa = (r: Reserva): ReservaDTO => {
    const multa = multas.find((m) => m.reservaId === r.id);
    return {
      ...r,
      clienteNome: cliente(r.clienteId).nome,
      totalPago: pagoNaReserva(r.id),
      ...(multa ? { multa: multaDTO(multa) } : {})
    };
  };
  const resumo = (r: Reserva): ReservaResumoDTO => {
    const completo: Partial<ReservaDTO> & ReservaResumoDTO = {
      ...completa(r),
      qtdItens: r.itens.length
    };
    delete completo.itens;
    delete completo.multa;
    return completo;
  };
  const obterReserva = (id: number): Reserva => {
    const r = reservas.find((x) => x.id === id);
    if (!r) throw erro('NAO_ENCONTRADO', `Reserva #${id} não encontrado(a).`);
    return r;
  };
  const somaDiarias = (r: Reserva) => r.itens.reduce((t, i) => t + i.valorDiaria, 0);
  const calcularMulta = (r: Reserva, data: string): MultaCalculadaDTO => {
    const diasAtraso = Math.max(0, diasEntre(r.dataDevolucaoPrevista, data));
    return {
      diasAtraso,
      valor: centavos((somaDiarias(r) * PERCENTUAL_POR_DIA * diasAtraso) / 100),
      estrategia: 'PERCENTUAL'
    };
  };
  const ocupa = (r: Reserva) => r.status === 'PENDENTE' || r.status === 'ATIVA';
  const conflita = (r: Reserva, inicio: string, fim: string) =>
    diasEntre(inicio, r.dataDevolucaoPrevista) >= 0 && diasEntre(r.dataRetirada, fim) >= 0;

  const manutencaoDTO = (m: (typeof manutencoes)[number]): ManutencaoDTO => ({
    ...m,
    equipamentoNome: equipamento(m.equipamentoId).nome,
    fornecedorNome: FORNECEDORES_MANUTENCAO[m.fornecedorId] ?? `Fornecedor #${m.fornecedorId}`
  });

  const notificacao = (
    tipo: NotificacaoDTO['tipo'],
    clienteId: number,
    mensagem: string
  ): NotificacaoDTO => {
    const c = cliente(clienteId);
    return {
      id: `sim-${Date.now()}`,
      tipo,
      canal: c.email ? 'EMAIL' : 'WHATSAPP',
      destinatario: c.email ?? c.telefone,
      mensagem,
      enviadaEm: new Date().toISOString(),
      simulada: true
    };
  };

  // ---------- canais ----------
  const listarDisponiveis = ({
    dataRetirada,
    dataDevolucaoPrevista,
    categoriaId
  }: ListarDisponiveisDTO) =>
    todosEquipamentos().filter(
      (e) =>
        e.modalidade === 'LOCACAO' &&
        e.status !== 'INDISPONIVEL' &&
        e.status !== 'EM_MANUTENCAO' &&
        (!categoriaId || e.categoriaId === categoriaId) &&
        !reservas.some(
          (r) =>
            ocupa(r) &&
            r.itens.some((i) => i.equipamentoId === e.id) &&
            conflita(r, dataRetirada, dataDevolucaoPrevista)
        )
    );

  const reservasSim: Simulacao = {
    listar: (filtro: FiltroReservaDTO = {}): Paginado<ReservaResumoDTO> => {
      const lista = reservas
        .filter((r) => !filtro.status || r.status === filtro.status)
        .filter((r) => !filtro.clienteId || r.clienteId === filtro.clienteId)
        .map(resumo);
      return { itens: lista, total: lista.length, pagina: 1, porPagina: filtro.porPagina ?? 20 };
    },
    buscarPorId: ({ id }: IdDTO) => completa(obterReserva(id)),
    criar: (dados: CriarReservaDTO) => {
      if (diasEntre(hoje, dados.dataRetirada) < 0) {
        throw erro('VALIDACAO', 'A data de retirada não pode estar no passado.');
      }
      const livres = new Set(listarDisponiveis(dados).map((e) => e.id));
      const ocupado = dados.itens.find((i) => !livres.has(i.equipamentoId));
      if (ocupado) {
        throw erro(
          'REGRA_NEGOCIO',
          `"${equipamento(ocupado.equipamentoId).nome}" não está disponível no período.`
        );
      }
      const id = proximaReserva++;
      const r = nova(
        id,
        dados.clienteId,
        'PENDENTE',
        0,
        0,
        dados.itens.map((i) => i.equipamentoId),
        dados.valorCaucao
      );
      r.dataRetirada = dados.dataRetirada;
      r.dataDevolucaoPrevista = dados.dataDevolucaoPrevista;
      r.valorTotal = centavos(
        somaDiarias(r) * diariasDoPeriodo(r.dataRetirada, r.dataDevolucaoPrevista)
      );
      if (dados.observacoes) r.observacoes = dados.observacoes;
      reservas.push(r);
      return completa(r);
    },
    confirmarRetirada: ({ id }: IdDTO) => {
      const r = obterReserva(id);
      if (r.status !== 'PENDENTE')
        throw erro('REGRA_NEGOCIO', 'Só reservas pendentes podem ser retiradas.');
      for (const i of r.itens) definirStatus({ id: i.equipamentoId, status: 'RESERVADO' });
      r.status = 'ATIVA';
      return completa(r);
    },
    cancelar: ({ id }: CancelarReservaDTO) => {
      const r = obterReserva(id);
      if (!ocupa(r)) throw erro('REGRA_NEGOCIO', 'Esta reserva já foi encerrada.');
      if (r.status === 'ATIVA')
        for (const i of r.itens) definirStatus({ id: i.equipamentoId, status: 'DISPONIVEL' });
      r.status = 'CANCELADA';
      return completa(r);
    },
    listarAtivas: () => reservas.filter((r) => r.status === 'ATIVA').map(resumo),
    listarAtrasadas: (): ReservaAtrasadaDTO[] =>
      reservas
        .filter((r) => r.status === 'ATIVA' && diasEntre(r.dataDevolucaoPrevista, hoje) > 0)
        .map((r) => {
          const multa = calcularMulta(r, hoje);
          return { ...resumo(r), diasAtraso: multa.diasAtraso, multaPrevista: multa.valor };
        }),
    registrarDevolucao: (dados: RegistrarDevolucaoDTO): DevolucaoResultadoDTO => {
      const r = obterReserva(dados.reservaId);
      if (r.status !== 'ATIVA')
        throw erro('REGRA_NEGOCIO', 'Só reservas ativas podem ser devolvidas.');
      if (diasEntre(hoje, dados.dataDevolucaoReal) > 0) {
        throw new ErroSimulado({
          codigo: 'VALIDACAO',
          mensagem: 'A data de devolução não pode estar no futuro.',
          campos: { dataDevolucaoReal: 'Use hoje ou uma data passada.' }
        });
      }
      for (const item of r.itens) {
        const estado = dados.itens.find((i) => i.itemReservaId === item.id)?.estadoDevolucao;
        if (estado) item.estadoDevolucao = estado;
        definirStatus({ id: item.equipamentoId, status: 'DISPONIVEL', estadoConservacao: estado });
      }
      r.status = 'DEVOLVIDA';
      r.dataDevolucaoReal = dados.dataDevolucaoReal;

      const calculada = calcularMulta(r, dados.dataDevolucaoReal);
      if (calculada.diasAtraso > 0) {
        const multa = {
          id: proximaMulta++,
          reservaId: r.id,
          diasAtraso: calculada.diasAtraso,
          valor: calculada.valor,
          quitada: false
        };
        multas.push(multa);
        if (dados.reterCaucao && r.caucaoStatus === 'RETIDA') {
          // Abate com a caução já paga, como o DevolucaoService.abaterComCaucao.
          const caucao = pagamentos.find((p) => p.reservaId === r.id && p.tipo === 'CAUCAO');
          if (caucao) {
            const usar = Math.min(caucao.valor, multa.valor);
            caucao.valor = centavos(caucao.valor - usar);
            pagamentos.push({
              id: proximoPagamento++,
              reservaId: r.id,
              multaId: multa.id,
              tipo: 'MULTA',
              forma: caucao.forma,
              valor: usar,
              data: agoraTexto()
            });
            if (usar >= multa.valor) multa.quitada = true;
          }
        }
      }
      const dto = completa(r);
      return {
        reserva: dto,
        ...(dto.multa ? { multaGerada: dto.multa } : {}),
        equipamentosLiberados: r.itens.map((i) => i.equipamentoId)
      };
    }
  };

  const multasSim: Simulacao = {
    calcular: ({ reservaId, dataDevolucao }: CalcularMultaDTO) =>
      calcularMulta(obterReserva(reservaId), dataDevolucao),
    listarEmAberto: () => multas.filter((m) => !m.quitada).map(multaDTO),
    listar: () => multas.map(multaDTO),
    quitar: ({ multaId, forma }: QuitarMultaDTO) => {
      const m = multas.find((x) => x.id === multaId);
      if (!m) throw erro('NAO_ENCONTRADO', `Multa #${multaId} não encontrado(a).`);
      const falta = centavos(m.valor - multaDTO(m).valorPago);
      if (falta > 0) {
        pagamentos.push({
          id: proximoPagamento++,
          reservaId: m.reservaId,
          multaId,
          tipo: 'MULTA',
          forma,
          valor: falta,
          data: agoraTexto()
        });
      }
      m.quitada = true;
      return multaDTO(m);
    }
  };

  const pagamentosSim: Simulacao = {
    listar: (filtro: FiltroPagamentoDTO = {}) =>
      pagamentos
        .filter((p) => p.valor > 0)
        .filter((p) => !filtro.tipo || p.tipo === filtro.tipo)
        .filter((p) => !filtro.dataInicio || p.data.slice(0, 10) >= filtro.dataInicio)
        .filter((p) => !filtro.dataFim || p.data.slice(0, 10) <= filtro.dataFim)
        .sort((a, b) => b.data.localeCompare(a.data)),
    listarPorReserva: ({ reservaId }: ReservaIdDTO) =>
      pagamentos.filter((p) => p.reservaId === reservaId),
    criar: (dados: CriarPagamentoDTO) => {
      const r = obterReserva(dados.reservaId);
      if (r.status === 'CANCELADA') throw erro('REGRA_NEGOCIO', 'A reserva foi cancelada.');
      const novo: PagamentoDTO = { ...dados, id: proximoPagamento++, data: agoraTexto() };
      pagamentos.push(novo);
      return novo;
    },
    devolverCaucao: ({ reservaId, reter }: DevolverCaucaoDTO) => {
      const r = obterReserva(reservaId);
      if (r.caucaoStatus !== 'RETIDA')
        throw erro('REGRA_NEGOCIO', 'Esta reserva não tem caução guardada.');
      if (!reter) r.caucaoStatus = 'DEVOLVIDA';
      return completa(r);
    }
  };

  const manutencoesSim: Simulacao = {
    listar: (filtro: FiltroManutencaoDTO = {}) =>
      manutencoes
        .filter((m) => filtro.abertas === undefined || !m.dataRetorno === filtro.abertas)
        .map(manutencaoDTO)
        .sort((a, b) => b.dataEnvio.localeCompare(a.dataEnvio)),
    listarAbertas: () => manutencoes.filter((m) => !m.dataRetorno).map(manutencaoDTO),
    criar: (dados: CriarManutencaoDTO) => {
      const e = equipamento(dados.equipamentoId);
      if (e.status !== 'DISPONIVEL')
        throw erro('REGRA_NEGOCIO', `"${e.nome}" não está disponível para ir ao conserto.`);
      const m = { ...dados, id: proximaManutencao++ };
      manutencoes.push(m);
      definirStatus({ id: e.id, status: 'EM_MANUTENCAO' });
      return manutencaoDTO(m);
    },
    registrarRetorno: ({ id, dataRetorno, custo, estadoRetorno }: RegistrarRetornoDTO) => {
      const m = manutencoes.find((x) => x.id === id);
      if (!m) throw erro('NAO_ENCONTRADO', `Manutenção #${id} não encontrado(a).`);
      if (m.dataRetorno)
        throw erro('REGRA_NEGOCIO', 'O retorno desta manutenção já foi registrado.');
      Object.assign(m, { dataRetorno, estadoRetorno }, custo !== undefined ? { custo } : {});
      definirStatus({
        id: m.equipamentoId,
        status: 'DISPONIVEL',
        estadoConservacao: estadoRetorno
      });
      return manutencaoDTO(m);
    }
  };

  const notificacoesSim: Simulacao = {
    enviarLembrete: ({ reservaId }: ReservaIdDTO) => {
      const r = obterReserva(reservaId);
      return notificacao(
        'LEMBRETE_DEVOLUCAO',
        r.clienteId,
        `Lembrete: devolver até ${r.dataDevolucaoPrevista}.`
      );
    },
    enviarAvisoMulta: ({ multaId }: MultaIdDTO) => {
      const m = multas.find((x) => x.id === multaId);
      if (!m) throw erro('NAO_ENCONTRADO', `Multa #${multaId} não encontrado(a).`);
      return notificacao(
        'AVISO_MULTA',
        obterReserva(m.reservaId).clienteId,
        `Multa de R$ ${m.valor}.`
      );
    }
  };

  const integracoesSim: Simulacao = {
    /** Chuva forte no Sul, tempo bom no resto (para ver o alerta e o caso sem alerta). */
    previsaoClima: ({
      cidade,
      uf,
      data,
      equipamentoIds
    }: PrevisaoClimaEntradaDTO): PrevisaoClimaDTO => {
      const chuvoso = ['SC', 'PR', 'RS'].includes(uf);
      const categorias = [
        ...new Set(
          equipamentoIds
            .map(equipamento)
            .filter((e) => e.sensivelClima)
            .map((e) => e.categoriaNome)
        )
      ];
      return {
        cidade,
        data,
        temperaturaMinima: chuvoso ? 14 : 19,
        temperaturaMaxima: chuvoso ? 19 : 29,
        chanceDeChuva: chuvoso ? 85 : 10,
        descricao: chuvoso ? 'Chuva forte com rajadas de vento' : 'Céu limpo',
        alerta: chuvoso && categorias.length > 0,
        ...(chuvoso ? { mensagemAlerta: `Chuva forte prevista em ${cidade}.` } : {}),
        categoriasSensiveis: categorias
      };
    },
    calcularRota: ({ clienteId }: CalcularRotaDTO): RotaDTO => {
      const c = cliente(clienteId);
      const destino = `${c.rua}, ${c.numero} - ${c.bairro}, ${c.cidade}/${c.uf}`;
      return {
        distanciaKm: 12.4 + clienteId,
        duracaoMinutos: 25 + clienteId * 7,
        enderecoDestino: destino,
        linkMapa: `https://www.openstreetmap.org/search?query=${encodeURIComponent(destino)}`
      };
    }
  };

  return {
    listarDisponiveis,
    reservas: reservasSim,
    multas: multasSim,
    pagamentos: pagamentosSim,
    manutencoes: manutencoesSim,
    notificacoes: notificacoesSim,
    integracoes: integracoesSim
  };
}
