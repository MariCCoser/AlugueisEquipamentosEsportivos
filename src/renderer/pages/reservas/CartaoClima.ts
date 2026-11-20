import type { PrevisaoClimaDTO } from '@shared/dto/integracao.dto';
import type { DataISO } from '@shared/dto/resposta';
import { el } from '../../nucleo/dom';
import { formatarData } from '../../util/formatadores';

export interface DadosCartaoClima {
  cidade: string;
  uf: string;
  data: DataISO;
  equipamentoIds: number[];
}

/**
 * Previsão do tempo para o dia da retirada (canal integracoes:previsaoClima, API 2).
 * Só aparece quando algum equipamento é de categoria sensível ao clima.
 * É um AVISO: se a previsão falhar, a reserva continua podendo ser feita.
 */
export function cartaoClima(dados: DadosCartaoClima): HTMLElement {
  const cartao = el(
    'section',
    { classe: 'cartao cartao-clima', atributos: { 'aria-labelledby': 'titulo-clima' } },
    [
      el('h3', { texto: 'Previsão do tempo na retirada', atributos: { id: 'titulo-clima' } }),
      el('p', {
        classe: 'cartao-clima__carregando',
        texto: `Consultando a previsão para ${dados.cidade}/${dados.uf}...`,
        atributos: { role: 'status' }
      })
    ]
  );

  void window.api.integracoes
    .previsaoClima(dados)
    .catch(() => null)
    .then((resposta) => {
      const corpo = resposta?.ok
        ? conteudo(resposta.dados)
        : [
            el('p', {
              classe: 'texto-suave',
              texto:
                `Previsão indisponível agora${resposta ? `: ${resposta.erro.mensagem}` : '.'} ` +
                'A reserva pode ser feita normalmente.'
            })
          ];
      cartao.replaceChildren(cartao.firstChild!, ...corpo);
    });

  return cartao;
}

function conteudo(p: PrevisaoClimaDTO): HTMLElement[] {
  const partes: HTMLElement[] = [
    el('p', {
      classe: 'cartao-clima__resumo',
      texto: `${p.cidade}, ${formatarData(p.data)}: ${p.descricao}`
    }),
    el('dl', { classe: 'cartao-clima__dados' }, [
      el('dt', { texto: 'Temperatura' }),
      el('dd', {
        texto: `${Math.round(p.temperaturaMinima)}° a ${Math.round(p.temperaturaMaxima)} °C`
      }),
      el('dt', { texto: 'Chance de chuva' }),
      el('dd', { texto: `${Math.round(p.chanceDeChuva)}%` })
    ])
  ];
  if (p.categoriasSensiveis.length > 0) {
    partes.push(
      el('p', {
        classe: 'texto-suave',
        texto: `Sensíveis ao clima nesta reserva: ${p.categoriasSensiveis.join(', ')}.`
      })
    );
  }
  if (p.alerta) {
    partes.push(
      el('p', {
        classe: 'cartao-clima__alerta',
        texto: `⚠ ${p.mensagemAlerta ?? 'Tempo ruim previsto para o dia da retirada.'} Avise o cliente antes de confirmar.`,
        atributos: { role: 'alert' }
      })
    );
  }
  return partes;
}
