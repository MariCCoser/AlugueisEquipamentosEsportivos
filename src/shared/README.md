# shared — Código compartilhado

Tipos e constantes importados tanto pelo Main quanto pelo Renderer, garantindo que os dois lados
usem o mesmo contrato. Não pode importar nada de `electron` nem do Node.

| Pasta / arquivo      | Parte                                     | Responsável |
| -------------------- | ----------------------------------------- | ----------- |
| `ipc-channels.ts`    | Nomes de todos os canais (`dominio:acao`) | Pessoa 1    |
| `api.ts`             | Formato da `window.api`                   | Pessoa 1    |
| [`dto/`](dto/)       | Dados de entrada/saída de cada canal      | Todos       |
| [`models/`](models/) | Enums e entidades                         | Pessoa 2    |
