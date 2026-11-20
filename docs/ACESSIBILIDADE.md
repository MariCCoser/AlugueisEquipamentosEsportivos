# Acessibilidade — revisão da interface

Revisão da Pessoa 4, tomando como referência a **WCAG 2.1 nível AA** (mais o critério 2.5.8 da 2.2, tamanho do alvo de clique).
Vale para todas as telas do menu e para os modais. A tabela de cada item diz **o que foi feito**, **onde** e **como foi conferido**.

## Como foi conferido

1. **Contraste:** cada par de cores do tema (`styles/tema.css`) medido com a fórmula de contraste da WCAG (luminância relativa).
2. **Varredura automática nas 16 rotas e em 10 modais** (formulários e confirmações), feita no navegador com a API simulada. O script procurou:
   - campo sem rótulo;
   - botão ou link sem nome;
   - `id` repetido;
   - `aria-describedby` apontando para o nada;
   - mais de um `h1` ou título pulando nível;
   - alvo de clique menor que 24 px;
   - foco fora do modal ao abrir.

   Depois das correções, nenhum problema restou.
3. **Teclado:** todas as telas usadas só com Tab, Shift+Tab, Enter, Espaço, setas (abas) e Esc (modais).
4. **Janela estreita:** a janela foi testada com 640 px de largura, que é o que sobra com zoom de 200% numa tela de 1280 px.

## Contraste das cores (`styles/tema.css`)

| Uso | Cores | Contraste | Mínimo |
|---|---|---|---|
| Texto normal | `#1f2430` no branco / no fundo cinza | 15,5 / 14,5 | 4,5 |
| Texto secundário | `#5b6372` no branco / cinza-claro | 6,1 / 5,4 | 4,5 |
| Menu e botão principal | branco no `#0f4c5c` | 9,5 | 4,5 |
| Botão de perigo | branco no `#b42318` | 6,6 | 4,5 |
| Etiqueta "Disponível" (sucesso) | `#17703a` no `#e7f5ec` | 5,5 *(antes 4,50)* | 4,5 |
| Etiqueta de erro / alerta / info | no fundo claro de cada uma | 5,8 / 4,9 / 5,2 | 4,5 |
| **Contorno de campos e botões** | `#767f90` no branco | 4,0 *(antes 1,35)* | 3,0 |
| Foco (contorno laranja) no conteúdo | `#e36414` no branco / cinza | 3,4 / 3,1 | 3,0 |
| **Foco no menu lateral** | branco no `#0f4c5c` | 9,5 *(antes 2,8, laranja)* | 3,0 |

A borda clara `#d9dee5` continua só em **linhas decorativas** (tabela, cartões), onde não há mínimo.

## Checklist

### Perceptível

| Item | Onde | Situação |
|---|---|---|
| `lang="pt-BR"` e título da janela por tela ("Clientes · Locadora Esportiva") | `index.html`, `nucleo/Roteador.ts` | ✔ |
| Todo campo tem `<label for>`; ajuda e erro ligados por `aria-describedby`; erro marca `aria-invalid` | `components/Campos.ts` | ✔ |
| Erro não é só cor: borda mais grossa + ícone ⚠ + texto embaixo do campo | `componentes.css` | ✔ |
| Etiquetas de status sempre com texto ("Atrasada 3 dias"), nunca só a cor | `components/Etiqueta.ts` | ✔ |
| Item ativo do menu: `aria-current="page"` + negrito + barra, não só cor | `components/Layout.ts` | ✔ |
| Tabelas com `<caption>` (escondida), `<th scope="col">` e `aria-sort` nas colunas ordenáveis | `components/Tabela.ts` | ✔ |
| Contraste de texto e de controles (tabela acima) | `styles/tema.css` | ✔ corrigido |
| Zoom/texto grande: até 760 px de largura o menu vai para o topo e não há rolagem lateral da página (1.4.10) | `styles/layout.css` | ✔ novo |
| Sem animação para quem pede menos movimento (`prefers-reduced-motion`) | `styles/tema.css` | ✔ |

### Operável

| Item | Onde | Situação |
|---|---|---|
| Tudo funciona pelo teclado; nenhum `div` clicável (só `button` e `a`) | todas as telas | ✔ |
| **"Pular para o conteúdo"** como primeiro item do Tab | `components/Layout.ts` | ✔ novo |
| Foco sempre visível (contorno de 3 px), inclusive no menu | `styles/tema.css`, `layout.css` | ✔ corrigido |
| Ao trocar de tela, o foco vai para o título (`h1`); no assistente de reserva, para o título do passo | `nucleo/Roteador.ts`, `NovaReservaTela.ts` | ✔ |
| Ao trocar de página numa lista, o foco vai para a lista (o botão clicado some) | `EquipamentosTela.ts`, `ClientesTela.ts` | ✔ |
| Modais com `<dialog>`: foco preso dentro, Esc fecha, o foco volta para quem abriu | `components/Modal.ts` | ✔ |
| Abas no padrão WAI-ARIA: setas, Home e End; só a aba ativa entra no Tab | `components/Abas.ts` | ✔ |
| Alvos de clique com pelo menos 24 px (botões 32 px; botões das tabelas e cabeçalhos ordenáveis 28 px) | `componentes.css` | ✔ corrigido |
| **Avisos de erro não somem sozinhos**; os de sucesso param de contar enquanto o mouse ou o foco estão neles (2.2.1) | `components/Toast.ts` | ✔ corrigido |

### Compreensível

| Item | Onde | Situação |
|---|---|---|
| Campos opcionais escritos no rótulo ("E-mail (opcional)"); obrigatórios com `required`/`aria-required` | formulários | ✔ |
| Mensagens de erro dizem como corrigir ("CPF inválido: confira os números.", "Use hoje ou uma data passada.") | formulários e Main | ✔ |
| Ao salvar com erro, o foco vai para o primeiro campo com problema | `aplicarErros()` | ✔ |
| Confirmação antes de excluir/cancelar; a pergunta é lida junto com o título (`aria-describedby`); foco inicial em "Cancelar" | `components/ConfirmDialog.ts` | ✔ corrigido |
| Máscaras (CPF, CNPJ, telefone, CEP) não impedem colar o número com ou sem pontuação | formulários | ✔ |

### Robusto

| Item | Onde | Situação |
|---|---|---|
| Carregando / vazio / erro anunciados (`role="status"`, `aria-busy`, `role="alert"`) | `components/Consulta.ts`, `Estados.ts` | ✔ |
| Avisos (toasts) em regiões `aria-live` (sucesso: *polite*; erro: *assertive*) | `components/Toast.ts` | ✔ |
| Resultado de buscas automáticas anunciado: CEP encontrado, multa calculada, resumo da paginação, itens escolhidos | formulários e `Paginacao.ts` | ✔ |
| Opções do assistente com estado: cliente escolhido (`aria-pressed`) e equipamentos (checkbox com `label`) | `NovaReservaTela.ts` | ✔ |
| Indicador de passos com `aria-current="step"` e "(concluído)" para leitor de tela | `components/Passos.ts` | ✔ |
| Sem `nav` sem nome: a paginação de uma página só não é região de navegação | `components/Paginacao.ts` | ✔ corrigido |

## Limitações conhecidas

- O teste foi feito com teclado e com as ferramentas do navegador. **Não houve teste com um leitor de tela de verdade** (NVDA no Windows). Vale fazer um ensaio rápido com o NVDA (gratuito) antes da apresentação.
- As tabelas largas continuam com rolagem horizontal **dentro da própria caixa** em janelas estreitas. Isso é permitido pela WCAG para tabelas de dados.
- O app segue o tema claro; não há tema escuro nem modo de alto contraste próprio. O modo de alto contraste do Windows usa as cores do sistema e o foco continua visível.
