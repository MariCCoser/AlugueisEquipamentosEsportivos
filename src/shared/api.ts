import type {
  AlterarSenhaDTO,
  AlterarStatusEquipamentoDTO,
  AppInfoDTO,
  AtualizarCategoriaDTO,
  AtualizarClienteDTO,
  AtualizarEquipamentoDTO,
  AtualizarFornecedorDTO,
  AtualizarItemReservaDTO,
  AtualizarManutencaoDTO,
  AtualizarMultaDTO,
  AtualizarPagamentoDTO,
  AtualizarReservaDTO,
  AtualizarUsuarioDTO,
  BuscarCepDTO,
  CalcularMultaDTO,
  CalcularRotaDTO,
  CancelarReservaDTO,
  CategoriaDTO,
  ClienteDTO,
  CriarCategoriaDTO,
  CriarClienteDTO,
  CriarEquipamentoDTO,
  CriarFornecedorDTO,
  CriarItemReservaDTO,
  CriarManutencaoDTO,
  CriarMultaDTO,
  CriarPagamentoDTO,
  CriarReservaDTO,
  CriarUsuarioDTO,
  DashboardResumoDTO,
  DevolucaoResultadoDTO,
  DevolverCaucaoDTO,
  DisponibilidadeDTO,
  EnderecoDTO,
  EquipamentoDTO,
  EquipamentoIdDTO,
  FiltroClienteDTO,
  FiltroEquipamentoDTO,
  FiltroFornecedorDTO,
  FiltroManutencaoDTO,
  FiltroMultaDTO,
  FiltroPagamentoDTO,
  FiltroReservaDTO,
  FiltroUsuarioDTO,
  FornecedorDTO,
  HistoricoClienteDTO,
  IdDTO,
  ItemReservaDTO,
  ListarDisponiveisDTO,
  LoginDTO,
  ManutencaoDTO,
  MultaCalculadaDTO,
  MultaDTO,
  MultaIdDTO,
  NotificacaoDTO,
  PagamentoDTO,
  Paginado,
  PrevisaoClimaDTO,
  PrevisaoClimaEntradaDTO,
  QuitarMultaDTO,
  RegistrarDevolucaoDTO,
  RegistrarRetornoDTO,
  ReservaAtrasadaDTO,
  ReservaDTO,
  ReservaIdDTO,
  ReservaResumoDTO,
  Resposta,
  RotaDTO,
  StatusBancoDTO,
  TipoFornecedorDTO,
  UsuarioDTO,
  UsuarioSessaoDTO,
  VerificarDisponibilidadeDTO
} from './dto';

/** Toda função da API devolve uma Promise com `{ ok: true, dados }` ou `{ ok: false, erro }`. */
type Retorna<T> = Promise<Resposta<T>>;

/**
 * Tudo o que a tela pode pedir ao sistema, exposto pelo preload em `window.api`.
 * Cada função corresponde a um canal de `ipc-channels.ts`.
 *
 * Exemplo na tela:
 * ```ts
 * const resposta = await window.api.clientes.buscarPorId({ id: 3 });
 * if (resposta.ok) mostrar(resposta.dados);
 * else avisar(resposta.erro.mensagem);
 * ```
 */
export interface ApiExposta {
  app: {
    info(): Retorna<AppInfoDTO>;
    statusBanco(): Retorna<StatusBancoDTO>;
  };

  auth: {
    login(dados: LoginDTO): Retorna<UsuarioSessaoDTO>;
    logout(): Retorna<void>;
    /** `null` quando ninguém está logado. */
    sessaoAtual(): Retorna<UsuarioSessaoDTO | null>;
    alterarSenha(dados: AlterarSenhaDTO): Retorna<void>;
  };

  usuarios: {
    criar(dados: CriarUsuarioDTO): Retorna<UsuarioDTO>;
    listar(filtro?: FiltroUsuarioDTO): Retorna<UsuarioDTO[]>;
    buscarPorId(dados: IdDTO): Retorna<UsuarioDTO>;
    atualizar(dados: AtualizarUsuarioDTO): Retorna<UsuarioDTO>;
    excluir(dados: IdDTO): Retorna<void>;
  };

  clientes: {
    criar(dados: CriarClienteDTO): Retorna<ClienteDTO>;
    listar(filtro?: FiltroClienteDTO): Retorna<Paginado<ClienteDTO>>;
    buscarPorId(dados: IdDTO): Retorna<ClienteDTO>;
    atualizar(dados: AtualizarClienteDTO): Retorna<ClienteDTO>;
    excluir(dados: IdDTO): Retorna<void>;
    historico(dados: IdDTO): Retorna<HistoricoClienteDTO>;
  };

  categorias: {
    criar(dados: CriarCategoriaDTO): Retorna<CategoriaDTO>;
    listar(): Retorna<CategoriaDTO[]>;
    buscarPorId(dados: IdDTO): Retorna<CategoriaDTO>;
    atualizar(dados: AtualizarCategoriaDTO): Retorna<CategoriaDTO>;
    excluir(dados: IdDTO): Retorna<void>;
  };

  fornecedores: {
    criar(dados: CriarFornecedorDTO): Retorna<FornecedorDTO>;
    listar(filtro?: FiltroFornecedorDTO): Retorna<FornecedorDTO[]>;
    listarPorTipo(dados: TipoFornecedorDTO): Retorna<FornecedorDTO[]>;
    buscarPorId(dados: IdDTO): Retorna<FornecedorDTO>;
    atualizar(dados: AtualizarFornecedorDTO): Retorna<FornecedorDTO>;
    excluir(dados: IdDTO): Retorna<void>;
  };

  equipamentos: {
    criar(dados: CriarEquipamentoDTO): Retorna<EquipamentoDTO>;
    listar(filtro?: FiltroEquipamentoDTO): Retorna<Paginado<EquipamentoDTO>>;
    buscarPorId(dados: IdDTO): Retorna<EquipamentoDTO>;
    atualizar(dados: AtualizarEquipamentoDTO): Retorna<EquipamentoDTO>;
    excluir(dados: IdDTO): Retorna<void>;
    verificarDisponibilidade(dados: VerificarDisponibilidadeDTO): Retorna<DisponibilidadeDTO>;
    listarDisponiveis(dados: ListarDisponiveisDTO): Retorna<EquipamentoDTO[]>;
    alterarStatus(dados: AlterarStatusEquipamentoDTO): Retorna<EquipamentoDTO>;
  };

  reservas: {
    criar(dados: CriarReservaDTO): Retorna<ReservaDTO>;
    listar(filtro?: FiltroReservaDTO): Retorna<Paginado<ReservaResumoDTO>>;
    buscarPorId(dados: IdDTO): Retorna<ReservaDTO>;
    atualizar(dados: AtualizarReservaDTO): Retorna<ReservaDTO>;
    excluir(dados: IdDTO): Retorna<void>;
    confirmarRetirada(dados: IdDTO): Retorna<ReservaDTO>;
    cancelar(dados: CancelarReservaDTO): Retorna<ReservaDTO>;
    listarAtivas(): Retorna<ReservaResumoDTO[]>;
    listarAtrasadas(): Retorna<ReservaAtrasadaDTO[]>;
    registrarDevolucao(dados: RegistrarDevolucaoDTO): Retorna<DevolucaoResultadoDTO>;
  };

  itensReserva: {
    criar(dados: CriarItemReservaDTO): Retorna<ItemReservaDTO>;
    listarPorReserva(dados: ReservaIdDTO): Retorna<ItemReservaDTO[]>;
    buscarPorId(dados: IdDTO): Retorna<ItemReservaDTO>;
    atualizar(dados: AtualizarItemReservaDTO): Retorna<ItemReservaDTO>;
    excluir(dados: IdDTO): Retorna<void>;
  };

  multas: {
    calcular(dados: CalcularMultaDTO): Retorna<MultaCalculadaDTO>;
    criar(dados: CriarMultaDTO): Retorna<MultaDTO>;
    listar(filtro?: FiltroMultaDTO): Retorna<MultaDTO[]>;
    listarEmAberto(): Retorna<MultaDTO[]>;
    buscarPorId(dados: IdDTO): Retorna<MultaDTO>;
    atualizar(dados: AtualizarMultaDTO): Retorna<MultaDTO>;
    excluir(dados: IdDTO): Retorna<void>;
    quitar(dados: QuitarMultaDTO): Retorna<MultaDTO>;
  };

  manutencoes: {
    criar(dados: CriarManutencaoDTO): Retorna<ManutencaoDTO>;
    listar(filtro?: FiltroManutencaoDTO): Retorna<ManutencaoDTO[]>;
    listarAbertas(): Retorna<ManutencaoDTO[]>;
    listarPorEquipamento(dados: EquipamentoIdDTO): Retorna<ManutencaoDTO[]>;
    buscarPorId(dados: IdDTO): Retorna<ManutencaoDTO>;
    atualizar(dados: AtualizarManutencaoDTO): Retorna<ManutencaoDTO>;
    registrarRetorno(dados: RegistrarRetornoDTO): Retorna<ManutencaoDTO>;
    excluir(dados: IdDTO): Retorna<void>;
  };

  pagamentos: {
    criar(dados: CriarPagamentoDTO): Retorna<PagamentoDTO>;
    listar(filtro?: FiltroPagamentoDTO): Retorna<PagamentoDTO[]>;
    listarPorReserva(dados: ReservaIdDTO): Retorna<PagamentoDTO[]>;
    buscarPorId(dados: IdDTO): Retorna<PagamentoDTO>;
    atualizar(dados: AtualizarPagamentoDTO): Retorna<PagamentoDTO>;
    excluir(dados: IdDTO): Retorna<void>;
    devolverCaucao(dados: DevolverCaucaoDTO): Retorna<ReservaDTO>;
  };

  integracoes: {
    buscarCep(dados: BuscarCepDTO): Retorna<EnderecoDTO>;
    previsaoClima(dados: PrevisaoClimaEntradaDTO): Retorna<PrevisaoClimaDTO>;
    calcularRota(dados: CalcularRotaDTO): Retorna<RotaDTO>;
  };

  notificacoes: {
    enviarLembrete(dados: ReservaIdDTO): Retorna<NotificacaoDTO>;
    enviarAvisoMulta(dados: MultaIdDTO): Retorna<NotificacaoDTO>;
  };

  dashboard: {
    resumo(): Retorna<DashboardResumoDTO>;
  };
}
