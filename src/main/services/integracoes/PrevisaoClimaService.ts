import type { PrevisaoClimaDTO, PrevisaoClimaEntradaDTO } from '@shared/dto/integracao.dto';
import { CalendarioISO } from '../../domain/CalendarioISO';
import { RegraNegocioError } from '../../errors/ErroApp';
import type { ClimaClient, PrevisaoDia } from '../../integrations/ClimaClient';
import type { CategoriaRepository } from '../../repositories/CategoriaRepository';
import type { EquipamentoRepository } from '../../repositories/EquipamentoRepository';

/** O Open-Meteo prevê até 16 dias (hoje + 15). */
export const DIAS_DE_PREVISAO = 16;

/** A partir daqui a chuva/vento já gera alerta para equipamentos sensíveis. */
export const LIMITE_CHUVA = 60;
export const LIMITE_VENTO_KMH = 40;

/** Chuva forte (65, 67, 82) e tempestades (95 a 99), pelos códigos da OMM. */
const CODIGOS_PERIGOSOS = new Set([65, 67, 82, 95, 96, 99]);

/**
 * Previsão do tempo na confirmação da reserva (Pessoa 3, API 2).
 *
 * Gera alerta quando a reserva tem equipamento de categoria sensível ao clima
 * (`sensivel_clima`, ex.: caiaques, bicicletas, pranchas) E o dia da retirada tem
 * chuva provável, chuva forte/tempestade ou vento forte. É só um aviso:
 * se a previsão falhar, a tela mostra "Previsão indisponível" e a reserva continua.
 */
export class PrevisaoClimaService {
  constructor(
    private readonly clima: Pick<ClimaClient, 'previsao'>,
    private readonly equipamentos: Pick<EquipamentoRepository, 'buscarPorIds'>,
    private readonly categorias: Pick<CategoriaRepository, 'buscarPorId'>,
    private readonly hoje: () => string = () => CalendarioISO.hoje()
  ) {}

  async prever(entrada: PrevisaoClimaEntradaDTO): Promise<PrevisaoClimaDTO> {
    const dias = CalendarioISO.diasEntre(this.hoje(), entrada.data);
    if (dias < 0 || dias >= DIAS_DE_PREVISAO) {
      throw new RegraNegocioError(
        `A previsão só está disponível de hoje até ${DIAS_DE_PREVISAO - 1} dias à frente.`
      );
    }

    const categoriasSensiveis = await this.categoriasSensiveis(entrada.equipamentoIds);
    const previsao = await this.clima.previsao(entrada.cidade, entrada.uf, entrada.data);
    const motivos = PrevisaoClimaService.motivosDeAlerta(previsao);
    const alerta = categoriasSensiveis.length > 0 && motivos.length > 0;

    return {
      cidade: entrada.cidade,
      data: entrada.data,
      temperaturaMinima: previsao.temperaturaMinima,
      temperaturaMaxima: previsao.temperaturaMaxima,
      chanceDeChuva: previsao.chanceDeChuva,
      descricao: previsao.descricao,
      alerta,
      ...(alerta
        ? {
            mensagemAlerta:
              `Previsão de ${motivos.join(', ')} em ${entrada.cidade} na retirada. ` +
              `Confirme com o cliente o uso de: ${categoriasSensiveis.join(', ')}.`
          }
        : {}),
      categoriasSensiveis
    };
  }

  /** Por que o tempo é ruim para atividades ao ar livre (vazio = tempo bom). */
  static motivosDeAlerta(p: PrevisaoDia): string[] {
    const motivos: string[] = [];
    if (CODIGOS_PERIGOSOS.has(p.codigoTempo)) motivos.push(p.descricao.toLowerCase());
    if (p.chanceDeChuva >= LIMITE_CHUVA) motivos.push(`${p.chanceDeChuva}% de chance de chuva`);
    if (p.ventoMaximoKmh >= LIMITE_VENTO_KMH)
      motivos.push(`ventos de até ${p.ventoMaximoKmh} km/h`);
    return motivos;
  }

  /** Nomes (sem repetir) das categorias sensíveis ao clima entre os equipamentos da reserva. */
  private async categoriasSensiveis(equipamentoIds: number[]): Promise<string[]> {
    const equipamentos = await this.equipamentos.buscarPorIds(equipamentoIds);
    const idsCategorias = [...new Set(equipamentos.map((e) => e.categoriaId))];
    const categorias = await Promise.all(
      idsCategorias.map((id) => this.categorias.buscarPorId(id))
    );
    return categorias
      .filter((c) => c?.sensivelClima)
      .map((c) => c!.nome)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
}
