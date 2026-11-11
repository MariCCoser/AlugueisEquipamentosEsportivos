-- =========================================================
-- Migration 001 — criação das 10 tabelas do sistema
-- Compatível com MySQL 8.0.16+ e MariaDB 10.4+ (XAMPP).
-- O banco é criado pelo `npm run db:setup`; aqui só ficam as tabelas.
-- Ordem respeita as FKs (tabelas sem FK primeiro).
-- Modelo explicado em docs/Proposta_Arquitetura_e_Banco.md, seção 3.
-- =========================================================

-- ---------- 1. usuarios ----------
CREATE TABLE usuarios (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  senha_hash    CHAR(60)     NOT NULL,
  perfil        ENUM('ADMIN','FUNCIONARIO') NOT NULL DEFAULT 'FUNCIONARIO',
  ativo         TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_login  DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 2. clientes ----------
CREATE TABLE clientes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome         VARCHAR(120) NOT NULL,
  cpf          CHAR(11)     NOT NULL,
  telefone     VARCHAR(20)  NOT NULL,
  email        VARCHAR(150) NULL,
  cep          CHAR(8)      NOT NULL,
  rua          VARCHAR(150) NOT NULL,
  numero       VARCHAR(10)  NOT NULL,
  complemento  VARCHAR(60)  NULL,
  bairro       VARCHAR(80)  NOT NULL,
  cidade       VARCHAR(80)  NOT NULL,
  uf           CHAR(2)      NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_clientes_cpf (cpf),
  KEY idx_clientes_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 3. categorias ----------
CREATE TABLE categorias (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(60)  NOT NULL,
  descricao       VARCHAR(255) NULL,
  sensivel_clima  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_categorias_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 4. fornecedores ----------
CREATE TABLE fornecedores (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  razao_social  VARCHAR(150) NOT NULL,
  cnpj          CHAR(14)     NOT NULL,
  tipo          ENUM('COMPRA','MANUTENCAO') NOT NULL,
  contato       VARCHAR(100) NULL,
  telefone      VARCHAR(20)  NULL,
  email         VARCHAR(150) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_fornecedores_cnpj (cnpj),
  KEY idx_fornecedores_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 5. equipamentos ----------
CREATE TABLE equipamentos (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome                VARCHAR(120) NOT NULL,
  descricao           VARCHAR(255) NULL,
  modalidade          ENUM('VENDA','LOCACAO') NOT NULL,
  estado_conservacao  ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR') NOT NULL DEFAULT 'NOVO',
  status              ENUM('DISPONIVEL','RESERVADO','EM_MANUTENCAO','INDISPONIVEL') NOT NULL DEFAULT 'DISPONIVEL',
  valor_diaria        DECIMAL(10,2) NULL,
  preco_venda         DECIMAL(10,2) NULL,
  data_aquisicao      DATE         NULL,
  categoria_id        INT UNSIGNED NOT NULL,
  fornecedor_id       INT UNSIGNED NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_equipamentos_status (status),
  KEY idx_equipamentos_modalidade (modalidade),
  CONSTRAINT fk_equipamentos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_equipamentos_fornecedor
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_equipamentos_preco CHECK (
    (modalidade = 'LOCACAO' AND valor_diaria IS NOT NULL AND valor_diaria > 0)
    OR (modalidade = 'VENDA' AND preco_venda IS NOT NULL AND preco_venda > 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 6. reservas ----------
CREATE TABLE reservas (
  id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id               INT UNSIGNED NOT NULL,
  usuario_id               INT UNSIGNED NOT NULL,
  data_retirada            DATE         NOT NULL,
  data_devolucao_prevista  DATE         NOT NULL,
  data_devolucao_real      DATE         NULL,
  status                   ENUM('PENDENTE','ATIVA','DEVOLVIDA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  valor_total              DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_caucao             DECIMAL(10,2) NOT NULL DEFAULT 0,
  caucao_status            ENUM('NAO_APLICAVEL','RETIDA','DEVOLVIDA') NOT NULL DEFAULT 'NAO_APLICAVEL',
  observacoes              VARCHAR(255) NULL,
  created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservas_status_prevista (status, data_devolucao_prevista),
  KEY idx_reservas_periodo (data_retirada, data_devolucao_prevista),
  CONSTRAINT fk_reservas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_reservas_datas CHECK (data_devolucao_prevista >= data_retirada),
  CONSTRAINT ck_reservas_valores CHECK (valor_total >= 0 AND valor_caucao >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 7. itens_reserva ----------
CREATE TABLE itens_reserva (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reserva_id        INT UNSIGNED NOT NULL,
  equipamento_id    INT UNSIGNED NOT NULL,
  valor_diaria      DECIMAL(10,2) NOT NULL,
  estado_retirada   ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR') NOT NULL,
  estado_devolucao  ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR') NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_itens_reserva_equip (reserva_id, equipamento_id),
  KEY idx_itens_reserva_equipamento (equipamento_id),
  CONSTRAINT fk_itens_reserva_reserva
    FOREIGN KEY (reserva_id) REFERENCES reservas (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_itens_reserva_equipamento
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_itens_reserva_valor CHECK (valor_diaria > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 8. manutencoes ----------
CREATE TABLE manutencoes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  equipamento_id  INT UNSIGNED NOT NULL,
  fornecedor_id   INT UNSIGNED NOT NULL,
  tipo            ENUM('PREVENTIVA','CORRETIVA') NOT NULL,
  descricao       VARCHAR(255) NOT NULL,
  data_envio      DATE         NOT NULL,
  data_retorno    DATE         NULL,
  custo           DECIMAL(10,2) NULL,
  estado_retorno  ENUM('NOVO','MUITO_BOM','MEDIO','REGULAR') NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_manutencoes_equip_retorno (equipamento_id, data_retorno),
  KEY idx_manutencoes_fornecedor (fornecedor_id),
  CONSTRAINT fk_manutencoes_equipamento
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_manutencoes_fornecedor
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_manutencoes_datas CHECK (data_retorno IS NULL OR data_retorno >= data_envio),
  CONSTRAINT ck_manutencoes_custo CHECK (custo IS NULL OR custo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 9. multas (antes de pagamentos, pois pagamentos aponta para ela) ----------
CREATE TABLE multas (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reserva_id     INT UNSIGNED NOT NULL,
  dias_atraso    INT UNSIGNED NOT NULL,
  valor          DECIMAL(10,2) NOT NULL,
  quitada        TINYINT(1)   NOT NULL DEFAULT 0,
  data_quitacao  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_multas_reserva (reserva_id),
  KEY idx_multas_quitada (quitada),
  CONSTRAINT fk_multas_reserva
    FOREIGN KEY (reserva_id) REFERENCES reservas (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_multas_valores CHECK (dias_atraso > 0 AND valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 10. pagamentos ----------
CREATE TABLE pagamentos (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reserva_id  INT UNSIGNED NOT NULL,
  multa_id    INT UNSIGNED NULL,
  tipo        ENUM('ALUGUEL','CAUCAO','MULTA') NOT NULL,
  forma       ENUM('DINHEIRO','PIX','CARTAO') NOT NULL,
  valor       DECIMAL(10,2) NOT NULL,
  data        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pagamentos_reserva_tipo (reserva_id, tipo),
  KEY idx_pagamentos_multa (multa_id),
  CONSTRAINT fk_pagamentos_reserva
    FOREIGN KEY (reserva_id) REFERENCES reservas (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pagamentos_multa
    FOREIGN KEY (multa_id) REFERENCES multas (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_pagamentos_valor CHECK (valor > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
