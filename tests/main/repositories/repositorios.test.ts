import { describe, expect, it } from 'vitest';
import { criarRepositorios } from '../../../src/main/repositories';
import { ExecutorFalso } from './ExecutorFalso';

function montar() {
  const db = new ExecutorFalso();
  return { db, r: criarRepositorios(db) };
}

describe('criarRepositorios', () => {
  it('cria os 10 repositórios, um por tabela', () => {
    const { r } = montar();
    expect(Object.keys(r)).toHaveLength(10);
  });
});

describe('UsuarioRepository', () => {
  it('converte ativo para boolean e busca por e-mail sem espaços', async () => {
    const { db, r } = montar();
    db.responderConsulta({ id: 1, email: 'a@b.c', ativo: 0, senha_hash: 'x' });
    const usuario = await r.usuarios.buscarPorEmail('  a@b.c ');
    expect(db.ultima.params).toEqual(['a@b.c']);
    expect(usuario?.ativo).toBe(false);
    expect(usuario?.senhaHash).toBe('x');
  });

  it('registrarLogin usa o relógio do banco', async () => {
    const { db, r } = montar();
    await r.usuarios.registrarLogin(3);
    expect(db.ultima.sql).toContain('ultimo_login = NOW()');
    expect(db.ultima.params).toEqual([3]);
  });
});

describe('ClienteRepository', () => {
  it('pesquisar escapa curingas e limita o resultado', async () => {
    const { db, r } = montar();
    await r.clientes.pesquisar(' 100%_ ', 10);
    expect(db.ultima.sql).toBe(
      'SELECT * FROM clientes WHERE nome LIKE ? OR cpf LIKE ? ORDER BY nome, id LIMIT ?'
    );
    expect(db.ultima.params).toEqual(['%100\\%\\_%', '100\\%\\_%', 10]);
  });
});

describe('FornecedorRepository', () => {
  it('listarPorTipo filtra pelo tipo', async () => {
    const { db, r } = montar();
    await r.fornecedores.listarPorTipo('MANUTENCAO');
    expect(db.ultima.sql).toContain('WHERE tipo = ?');
    expect(db.ultima.params).toEqual(['MANUTENCAO']);
  });
});

describe('EquipamentoRepository', () => {
  it('filtrar combina só os filtros informados', async () => {
    const { db, r } = montar();
    await r.equipamentos.filtrar({ status: 'DISPONIVEL', categoriaId: 2, nome: 'bike' });
    expect(db.ultima.sql).toBe(
      'SELECT * FROM equipamentos WHERE status = ? AND categoria_id = ? AND nome LIKE ? ORDER BY nome, id'
    );
    expect(db.ultima.params).toEqual(['DISPONIVEL', 2, '%bike%']);
  });

  it('filtrar sem filtros lista tudo', async () => {
    const { db, r } = montar();
    await r.equipamentos.filtrar();
    expect(db.ultima.sql).toBe('SELECT * FROM equipamentos ORDER BY nome, id');
  });

  it('buscarPorIds remove repetidos e não consulta com lista vazia', async () => {
    const { db, r } = montar();
    expect(await r.equipamentos.buscarPorIds([])).toEqual([]);
    expect(db.chamadas).toHaveLength(0);
    await r.equipamentos.buscarPorIds([4, 7, 4]);
    expect(db.ultima.sql).toContain('WHERE id IN (?, ?)');
    expect(db.ultima.params).toEqual([4, 7]);
  });
});

describe('ReservaRepository', () => {
  it('equipamentoReservadoNoPeriodo verifica sobreposição de datas', async () => {
    const { db, r } = montar();
    db.responderConsulta({ total: 1 });
    const reservado = await r.reservas.equipamentoReservadoNoPeriodo(5, '2026-12-01', '2026-12-05');
    expect(reservado).toBe(true);
    expect(db.ultima.sql).toContain('r.data_retirada <= ? AND r.data_devolucao_prevista >= ?');
    expect(db.ultima.params).toEqual([5, 'PENDENTE', 'ATIVA', '2026-12-05', '2026-12-01']);
  });

  it('equipamentoReservadoNoPeriodo pode ignorar a própria reserva', async () => {
    const { db, r } = montar();
    db.responderConsulta({ total: 0 });
    const reservado = await r.reservas.equipamentoReservadoNoPeriodo(
      5,
      '2026-12-01',
      '2026-12-05',
      9
    );
    expect(reservado).toBe(false);
    expect(db.ultima.sql).toMatch(/AND r\.id <> \?$/);
    expect(db.ultima.params.at(-1)).toBe(9);
  });

  it('listarAtrasadas compara com a data informada', async () => {
    const { db, r } = montar();
    await r.reservas.listarAtrasadas('2026-11-13');
    expect(db.ultima.sql).toContain("status = 'ATIVA' AND data_devolucao_prevista < ?");
    expect(db.ultima.params).toEqual(['2026-11-13']);
  });
});

describe('ItemReservaRepository', () => {
  it('registrarDevolucao grava o estado do item', async () => {
    const { db, r } = montar();
    expect(await r.itensReserva.registrarDevolucao(4, 'MEDIO')).toBe(true);
    expect(db.ultima.params).toEqual(['MEDIO', 4]);
  });
});

describe('ManutencaoRepository', () => {
  it('em aberto = sem data de retorno', async () => {
    const { db, r } = montar();
    await r.manutencoes.buscarEmAbertoDoEquipamento(3);
    expect(db.ultima.sql).toContain('equipamento_id = ? AND data_retorno IS NULL');
  });

  it('registrarRetorno atualiza data, custo e estado', async () => {
    const { db, r } = montar();
    await r.manutencoes.registrarRetorno(1, {
      dataRetorno: '2026-11-13',
      custo: 50,
      estadoRetorno: 'MUITO_BOM'
    });
    expect(db.chamadas[0]?.sql).toBe(
      'UPDATE manutencoes SET data_retorno = ?, custo = ?, estado_retorno = ? WHERE id = ?'
    );
    expect(db.chamadas[0]?.params).toEqual(['2026-11-13', 50, 'MUITO_BOM', 1]);
  });
});

describe('MultaRepository', () => {
  it('quitar não mexe em multa já quitada', async () => {
    const { db, r } = montar();
    db.responderEscrita({ linhasAfetadas: 0 });
    expect(await r.multas.quitar(1)).toBe(false);
    expect(db.ultima.sql).toContain('WHERE id = ? AND quitada = 0');
  });

  it('converte quitada para boolean', async () => {
    const { db, r } = montar();
    db.responderConsulta({ id: 1, reserva_id: 2, quitada: 1 });
    expect((await r.multas.buscarPorReserva(2))?.quitada).toBe(true);
  });
});

describe('PagamentoRepository', () => {
  it('somarPorReserva com e sem tipo', async () => {
    const { db, r } = montar();
    db.responderConsulta({ total: '464.00' }).responderConsulta({ total: 24 });
    expect(await r.pagamentos.somarPorReserva(2)).toBe(464);
    expect(await r.pagamentos.somarPorReserva(2, 'MULTA')).toBe(24);
    expect(db.ultima.sql).toMatch(/AND tipo = \?$/);
    expect(db.ultima.params).toEqual([2, 'MULTA']);
  });
});
