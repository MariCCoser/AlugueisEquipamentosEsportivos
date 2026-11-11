# seeds — Dados de exemplo

Scripts `.sql` que populam o banco para desenvolvimento e apresentação. Rodam uma vez cada
(controle em `schema_migrations`) e dentro de transação.

`001_dados_exemplo.sql` cria um cenário completo para testar todas as telas:

| Tabela        | Qtd | Destaques                                                                                     |
| ------------- | --- | --------------------------------------------------------------------------------------------- |
| usuarios      | 2   | `admin@aluguel.local` / `Admin@2026` (ADMIN), `funcionario@aluguel.local` / `Func@2026`       |
| clientes      | 5   | CPFs fictícios com dígito verificador válido                                                  |
| categorias    | 6   | 4 sensíveis ao clima (bicicletas, caiaques, pranchas, camping)                                |
| fornecedores  | 4   | 2 de COMPRA e 2 de MANUTENCAO                                                                 |
| equipamentos  | 13  | 11 para locação e 2 para venda                                                                |
| reservas      | 6   | 1 de cada situação: devolvida, devolvida com atraso, ativa, **atrasada**, pendente, cancelada |
| itens_reserva | 9   |                                                                                               |
| manutencoes   | 2   | 1 aberta (bicicleta urbana) e 1 concluída                                                     |
| multas        | 1   | R$ 24,00 (10% da diária × 2 dias), quitada                                                    |
| pagamentos    | 8   | aluguel, caução e multa                                                                       |

As datas usam `CURDATE()`, então a reserva atrasada continua atrasada em qualquer dia.
Senhas aqui já estão em hash bcrypt, nunca em texto puro.

**Responsável:** Pessoa 1
