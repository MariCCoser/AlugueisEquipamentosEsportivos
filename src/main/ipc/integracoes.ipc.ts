import { IPC } from '@shared/ipc-channels';
import { sucesso } from '@shared/dto/resposta';
import type { EnderecoDTO, PrevisaoClimaDTO, RotaDTO } from '@shared/dto/integracao.dto';
import type { ViaCepClient } from '../integrations/ViaCepClient';
import type { PrevisaoClimaService } from '../services/integracoes/PrevisaoClimaService';
import type { RotaService } from '../services/integracoes/RotaService';
import {
  buscarCepSchema,
  calcularRotaSchema,
  previsaoClimaSchema
} from '../security/validators/integracao.schema';
import { Validador } from '../security/validators/Validador';
import type { RegistroIpc } from './registrarHandlers';

export interface ServicosIntegracoes {
  cep: Pick<ViaCepClient, 'buscar'>;
  clima: Pick<PrevisaoClimaService, 'prever'>;
  rotas: Pick<RotaService, 'calcular'>;
}

/**
 * Canais `integracoes:*` (Pessoa 3): as APIs externas 1, 2 e 3.
 * Quem pode: qualquer usuário logado (ver permissoes.ts).
 * As chamadas à internet saem do Main, nunca da tela (a CSP da tela bloqueia).
 */
export function registrarIntegracoesIpc(registro: RegistroIpc, s: ServicosIntegracoes): void {
  registro.registrar<EnderecoDTO>(IPC.integracoes.buscarCep, async (entrada) =>
    sucesso(await s.cep.buscar(Validador.validar(buscarCepSchema, entrada).cep))
  );

  registro.registrar<PrevisaoClimaDTO>(IPC.integracoes.previsaoClima, async (entrada) =>
    sucesso(await s.clima.prever(Validador.validar(previsaoClimaSchema, entrada)))
  );

  registro.registrar<RotaDTO>(IPC.integracoes.calcularRota, async (entrada) =>
    sucesso(await s.rotas.calcular(Validador.validar(calcularRotaSchema, entrada).clienteId))
  );
}
