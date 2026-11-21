import { describe, expect, it } from 'vitest';
import {
  IntegracaoError,
  NaoEncontradoError,
  ValidacaoError
} from '../../../src/main/errors/ErroApp';
import { ClienteHttp } from '../../../src/main/integrations/ClienteHttp';
import { MSG_CEP_NAO_ENCONTRADO, ViaCepClient } from '../../../src/main/integrations/ViaCepClient';
import { fetchFalso, respostaJson, urlDaChamada } from './apoio';

/** Resposta no formato do ViaCEP para 01310-100 (o teste não depende da internet). */
const PAULISTA = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  complemento: 'de 612 a 1510 - lado par',
  unidade: '',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
  estado: 'São Paulo',
  ibge: '3550308',
  ddd: '11'
};

function montar(...respostas: Parameters<typeof fetchFalso>) {
  const buscar = fetchFalso(...respostas);
  const http = new ClienteHttp({
    nome: 'o serviço de CEP',
    dica: 'Preencha o endereço à mão.',
    buscar
  });
  return { buscar, viaCep: new ViaCepClient(http) };
}

describe('ViaCepClient', () => {
  it('transforma a resposta do ViaCEP no EnderecoDTO (sem o complemento do ViaCEP)', async () => {
    const { viaCep, buscar } = montar(respostaJson(PAULISTA));
    expect(await viaCep.buscar('01310-100')).toEqual({
      cep: '01310100',
      rua: 'Avenida Paulista',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP'
    });
    expect(urlDaChamada(buscar).href).toBe('https://viacep.com.br/ws/01310100/json/');
  });

  it('CEP inexistente vira NaoEncontrado com mensagem para o campo CEP', async () => {
    const { viaCep } = montar(respostaJson({ erro: 'true' }));
    const erro = await viaCep.buscar('99999999').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(NaoEncontradoError);
    expect((erro as Error).message).toBe(MSG_CEP_NAO_ENCONTRADO);
  });

  it('CEP com tamanho errado nem chega a chamar a API', async () => {
    const { viaCep, buscar } = montar();
    await expect(viaCep.buscar('1234')).rejects.toBeInstanceOf(ValidacaoError);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('sem internet: mensagem amigável que sugere digitar à mão', async () => {
    const { viaCep } = montar(() => Promise.reject(new TypeError('fetch failed')));
    const erro = await viaCep.buscar('01310100').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(IntegracaoError);
    expect((erro as Error).message).toMatch(/Preencha o endereço à mão\.$/);
  });

  it('usa o cache: o mesmo CEP não é consultado duas vezes', async () => {
    const { viaCep, buscar } = montar(respostaJson(PAULISTA));
    await viaCep.buscar('01310100');
    await viaCep.buscar('01310-100');
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('CEP geral de cidade (sem rua e bairro) devolve os campos vazios para completar à mão', async () => {
    const { viaCep } = montar(
      respostaJson({
        cep: '89590-000',
        logradouro: '',
        bairro: '',
        localidade: 'Ibicaré',
        uf: 'SC'
      })
    );
    expect(await viaCep.buscar('89590000')).toEqual({
      cep: '89590000',
      rua: '',
      bairro: '',
      cidade: 'Ibicaré',
      uf: 'SC'
    });
  });
});
