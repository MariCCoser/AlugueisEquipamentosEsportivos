import type { RotaDTO } from '@shared/dto/integracao.dto';
import type { Cliente } from '@shared/models/entidades';
import { NaoEncontradoError } from '../../errors/ErroApp';
import type { RotasClient } from '../../integrations/RotasClient';
import type { ClienteRepository } from '../../repositories/ClienteRepository';

/**
 * Rota da loja até o cliente com devolução atrasada, para buscar o equipamento
 * pessoalmente (Pessoa 3, API 3). A tela usa na aba Devoluções → Atrasadas.
 *
 * LGPD: para o mapa vai só o endereço (rua, número, bairro, cidade, UF e CEP).
 * Nome, CPF, telefone, e-mail e complemento do cliente não saem do computador.
 */
export class RotaService {
  constructor(
    private readonly rotas: Pick<RotasClient, 'localizar' | 'calcular'>,
    private readonly clientes: Pick<ClienteRepository, 'buscarPorId'>,
    /** Endereço da loja (LOJA_ENDERECO no .env): ponto de partida da rota. */
    private readonly enderecoLoja: string,
    private readonly linkMapa: typeof RotasClient.linkMapa
  ) {}

  async calcular(clienteId: number): Promise<RotaDTO> {
    const cliente = await this.clientes.buscarPorId(clienteId);
    if (!cliente) throw new NaoEncontradoError('Cliente', clienteId);

    const origem = await this.rotas.localizar([this.enderecoLoja]);
    const destino = await this.rotas.localizar(RotaService.tentativasDeEndereco(cliente));
    const trecho = await this.rotas.calcular(origem, destino);

    return {
      ...trecho,
      enderecoDestino: RotaService.enderecoLegivel(cliente),
      linkMapa: this.linkMapa(origem, destino)
    };
  }

  /** "Avenida Paulista, 1000 - Bela Vista, São Paulo/SP" (o que a tela mostra). */
  static enderecoLegivel(c: Cliente): string {
    return `${c.rua}, ${c.numero} - ${c.bairro}, ${c.cidade}/${c.uf}`;
  }

  /** Do mais completo ao menos completo (sem número), sempre com cidade e UF. */
  static tentativasDeEndereco(c: Cliente): string[] {
    const cep = `${c.cep.slice(0, 5)}-${c.cep.slice(5)}`;
    return [
      `${c.rua}, ${c.numero}, ${c.bairro}, ${c.cidade} - ${c.uf}, ${cep}`,
      `${c.rua}, ${c.cidade} - ${c.uf}`
    ];
  }
}
