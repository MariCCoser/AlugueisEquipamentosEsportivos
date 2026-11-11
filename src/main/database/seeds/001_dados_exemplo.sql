-- =========================================================
-- Seed 001 — dados de exemplo para desenvolvimento e apresentação
-- Datas são relativas a CURDATE(), então os cenários (reserva atrasada,
-- reserva futura etc.) continuam válidos em qualquer dia que o seed rodar.
-- Todos os nomes, CPFs e CNPJs são fictícios (mas com dígitos verificadores válidos).
-- =========================================================

-- ---------- usuarios ----------
-- Senhas em bcrypt (custo 10):
--   admin@aluguel.local       -> Admin@2026
--   funcionario@aluguel.local -> Func@2026
INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo) VALUES
  (1, 'Administrador', 'admin@aluguel.local', '$2b$10$e5bYUnrTn8FmZb108SQP9.RTSZT87D3PZBV4afM/XTHvGk2SicSS6', 'ADMIN', 1),
  (2, 'Funcionária Exemplo', 'funcionario@aluguel.local', '$2b$10$maxZGsmJuVrQiZB1jJGake4RQBZh/pHLosL3coGWMz9080WbsYT9a', 'FUNCIONARIO', 1);

-- ---------- clientes ----------
INSERT INTO clientes (id, nome, cpf, telefone, email, cep, rua, numero, complemento, bairro, cidade, uf) VALUES
  (1, 'Ana Souza',       '52998224725', '11987654321', 'ana.souza@email.com',    '01310100', 'Avenida Paulista',     '1000', 'Apto 52', 'Bela Vista',   'São Paulo',      'SP'),
  (2, 'Bruno Lima',      '12345678909', '21998765432', 'bruno.lima@email.com',   '22041001', 'Avenida Atlântica',    '250',  NULL,      'Copacabana',   'Rio de Janeiro', 'RJ'),
  (3, 'Carla Mendes',    '98765432100', '41991234567', NULL,                     '80010000', 'Rua XV de Novembro',   '78',   'Sala 3',  'Centro',       'Curitiba',       'PR'),
  (4, 'Diego Ferreira',  '11144477735', '48999887766', 'diego.f@email.com',      '88015000', 'Rua Felipe Schmidt',   '15',   NULL,      'Centro',       'Florianópolis',  'SC'),
  (5, 'Elisa Rocha',     '39053344705', '31988776655', 'elisa.rocha@email.com',  '30130000', 'Avenida Afonso Pena',  '1500', 'Bloco B', 'Centro',       'Belo Horizonte', 'MG');

-- ---------- categorias ----------
-- sensivel_clima = 1 -> gera alerta de previsão do tempo na reserva
INSERT INTO categorias (id, nome, descricao, sensivel_clima) VALUES
  (1, 'Bicicletas',          'Mountain bike, speed e urbanas',        1),
  (2, 'Caiaques e Canoas',   'Embarcações a remo',                    1),
  (3, 'Pranchas',            'Surf e stand up paddle',                1),
  (4, 'Raquetes',            'Tênis, beach tennis e afins',           0),
  (5, 'Camping',             'Barracas, sacos de dormir e acessórios', 1),
  (6, 'Bolas e Acessórios',  'Itens para venda',                      0);

-- ---------- fornecedores ----------
INSERT INTO fornecedores (id, razao_social, cnpj, tipo, contato, telefone, email) VALUES
  (1, 'Esporte Total Distribuidora Ltda', '11222333000181', 'COMPRA',     'Marcos',  '1133334444', 'vendas@esportetotal.com'),
  (2, 'Aventura Equipamentos Ltda',       '45678901000175', 'COMPRA',     'Juliana', '4833221100', 'contato@aventura.com'),
  (3, 'Bike Reparos Oficina ME',          '77889900000166', 'MANUTENCAO', 'Rafael',  '1132109876', 'oficina@bikereparos.com'),
  (4, 'Náutica Reparos Ltda',             '33445566000186', 'MANUTENCAO', 'Paula',   '4832456789', 'servicos@nauticareparos.com');

-- ---------- equipamentos ----------
-- Status coerente com as reservas/manutenções abaixo:
--   1 RESERVADO (reserva 3 ativa) | 3 EM_MANUTENCAO (manutenção 1 aberta)
--   4 e 7 RESERVADO (reserva 4 atrasada)
INSERT INTO equipamentos (id, nome, descricao, modalidade, estado_conservacao, status, valor_diaria, preco_venda, data_aquisicao, categoria_id, fornecedor_id) VALUES
  (1,  'Mountain Bike Aro 29',          '21 marchas, suspensão dianteira', 'LOCACAO', 'MUITO_BOM', 'RESERVADO',     45.00,  NULL,   CURDATE() - INTERVAL 400 DAY, 1, 1),
  (2,  'Bicicleta Speed Carbono',       'Quadro de carbono, 22 marchas',   'LOCACAO', 'NOVO',      'DISPONIVEL',    80.00,  NULL,   CURDATE() - INTERVAL 90 DAY,  1, 1),
  (3,  'Bicicleta Urbana Aro 26',       'Com cestinha',                    'LOCACAO', 'MEDIO',     'EM_MANUTENCAO', 30.00,  NULL,   CURDATE() - INTERVAL 700 DAY, 1, 1),
  (4,  'Caiaque Individual',            'Inclui remo e colete',            'LOCACAO', 'MUITO_BOM', 'RESERVADO',     90.00,  NULL,   CURDATE() - INTERVAL 300 DAY, 2, 2),
  (5,  'Caiaque Duplo',                 'Inclui 2 remos e 2 coletes',      'LOCACAO', 'MUITO_BOM', 'DISPONIVEL',    120.00, NULL,   CURDATE() - INTERVAL 200 DAY, 2, 2),
  (6,  'Prancha de Surf 6''2"',         'Epóxi, com quilhas',              'LOCACAO', 'MEDIO',     'DISPONIVEL',    50.00,  NULL,   CURDATE() - INTERVAL 500 DAY, 3, 2),
  (7,  'Prancha de Stand Up Paddle',    'Inflável, com remo',              'LOCACAO', 'MUITO_BOM', 'RESERVADO',     70.00,  NULL,   CURDATE() - INTERVAL 150 DAY, 3, 2),
  (8,  'Raquete de Tênis Profissional', 'Cabo 3, encordoada',              'LOCACAO', 'NOVO',      'DISPONIVEL',    20.00,  NULL,   CURDATE() - INTERVAL 60 DAY,  4, 1),
  (9,  'Kit Beach Tennis',              '2 raquetes + 3 bolas',            'LOCACAO', 'MUITO_BOM', 'DISPONIVEL',    25.00,  NULL,   CURDATE() - INTERVAL 120 DAY, 4, 1),
  (10, 'Barraca de Camping 4 Pessoas',  'Impermeável',                     'LOCACAO', 'REGULAR',   'DISPONIVEL',    35.00,  NULL,   CURDATE() - INTERVAL 900 DAY, 5, 2),
  (11, 'Saco de Dormir',                'Até 5 °C',                        'LOCACAO', 'MUITO_BOM', 'DISPONIVEL',    15.00,  NULL,   CURDATE() - INTERVAL 250 DAY, 5, 2),
  (12, 'Bola de Futebol Oficial',       'Tamanho 5',                       'VENDA',   'NOVO',      'DISPONIVEL',    NULL,   149.90, CURDATE() - INTERVAL 30 DAY,  6, 1),
  (13, 'Capacete de Ciclismo',          'Tamanho M',                       'VENDA',   'NOVO',      'DISPONIVEL',    NULL,   189.90, CURDATE() - INTERVAL 30 DAY,  6, 1);

-- ---------- reservas ----------
-- valor_total = soma das diárias x dias (data_devolucao_prevista - data_retirada)
--   1 DEVOLVIDA no prazo           (80+20) x 3 = 300.00
--   2 DEVOLVIDA com 2 dias atraso   120 x 2     = 240.00  -> gerou multa 1
--   3 ATIVA no prazo                45 x 4      = 180.00
--   4 ATIVA ATRASADA há 2 dias     (90+70) x 4 = 640.00  -> aparece em "atrasadas"
--   5 PENDENTE (futura)            (35+15) x 2 = 100.00
--   6 CANCELADA                     50 x 2      = 100.00
INSERT INTO reservas (id, cliente_id, usuario_id, data_retirada, data_devolucao_prevista, data_devolucao_real, status, valor_total, valor_caucao, caucao_status, observacoes) VALUES
  (1, 1, 2, CURDATE() - INTERVAL 30 DAY, CURDATE() - INTERVAL 27 DAY, CURDATE() - INTERVAL 27 DAY, 'DEVOLVIDA', 300.00, 0.00,   'NAO_APLICAVEL', NULL),
  (2, 2, 2, CURDATE() - INTERVAL 20 DAY, CURDATE() - INTERVAL 18 DAY, CURDATE() - INTERVAL 16 DAY, 'DEVOLVIDA', 240.00, 200.00, 'DEVOLVIDA',     'Devolvido com 2 dias de atraso'),
  (3, 3, 1, CURDATE() - INTERVAL 1 DAY,  CURDATE() + INTERVAL 3 DAY,  NULL,                        'ATIVA',     180.00, 150.00, 'RETIDA',        NULL),
  (4, 4, 2, CURDATE() - INTERVAL 6 DAY,  CURDATE() - INTERVAL 2 DAY,  NULL,                        'ATIVA',     640.00, 300.00, 'RETIDA',        'Cliente não atende o telefone'),
  (5, 5, 1, CURDATE() + INTERVAL 5 DAY,  CURDATE() + INTERVAL 7 DAY,  NULL,                        'PENDENTE',  100.00, 0.00,   'NAO_APLICAVEL', 'Retirada no fim de semana'),
  (6, 1, 1, CURDATE() - INTERVAL 10 DAY, CURDATE() - INTERVAL 8 DAY,  NULL,                        'CANCELADA', 100.00, 0.00,   'NAO_APLICAVEL', 'Cliente desistiu');

-- ---------- itens_reserva ----------
-- valor_diaria é copiado do equipamento no momento da reserva
INSERT INTO itens_reserva (id, reserva_id, equipamento_id, valor_diaria, estado_retirada, estado_devolucao) VALUES
  (1, 1, 2,  80.00,  'NOVO',      'NOVO'),
  (2, 1, 8,  20.00,  'NOVO',      'NOVO'),
  (3, 2, 5,  120.00, 'NOVO',      'MUITO_BOM'),
  (4, 3, 1,  45.00,  'MUITO_BOM', NULL),
  (5, 4, 4,  90.00,  'MUITO_BOM', NULL),
  (6, 4, 7,  70.00,  'MUITO_BOM', NULL),
  (7, 5, 10, 35.00,  'REGULAR',   NULL),
  (8, 5, 11, 15.00,  'MUITO_BOM', NULL),
  (9, 6, 6,  50.00,  'MEDIO',     NULL);

-- ---------- manutencoes ----------
--   1 aberta (sem data_retorno) -> equipamento 3 EM_MANUTENCAO
--   2 concluída
INSERT INTO manutencoes (id, equipamento_id, fornecedor_id, tipo, descricao, data_envio, data_retorno, custo, estado_retorno) VALUES
  (1, 3, 3, 'CORRETIVA',  'Troca do câmbio e regulagem dos freios', CURDATE() - INTERVAL 3 DAY,  NULL,                        NULL,  NULL),
  (2, 6, 4, 'PREVENTIVA', 'Reparo da quilha e parafina',            CURDATE() - INTERVAL 45 DAY, CURDATE() - INTERVAL 40 DAY, 85.00, 'MEDIO');

-- ---------- multas ----------
-- Reserva 2: 10% da soma das diárias por dia de atraso -> 120.00 x 10% x 2 dias = 24.00
INSERT INTO multas (id, reserva_id, dias_atraso, valor, quitada, data_quitacao) VALUES
  (1, 2, 2, 24.00, 1, NOW() - INTERVAL 16 DAY);

-- ---------- pagamentos ----------
INSERT INTO pagamentos (id, reserva_id, multa_id, tipo, forma, valor, data) VALUES
  (1, 1, NULL, 'ALUGUEL', 'PIX',      300.00, NOW() - INTERVAL 30 DAY),
  (2, 2, NULL, 'ALUGUEL', 'CARTAO',   240.00, NOW() - INTERVAL 20 DAY),
  (3, 2, NULL, 'CAUCAO',  'DINHEIRO', 200.00, NOW() - INTERVAL 20 DAY),
  (4, 2, 1,    'MULTA',   'PIX',      24.00,  NOW() - INTERVAL 16 DAY),
  (5, 3, NULL, 'ALUGUEL', 'PIX',      180.00, NOW() - INTERVAL 1 DAY),
  (6, 3, NULL, 'CAUCAO',  'CARTAO',   150.00, NOW() - INTERVAL 1 DAY),
  (7, 4, NULL, 'ALUGUEL', 'CARTAO',   640.00, NOW() - INTERVAL 6 DAY),
  (8, 4, NULL, 'CAUCAO',  'DINHEIRO', 300.00, NOW() - INTERVAL 6 DAY);
