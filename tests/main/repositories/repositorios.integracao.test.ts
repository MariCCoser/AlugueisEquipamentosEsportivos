import { afterAll, describe, expect, it } from 'vitest';
import { Configuracao } from '../../../src/main/config/Configuracao';
import { Database } from '../../../src/main/database/Database';
import { criarRepositorios, type Repositorios } from '../../../src/main/repositories';

/**
 * Repositórios contra o MySQL de verdade, usando os dados do seed.
 * Só rodam com: DB_TESTE=1 npm test (depois do `npm run db:setup`).
 *
 * Cada teste roda dentro de uma transação que é DESFEITA no final,
 * então nada do que os testes gravam fica no banco.
 */
Configuracao.carregarArquivoEnv();
const habilitado = process.env['DB_TESTE'] === '1';

class Desfazer extends Error {}

describe.skipIf(!habilitado)('Repositórios (integração com MySQL)', () => {
  const db = habilitado ? new Database(new Configuracao().banco()) : (null as unknown as Database);

  afterAll(async () => {
    await db?.fechar();
  });

  /** Roda `fn` numa transação e faz ROLLBACK no fim, mesmo se tudo deu certo. */
  async function semGravar(fn: (r: Repositorios) => Promise<void>): Promise<void> {
    await expect(
      db.transacao(async (tx) => {
        await fn(criarRepositorios(tx));
        throw new Desfazer();
      })
    ).rejects.toBeInstanceOf(Desfazer);
  }

  it('CRUD completo (criar, buscar, atualizar, excluir) em categorias', () =>
    semGravar(async (r) => {
      const criada = await r.categorias.criar({ nome: 'Patins Teste', sensivelClima: true });
      expect(criada.id).toBeGreaterThan(0);
      expect(criada.sensivelClima).toBe(true);
      expect(criada.descricao).toBeNull();

      const atualizada = await r.categorias.atualizar(criada.id, { descricao: 'Rodas em linha' });
      expect(atualizada?.descricao).toBe('Rodas em linha');
      expect(atualizada?.nome).toBe('Patins Teste');

      expect(await r.categorias.excluir(criada.id)).toBe(true);
      expect(await r.categorias.buscarPorId(criada.id)).toBeNull();
      expect(await r.categorias.excluir(criada.id)).toBe(false);
    }));

  it('atualizar devolve null para id inexistente', () =>
    semGravar(async (r) => {
      expect(await r.clientes.atualizar(999999, { nome: 'Ninguém' })).toBeNull();
    }));

  it('listarPaginado e ordenação', () =>
    semGravar(async (r) => {
      const pagina = await r.equipamentos.listarPaginado({ porPagina: 5, pagina: 2 });
      expect(pagina.itens).toHaveLength(5);
      expect(pagina.total).toBeGreaterThanOrEqual(13);
      expect(pagina.itens[0]?.id).toBe(6);

      const porNome = await r.clientes.listar({ ordenarPor: 'nome' });
      const nomes = porNome.map((c) => c.nome);
      expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    }));

  it('usuarios: busca por e-mail, booleans e login', () =>
    semGravar(async (r) => {
      const admin = await r.usuarios.buscarPorEmail('ADMIN@aluguel.local');
      expect(admin?.perfil).toBe('ADMIN');
      expect(admin?.ativo).toBe(true);
      await r.usuarios.registrarLogin(admin!.id);
      expect((await r.usuarios.buscarPorId(admin!.id))?.ultimoLogin).not.toBeNull();
    }));

  it('clientes: CPF único e pesquisa', () =>
    semGravar(async (r) => {
      expect((await r.clientes.buscarPorCpf('52998224725'))?.nome).toBe('Ana Souza');
      const encontrados = await r.clientes.pesquisar('souza');
      expect(encontrados.map((c) => c.id)).toContain(1);
      await expect(
        r.clientes.criar({
          nome: 'Duplicado',
          cpf: '52998224725',
          telefone: '11900000000',
          cep: '01001000',
          rua: 'Praça da Sé',
          numero: '1',
          bairro: 'Sé',
          cidade: 'São Paulo',
          uf: 'SP'
        })
      ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    }));

  it('categorias: contar equipamentos e FK impede excluir categoria em uso', () =>
    semGravar(async (r) => {
      expect(await r.categorias.contarEquipamentos(1)).toBe(3);
      await expect(r.categorias.excluir(1)).rejects.toMatchObject({
        code: 'ER_ROW_IS_REFERENCED_2'
      });
    }));

  it('fornecedores: por tipo e por CNPJ', () =>
    semGravar(async (r) => {
      const manutencao = await r.fornecedores.listarPorTipo('MANUTENCAO');
      expect(manutencao.map((f) => f.id).sort()).toEqual([3, 4]);
      expect((await r.fornecedores.buscarPorCnpj('11222333000181'))?.tipo).toBe('COMPRA');
    }));

  it('equipamentos: filtros, DECIMAL como number e status', () =>
    semGravar(async (r) => {
      const venda = await r.equipamentos.filtrar({ modalidade: 'VENDA' });
      expect(venda.map((e) => e.id)).toEqual([12, 13]);
      expect(venda.find((e) => e.id === 12)?.precoVenda).toBe(149.9);

      const emManutencao = await r.equipamentos.listarPorStatus('EM_MANUTENCAO');
      expect(emManutencao.map((e) => e.id)).toEqual([3]);

      expect(await r.equipamentos.atualizarStatus(2, 'INDISPONIVEL')).toBe(true);
      expect((await r.equipamentos.buscarPorId(2))?.status).toBe('INDISPONIVEL');
      expect((await r.equipamentos.buscarPorIds([4, 7, 4])).map((e) => e.id)).toEqual([4, 7]);
    }));

  it('equipamentos: CHECK do banco recusa LOCACAO sem diária', () =>
    semGravar(async (r) => {
      await expect(
        r.equipamentos.criar({ nome: 'Sem preço', modalidade: 'LOCACAO', categoriaId: 1 })
      ).rejects.toMatchObject({
        code: expect.stringMatching(/CHECK_CONSTRAINT|CONSTRAINT_FAILED/)
      });
    }));

  it('reservas: atrasadas e conflito de período', () =>
    semGravar(async (r) => {
      const [{ hoje }] = (await db.consultar<{ hoje: string }>('SELECT CURDATE() AS hoje')) as [
        { hoje: string }
      ];
      const atrasadas = await r.reservas.listarAtrasadas(hoje);
      expect(atrasadas.map((res) => res.id)).toEqual([4]);

      const reserva3 = await r.reservas.buscarPorId(3);
      const { dataRetirada, dataDevolucaoPrevista } = reserva3!;
      // equipamento 1 está na reserva 3 (ATIVA)
      expect(
        await r.reservas.equipamentoReservadoNoPeriodo(1, dataRetirada, dataDevolucaoPrevista)
      ).toBe(true);
      // ignorando a própria reserva 3, não há conflito
      expect(
        await r.reservas.equipamentoReservadoNoPeriodo(1, dataRetirada, dataDevolucaoPrevista, 3)
      ).toBe(false);
      // equipamento 6 só está na reserva 6, que foi CANCELADA
      const reserva6 = await r.reservas.buscarPorId(6);
      expect(
        await r.reservas.equipamentoReservadoNoPeriodo(
          6,
          reserva6!.dataRetirada,
          reserva6!.dataDevolucaoPrevista
        )
      ).toBe(false);
      expect((await r.reservas.listarPorCliente(1)).map((res) => res.id).sort()).toEqual([1, 6]);
    }));

  it('reserva + itens na mesma transação; apagar a reserva apaga os itens (CASCADE)', () =>
    semGravar(async (r) => {
      const reserva = await r.reservas.criar({
        clienteId: 2,
        usuarioId: 1,
        dataRetirada: '2030-01-10',
        dataDevolucaoPrevista: '2030-01-12',
        valorTotal: 160
      });
      expect(reserva.status).toBe('PENDENTE');
      expect(reserva.caucaoStatus).toBe('NAO_APLICAVEL');

      await r.itensReserva.criar({
        reservaId: reserva.id,
        equipamentoId: 2,
        valorDiaria: 80,
        estadoRetirada: 'NOVO'
      });
      const itens = await r.itensReserva.listarPorReserva(reserva.id);
      expect(itens).toHaveLength(1);
      expect(itens[0]?.valorDiaria).toBe(80);

      expect(await r.itensReserva.registrarDevolucao(itens[0]!.id, 'MUITO_BOM')).toBe(true);
      expect(await r.reservas.excluir(reserva.id)).toBe(true);
      expect(await r.itensReserva.listarPorReserva(reserva.id)).toEqual([]);
    }));

  it('manutencoes: em aberto e retorno', () =>
    semGravar(async (r) => {
      expect((await r.manutencoes.listarEmAberto()).map((m) => m.id)).toEqual([1]);
      expect((await r.manutencoes.buscarEmAbertoDoEquipamento(3))?.id).toBe(1);
      const [{ hoje }] = (await db.consultar<{ hoje: string }>('SELECT CURDATE() AS hoje')) as [
        { hoje: string }
      ];

      const concluida = await r.manutencoes.registrarRetorno(1, {
        dataRetorno: hoje,
        custo: 120.5,
        estadoRetorno: 'MUITO_BOM'
      });
      expect(concluida?.custo).toBe(120.5);
      expect(await r.manutencoes.buscarEmAbertoDoEquipamento(3)).toBeNull();
    }));

  it('multas e pagamentos: quitar, somar e UNIQUE por reserva', () =>
    semGravar(async (r) => {
      const multa = await r.multas.criar({ reservaId: 4, diasAtraso: 2, valor: 32 });
      expect(multa.quitada).toBe(false);
      expect((await r.multas.listarEmAberto()).map((m) => m.id)).toContain(multa.id);

      await r.pagamentos.criar({
        reservaId: 4,
        multaId: multa.id,
        tipo: 'MULTA',
        forma: 'PIX',
        valor: 32
      });
      expect(await r.pagamentos.somarPorMulta(multa.id)).toBe(32);
      expect(await r.pagamentos.somarPorReserva(4, 'MULTA')).toBe(32);
      expect(await r.pagamentos.somarPorReserva(2)).toBe(464);

      expect(await r.multas.quitar(multa.id)).toBe(true);
      expect(await r.multas.quitar(multa.id)).toBe(false);
      expect((await r.multas.buscarPorReserva(4))?.dataQuitacao).not.toBeNull();

      await expect(
        r.multas.criar({ reservaId: 4, diasAtraso: 1, valor: 10 })
      ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    }));
});
