# ipc — Canais entre a tela e o sistema

Recebe as chamadas da tela (`window.api...`) e encaminha para os services.

| Arquivo                | O que é                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `registrarHandlers.ts` | `RegistroIpc`: registro central dos 80 canais (78 da proposta + 2 do app) |
| `permissoes.ts`        | Quem pode usar cada canal: `PUBLICO`, `LOGADO` ou `ADMIN`                 |
| `app.ipc.ts`           | Canais `app:info` e `app:statusBanco` (tela inicial)                      |

## O que acontece em cada chamada

1. **Origem:** só a nossa própria tela pode chamar.
2. **Permissão:** confere `permissoes.ts` com o usuário da `Sessao` (fica no Main).
3. **Handler** do domínio. Se ninguém registrou ainda, responde _"Esta função ainda não foi implementada."_
4. **Erro inesperado** vira _"Erro inesperado. Tente novamente."_ — o detalhe só aparece no terminal.

## Como implementar os canais do seu domínio

Crie `<dominio>.ipc.ts` (ex.: `clientes.ipc.ts`) e chame a função no `registrarCanais()` do `main.ts`:

```ts
export function registrarClientesIpc(registro: RegistroIpc, servico: ClienteService): void {
  registro.registrar<ClienteDTO>(IPC.clientes.buscarPorId, async (entrada) => {
    const { id } = schemaId.parse(entrada); // 1. valide a entrada: ela veio da tela
    return sucesso(await servico.buscarPorId(id)); // 2. chame o service
  });
}
```

- A permissão já foi checada antes — não precisa repetir no handler.
- `registro.canaisPendentes()` lista o que ainda falta implementar.

**Responsável:** estrutura central da Pessoa 1; cada pessoa cria os handlers do seu domínio.
