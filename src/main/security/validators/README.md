# validators — Validação de entradas

Schemas `zod` por domínio, aplicados a todo dado recebido via IPC antes de chegar ao service.

- Exemplo: `cliente.schema.ts` validando CPF, CEP, e-mail e telefone.
- Erro de validação vira `Resposta` com `codigo: 'VALIDACAO'` e mensagens por campo.

**Responsável:** Pessoa 3
