# src — Código-fonte da aplicação

O app é dividido nos três processos do Electron + uma pasta de código compartilhado.
O Renderer **nunca** acessa o banco ou o Node diretamente: tudo passa pelo preload e pelo IPC.

```
Renderer (tela) → preload (window.api) → IPC → Service → Repository → MySQL
```

| Pasta                    | Parte do sistema                                      |
| ------------------------ | ----------------------------------------------------- |
| [`main/`](main/)         | Processo principal (Node): janela, IPC, banco, regras |
| [`preload/`](preload/)   | Ponte segura entre a tela e o processo principal      |
| [`renderer/`](renderer/) | Interface (telas em HTML/CSS/TypeScript)              |
| [`shared/`](shared/)     | Tipos e constantes usados pelo Main e pelo Renderer   |
