import { describe, expect, it } from 'vitest';
import {
  casarCaminho,
  encontrarRota,
  itemMenuAtivo,
  normalizarCaminho,
  separarHash,
  type DefinicaoRota
} from '../../src/renderer/util/rotas';

describe('normalizarCaminho', () => {
  it('trata vazio como raiz', () => {
    expect(normalizarCaminho('')).toBe('/');
    expect(normalizarCaminho('/')).toBe('/');
  });

  it('remove barras repetidas e a barra final', () => {
    expect(normalizarCaminho('//clientes//7/')).toBe('/clientes/7');
  });
});

describe('separarHash', () => {
  it('separa caminho e parâmetros de consulta', () => {
    const { caminho, consulta } = separarHash('#/devolucoes?aba=atrasadas');
    expect(caminho).toBe('/devolucoes');
    expect(consulta.get('aba')).toBe('atrasadas');
  });

  it('aceita hash vazio', () => {
    expect(separarHash('').caminho).toBe('/');
  });
});

describe('casarCaminho', () => {
  it('extrai parâmetros nomeados', () => {
    expect(casarCaminho('/clientes/:id', '/clientes/42')).toEqual({ id: '42' });
  });

  it('decodifica parâmetros', () => {
    expect(casarCaminho('/busca/:termo', '/busca/bola%20de%20v%C3%B4lei')).toEqual({
      termo: 'bola de vôlei'
    });
  });

  it('não casa caminhos com tamanhos diferentes', () => {
    expect(casarCaminho('/clientes', '/clientes/42')).toBeNull();
    expect(casarCaminho('/clientes/:id', '/clientes')).toBeNull();
  });

  it('não casa partes fixas diferentes', () => {
    expect(casarCaminho('/reservas/nova', '/reservas/7')).toBeNull();
  });
});

describe('encontrarRota', () => {
  const rotas: DefinicaoRota<string>[] = [
    { caminho: '/', criar: () => 'inicio' },
    { caminho: '/reservas/nova', criar: () => 'nova' },
    { caminho: '/reservas/:id', criar: (p) => `reserva ${p.id}` }
  ];

  it('respeita a ordem: rota fixa antes da rota com parâmetro', () => {
    const r = encontrarRota(rotas, '#/reservas/nova');
    expect(r?.rota.criar(r.parametros, r.consulta)).toBe('nova');
  });

  it('entrega parâmetros para a tela', () => {
    const r = encontrarRota(rotas, '#/reservas/9');
    expect(r?.rota.criar(r.parametros, r.consulta)).toBe('reserva 9');
  });

  it('devolve null para endereço desconhecido', () => {
    expect(encontrarRota(rotas, '#/nao-existe')).toBeNull();
  });
});

describe('itemMenuAtivo', () => {
  it('Painel só fica ativo na raiz', () => {
    expect(itemMenuAtivo('/', '/')).toBe(true);
    expect(itemMenuAtivo('/', '/clientes')).toBe(false);
  });

  it('item fica ativo nas subtelas', () => {
    expect(itemMenuAtivo('/clientes', '/clientes/7')).toBe(true);
  });

  it('não confunde prefixos parecidos', () => {
    expect(itemMenuAtivo('/reservas', '/reservas-antigas')).toBe(false);
  });
});
