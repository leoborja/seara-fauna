# Seara Biologia — Levantamento de Fauna

App web estático para levantamento de fauna em licenciamento ambiental.
Substitui a planilha de 30 abas: modela N campanhas sem duplicar estrutura,
**calcula** os índices e estimadores em vez de colar valores do EstimateS — com
o intervalo de confiança log-normal de Chao e a fonte de cada variância no
próprio laudo — e confere a nomenclatura contra a GBIF.

**A autoecologia não é mais digitada espécie por espécie.** Um botão consulta a
GBIF (hierarquia completa, autoria, ano, nome comum em português), o
iNaturalist (categoria de conservação) e a **Lista Nacional de Espécies
Ameaçadas embutida** — que funciona sem internet — e propõe o preenchimento,
campo a campo. Os dados secundários vêm da GBIF em vez de garimpo
bibliográfico, e o eBird e o iNaturalist entram direto pela API.

A regra que atravessa tudo: **a máquina propõe, o responsável técnico decide.**
Nada é gravado sem ele aceitar, campo já preenchido nunca é sobrescrito sem
ordem, e a origem de cada valor — fonte e data da consulta — fica gravada e sai
no laudo. A assinatura é dele.

Serve a **qualquer grupo da fauna e qualquer metodologia**: cada método declara
a própria unidade de esforço e cada grupo, a própria autoecologia. Vem com dois
exemplos completos, de grupos e métodos diferentes — avifauna em transecto (km)
e mastofauna de médio e grande porte por armadilha fotográfica
(armadilha-noite) — porque isso é para ser demonstrado, não afirmado.

Irmão do app de análise de solo — mesma marca, mesma linguagem visual, mesmo
padrão de código.

---

## Rodar

Não tem build, não tem instalação, não tem dependência.

```bash
cd ~/fauna
python3 -m http.server 8080
# abra http://localhost:8080/
```

Qualquer servidor de arquivos estáticos serve. Abrir o `index.html` direto pelo
`file://` também funciona, menos a verificação na GBIF (o navegador bloqueia a
requisição por CORS em `file://`).

## Restrições de projeto

- **Zero dependências, zero CDN.** JavaScript vanilla, gráficos em SVG escrito
  à mão. Nada é baixado de fora — só a chamada à GBIF, quando você pede.
- **Funções puras no motor.** `js/motor.js` não toca no DOM e não lê estado
  global: recebe dados, devolve dados. É o que permite conferir cada número.
- **Persistência local.** `localStorage` + exportar/importar JSON. Nada sai do
  aparelho.
- **Nada no núcleo é de ave nem de transecto.** O método declara a própria
  unidade de esforço; o grupo declara a própria autoecologia. Os dois exemplos
  que vêm no app são de grupos e métodos diferentes de propósito, para que isso
  seja demonstrável e não afirmado.
- **Português do Brasil**, números em formato brasileiro (vírgula decimal).

## Arquivos

```
index.html                9 telas + os símbolos SVG da marca
testes.html               conferência numérica do motor contra exemplos publicados
css/estilo.css            paleta verde-folha #1B5E3F + terracota #B4633A, claro e escuro
js/dados.js               métodos e unidades de esforço, autoecologia POR GRUPO, avisos legais
js/motor.js               índices, estimadores, variâncias, rarefação — funções puras
js/graficos.js            curva do coletor, barras, roscas, dot-and-whisker — SVG à mão
js/gbif.js                conferência do NOME contra a GBIF (species/match)
js/listas-oficiais.js     Lista Nacional embutida — 1.407 táxons, GERADO, cruzamento offline
js/fontes.js              camada de rede: GBIF, iNaturalist, eBird + cache no localStorage
js/autoecologia.js        motor de propostas: o que cada fonte tem a dizer sobre um táxon
js/secundarios.js         ocorrências da GBIF na região e o cruzamento das três listas
js/exemplos.js            os dois projetos de demonstração (avifauna e mastofauna)
js/importador.js          leitor genérico de CSV / TSV / Darwin Core
js/armazenamento.js       localStorage, CRUD, export/import JSON e CSV
js/app.js                 interface e eventos
assets/                   marca, ícones, selo, favicon
importar.py               conversor .xlsx → JSON do app
gerar-listas.py           conversor do CSV do MMA → js/listas-oficiais.js
dados/                    fauna-ameacada-2021.csv, a fonte da lista embutida
exemplo-planalto.json     planilha da Mineração — exemplo (Mariana/MG) já convertida
```

`js/listas-oficiais.js` é **gerado** — não se edita à mão. Para regerar a
partir do CSV do MMA:

```bash
python3 gerar-listas.py
```

## Os dois exemplos

**Projetos → Exemplos.** São dois, de propósito, e de grupos e métodos
diferentes — é o que prova que o núcleo não é de ave nem de transecto:

| Exemplo | Grupo | Método | Unidade de esforço | Campanhas |
|---|---|---|---|---|
| **Mineração — exemplo (Mariana/MG)** | aves | transecto | km | 2 (dados reais da planilha) |
| **PCH Ribeirão do Cedro** | mastofauna de médio e grande porte | armadilha fotográfica | armadilha-noite | 3 (dados fictícios) |

Os dois coexistem: abrir um não apaga o outro, e o catálogo de táxons é
compartilhado por nome científico, sem duplicar espécie.

O de mastofauna tem 23 espécies conferidas na GBIF (23/23 exatas e aceitas),
22 estações-armadilha e 534 armadilha-noite de esforço. Ele existe para
exercitar o que a avifauna não exercita: unidade de esforço que não é
distância, autoecologia própria do grupo, e comparação com mais de duas
campanhas.

> Os dados de campo do exemplo de mastofauna são fictícios e as categorias de
> ameaça são ilustrativas. O aviso está dentro do próprio projeto.

## As 9 telas

| Tela | O que faz |
|---|---|
| **Projetos** | Empreendimento: cliente, município/UF, órgão, processo, responsável técnico |
| **Campanhas** | N campanhas por projeto, com sazonalidade. Sem limite, sem duplicação |
| **Unidades amostrais** | Método, código, geo, ambiente, condições e **esforço** |
| **Registros** | Lançamento rápido: autocompletar de espécie, `Enter` salva e devolve o foco |
| **Táxons / Autoecologia** | Catálogo, **preenchimento automático da autoecologia**, cruzamento com a Lista Nacional e conferência do nome na GBIF |
| **Secundários** | Ocorrências publicadas na região (GBIF) e o cruzamento com o levantamento de campo |
| **Resultados** | Índices, estimadores, curva do coletor, composição, espécies de interesse |
| **Laudo** | A4 imprimível, pronto para assinar |
| **Como usar** | Fluxo, fórmulas, avisos |

---

## O método é a peça central

Cada método declara **a própria unidade de esforço**, e o formulário da unidade
amostral se remonta conforme o método escolhido:

| Método | Unidade de esforço | Campos próprios |
|---|---|---|
| Transecto | km | comprimento, largura da faixa |
| Ponto de escuta | hora·ponto | raio, duração, nº de pontos |
| Armadilha fotográfica | armadilha-noite | nº de câmeras, noites |
| Pitfall | balde-noite | nº de baldes, noites |
| Rede de neblina | m²·h | nº de redes, área, horas |
| Busca ativa | hora·pessoa | nº de observadores, horas |
| Playback | hora | duração, espécies alvo |
| Rede de pesca / peneira | m²·h | área, horas |

No transecto, a área vem da fórmula herdada da planilha (`Inf campo` L3):

```
área (ha) = (comprimento_km × 1000 × largura_m) / 10.000
```

A largura é **parâmetro do método**, não constante — 50 m é apenas o padrão.

**Esforço é obrigatório.** Unidade sem esforço aparece marcada em terracota e
fica fora dos cálculos que dependem dele. Abundância relativa sem esforço não
significa nada, e era isso que impedia a planilha de juntar métodos diferentes.

## A autoecologia é do grupo, não do app

O outro pé do mesmo princípio. **Dependência de mata** (Silva, 1995) e
**sensibilidade a distúrbio** (Stotz et al., 1996) são escalas definidas para
**aves**. Emprestá-las a um mamífero seria pegar um número de outro grupo e
assinar embaixo. Então elas são declaradas de aves, e somem quando o projeto é
de mastofauna. No lugar entram os atributos do grupo:

| | Avifauna | Mastofauna |
|---|---|---|
| próprios do grupo | dependência de mata, sensibilidade a distúrbio | hábito, período de atividade, porte |
| guilda trófica | carnívora, **nectarívora**, insetívora, frugívora, granívora, onívora, detritívora, piscívora, generalista | carnívora, onívora, **herbívora**, **folívora**, frugívora, granívora, insetívora/mirmecófaga, hematófaga, piscívora |
| comuns a todos | IUCN, Portaria MMA, lista estadual, endemismo, hábitat, migratória, cinegética, exótica | idem |

A mesma chave (`dieta`) tem **domínio diferente em cada grupo** — nectarívora é
guilda de ave, folívora é de mamífero. `DADOS.atributosDoGrupo(grupo)` escolhe a
entrada certa, e é ela que alimenta a tabela do catálogo, o formulário de táxon,
os gráficos de composição, a tabela do laudo e o CSV. **Nenhuma tela conhece a
lista**: acrescentar um grupo é acrescentar linhas em `js/dados.js`.

Na tela de Táxons há um seletor de grupo, porque o catálogo é do app inteiro e
pode misturar grupos. Ele começa no grupo do projeto aberto.

## O que é calculado

Tudo conforme `ESPECIFICACAO.md` §2 e §3, ao pé da letra:

```
Riqueza                 S
Simpson (dominância)    D  = Σ ni(ni−1) / N(N−1)
Simpson (diversidade)   1 − D
Simpson (recíproco)     1 / D
Equitabilidade Simpson  (1/D) / S
Shannon                 H' = − Σ (pi × ln pi)
Equitabilidade Pielou   J' = H' / ln(S)
Densidade               indivíduos / esforço
Abundância relativa     ni / N
Frequência de ocorrência   unidades onde ocorre / total de unidades

Chao 1                  S + F1² / (2·F2)          (troca sozinho para a forma
Chao 1 corrigido        S + F1(F1−1) / (2(F2+1))   corrigida quando F2 = 0)
Chao 2                  S + Q1² / (2·Q2)
Chao 2 corrigido        S + ((m−1)/m) · Q1(Q1−1) / (2(Q2+1))
Jackknife 1             S + Q1 · (m−1)/m
Jackknife 2             S + Q1(2m−3)/m − Q2(m−2)² / (m(m−1))
Bootstrap               S + Σ (1 − pk)^m

Rarefação (Mao Tau)     E[Sn] = Σ [ 1 − C(N−ni, n) / C(N, n) ]
Curva de Coleman        E(s*) = Σ [ 1 − (1 − n*/N)^ni ]
```

A rarefação usa logaritmo de fatorial (Lanczos) para não estourar em N grande.

### O intervalo de confiança

O IC 95 % dos estimadores é o **intervalo log-normal de Chao** — o mesmo que o
EstimateS usa:

```
K  = exp( 1,96 × √( ln( 1 + V̂ ÷ (Ŝ − S_obs)² ) ) )
IC = [ S_obs + (Ŝ − S_obs) ÷ K ;  S_obs + (Ŝ − S_obs) × K ]
```

Ele é **assimétrico**, como tem que ser — a incerteza sobre quantas espécies
faltam é maior para cima — e por construção **nunca exclui a estimativa
pontual**, que era o defeito do intervalo por percentil de bootstrap.

**Nenhuma variância foi escrita de memória.** Cada uma tem fonte primária:

| Fórmula | Fonte |
|---|---|
| IC log-normal | Chao, A. 1987, *Biometrics* 43:783–791, eqs. (11)–(12), p. 787 |
| Var(Chao 1) | Chao (1987), p. 786 |
| Var(Chao 1 e Chao 2 corrigidos) | EstimateS 9.1.0 User's Guide, Appendix B, eqs. 6 (F2 > 0) e 7 (F2 = 0) |
| Var(Chao 2) | Chao & Colwell 2017, *SORT* 41(1):3–54, eq. (3a) |
| Var(Jackknife 1) | Heltshe & Forrester 1983, *Biometrics* 39:1–11 (eq. 12 de Colwell & Coddington 1994; eq. 13.4 de Krebs) |
| Var(Bootstrap) | Smith & van Belle 1984, *Biometrics* 40:119–129 |
| Curva de Coleman | Gotelli & Colwell 2011, cap. 4, eq. (4.1) |

Três armadilhas bibliográficas que valem registrar, porque quem for conferir
vai esbarrar nelas:

- **Chao (1984) não traz variância analítica** — usa bootstrap percentílico.
  Citar 1984 para variância é errado; a fórmula está em **1987**.
- **A eq. (10) de Colwell & Coddington (1994) tem erro de tipografia** (os
  coeficientes ¼ e ½ caem dentro dos parênteses). O próprio Colwell registra a
  errata no guia do EstimateS.
- **Krebs imprime a Var(Bootstrap) com um menos onde deveria ser produto** —
  quase certamente erro de composição; uma diferença antissimétrica somaria
  zero sobre os pares.

#### Conferência numérica

`testes.html` roda **20 verificações** contra exemplos publicados com resultado
conhecido, e todas conferem:

- **`specpool(dune, Management)`, grupo BF** do pacote R `vegan`: Chao 2
  17,190476 · EP 1,5895675; Jackknife 1 19,333333; Jackknife 2 19,833333;
  Bootstrap 17,740741 · EP 1,6463786.
- **`estimateR(BCI[1,])`**: Chao 1 corrigido 117,473684 · EP 11,585411.
- **Heltshe & Forrester (1983)**, exemplo reimpresso em Krebs, Box 13.2:
  Var(Jackknife 1) = 4,05.
- **IC log-normal**: BCI[1,] → [103,1388 ; 152,0763]; dune BF → [16,1639 ; 24,6471].

Abra `testes.html` sempre que mexer em `js/motor.js`.

#### O que fica sem intervalo, e por quê

- **Jackknife 2.** Não existe variância analítica publicada para o jackknife de
  segunda ordem — a documentação do `vegan::specpool` registra a lacuna com
  todas as letras (*"second-order jackknife is still missing"*), e o `SpadeR`
  calcula uma por método delta que não está publicada como tal. O app mostra a
  estimativa e diz, na própria linha, que não há IC.
  **Melhor faltar o intervalo do que inventar a variância.**
- **Riqueza observada (S).** É contagem, não estimativa.
- Quando a estimativa **coincide com a riqueza observada** (Q1 = 0, por
  exemplo), a transformação logarítmica divide por zero e o intervalo não
  existe. O app diz isso em vez de mostrar um traço mudo.

#### Duas divergências declaradas

1. **Jackknife 1:** o `vegan::specpool` subtrai `Q1 ÷ m`; a literatura
   (Heltshe & Forrester, Colwell & Coddington, Krebs) subtrai `Q1² ÷ m`.
   Seguimos a literatura, que é o que fecha com o exemplo numérico publicado
   por Krebs (Box 13.2 → 4,05). No grupo BF do `dune` isso dá EP 0,667 aqui
   contra 2,211 no `vegan`.
2. **Chao 1 corrigido:** o `vegan` recusa a fórmula do EstimateS
   (*"the commonly used variance estimator is wrong for bias-reduced Chao
   estimate"*) e usa uma derivação própria, não publicada como tal. Em
   `BCI[1,]` as duas dão EP 11,5854 e 11,5838 — 0,014 % de diferença.
   Seguimos o EstimateS, que é a referência que o órgão conhece.

Um terceiro ponto, menor: o **Chao 2 clássico** aqui é `S + Q1²/(2·Q2)`, como
manda a `ESPECIFICACAO.md`; o EstimateS e o `vegan` aplicam também a ele o
fator `(m−1)/m`, que a especificação reserva à forma corrigida (a convenção de
Gotelli & Colwell 2011, Box 4.1). A variância acompanha o estimador. A
diferença é de exatamente `1/m`.

**A curva do coletor é o único lugar que ainda usa bootstrap** (200 repetições,
semente fixa — o mesmo dado devolve sempre o mesmo intervalo, hoje e daqui a
dois anos). Ao lado dela, tracejada em cinza, vai a **curva de Coleman**,
`E(s*) = Σ [1 − (1 − n*/N)^ni]`, que aproxima a rarefação e fica sempre um
pouco abaixo dela.

---

## A integração GBIF

`GET https://api.gbif.org/v1/species/match?name={nome}&kingdom=Animalia`
— sem chave, sem cadastro, sem custo.

**Regra de ouro: a API sugere, nunca sobrescreve.** Cada divergência vira um
card com *Aceitar* e *Recusar*. Nada muda no dado sem decisão do responsável
técnico.

O que é tratado:

| Situação | O que o app faz |
|---|---|
| `matchType: EXACT` + `status: ACCEPTED` | confere, nada a decidir |
| `matchType: FUZZY` | avisa que a GBIF corrigiu a grafia |
| `status: SYNONYM` | mostra o nome aceito |
| `matchType: HIGHERRANK` | a GBIF só reconheceu o gênero — cai no plano B (abaixo) |
| `matchType: NONE` | não encontrado — também cai no plano B |
| família ou ordem diferente, distância de edição ≤ 2 | **provável erro de digitação** |
| família ou ordem diferente, distância maior | **divergência entre autores** — mostra as duas |

**Plano B:** quando a espinha dorsal da GBIF não reconhece a combinação, o app
faz uma segunda chamada em `species/search`, que varre todas as listas
taxonômicas, e traz o nome aceito de lá. É assim que `Hydropsalis parvula`
chega a `Setopagis parvula` — o backbone não tem esse nome, mas outras listas
têm, como sinônimo.

**Offline:** se a rede cair, o app continua inteiro; só a verificação fica
indisponível, com aviso claro. O resultado da última verificação de cada
espécie fica no `localStorage` e continua sendo exibido sem internet. A
verificação em lote tem barra de progresso, pode ser interrompida, e faz uma
pausa de 120 ms entre chamadas para não ser limitada pelo servidor.

### Achados nos dados reais (§4 da especificação — reproduzidos)

Rodando o lote sobre as 59 espécies da Mineração — exemplo (Mariana/MG):

| Espécie | O que a GBIF apontou |
|---|---|
| família `Furariidae` (3 espécies) | **erro de digitação** de `Furnariidae` — distância 1 |
| `Hydropsalis parvula` | hoje é **`Setopagis parvula`** (Gould, 1837) |
| `Geranoaetus albicaudatus` | sinônimo de `Buteo albicaudatus` |
| `Pygochelidon cyanoleuca` | sinônimo de `Notiochelidon cyanoleuca` |
| `Icterus jamacaii` | sinônimo de `Icterus icterus` |
| `Psittacara leucophthalmus` | sinônimo de `Aratinga leucophthalma` |
| `Todirostrum poliocephalum` | planilha: `Rhynchocyclidae` · GBIF: `Tyrannidae` |
| `Jacamaralcyon tridactyla` | planilha: `Galbuliformes` · GBIF: `Piciformes` |

Os dois últimos **não são erro** — são divergência real entre autores sobre
desmembrar famílias e ordens. O app rotula como *divergência entre autores*,
mostra as duas e deixa a decisão com quem assina.

Resultado do lote: **49 conferem, 11 divergentes, 0 não encontrados, 0 erros.**

---

## Autoecologia com um clique

Até a rodada anterior, a GBIF só resolvia o **nome**. Toda a autoecologia
continuava sendo digitada espécie por espécie — e era a maior perda de tempo do
trabalho. **Táxons → Preencher autoecologia** (em lote, ou pela varinha na
linha de cada espécie) consulta quatro fontes e propõe o preenchimento:

| Fonte | O que traz | Chave |
|---|---|---|
| GBIF `species/match` | reino, filo, classe, ordem, família, gênero, **autoria e ano**, `usageKey` | não precisa |
| GBIF `species/{key}/vernacularNames` | **nome comum em português** (`language: "por"`) | não precisa |
| iNaturalist `taxa` | **categoria de conservação** e nome comum `pt-BR` | não precisa |
| Lista Nacional embutida | **categoria da Portaria do MMA** — **offline** | não precisa |

A hierarquia completa já vinha na resposta da GBIF e o app **jogava fora**. Era
o ganho mais barato da lista.

### A tela de revisão

Campo a campo: **valor atual × valor proposto × fonte e data da consulta**, com
aceitar e recusar individuais e ações em lote. Cada proposta é classificada, e
a classificação decide o que entra em cada botão:

| Classe | O que é | Entra em "aceitar todos"? |
|---|---|---|
| `campo em branco` | não havia nada ali | sim, e tem botão próprio |
| `diverge` | você preencheu uma coisa, a fonte diz outra | sim |
| `mesmo nome, outra grafia` | *Papagaio de peito roxo* × *papagaio-de-peito-roxo* | sim, e tem botão próprio |
| `atenção` | pede decisão individual (abaixo) | **não** |
| `confere` | a fonte concorda com o que já está lá | não é pergunta, é confirmação |

**Campo que o João já preencheu nunca é sobrescrito sem ele mandar.** A
diferença entre "em branco" e "diverge" é justamente essa: preencher um vazio é
uma decisão barata, mudar o que ele escreveu não é.

Três coisas nascem como **atenção** e ficam fora de qualquer ação em lote:

1. **Troca de gênero.** O nome científico é gênero + epíteto: aceitar em lote
   renomearia a espécie caladamente. Isso é decisão de nomenclatura e se
   resolve pela Conferência taxonômica, que registra o nome antigo como
   sinônimo.
2. **Categoria de conservação cuja autoridade não é a IUCN.** Nem todo
   `conservation_status` do iNaturalist é da Lista Vermelha; muitos são listas
   regionais. Quando não é IUCN, o app **diz de quem é** e não propõe preencher
   a coluna IUCN.
3. **Espécie que a lista oficial só traz como subespécie** (ver abaixo).

### O que a grafia com hífen tem a ver com isso

A GBIF republica os nomes comuns na forma do CBRO, com hífen
(`papagaio-de-peito-roxo`). A planilha do João usa a forma sem hífen. São o
**mesmo nome**: tratar isso como divergência encheria a tela de 45 decisões
sobre hífen, que é exatamente o tipo de trabalho manual que esta rodada existe
para acabar. Vira classe própria, com botão próprio.

### O silêncio da fonte não é dado

O iNaturalist **só publica `conservation_status` para quem não é "pouco
preocupante"**. Traduzir essa ausência em `LC` seria inventar categoria de
conservação no laudo. O app conta quantos táxons voltaram sem categoria e diz,
na tela, que **ausência de resposta não quer dizer LC**.

### Procedência

Todo valor aceito grava em `taxon.procedencia[campo]`:

```json
{ "valor": "(Kuhl, 1820)",
  "fonte": "GBIF · species/match",
  "consultadoEm": "2026-08-05T13:44:20.150Z",
  "aceitoEm":     "2026-08-05T13:49:54.563Z" }
```

O laudo ganha a seção **Procedência dos dados**, com uma linha por fonte:
quantos campos vieram dela, em quantas espécies, e as datas da consulta mais
antiga e da mais recente. É o que permite ao responsável técnico responder de
onde saiu cada número que ele assina.

### O que saiu nas 60 espécies do exemplo de avifauna

Rodado em `http://localhost:8081/`, contra as APIs de verdade, em 05/08/2026 —
69 s para os 60 táxons (3 chamadas por espécie, 120 ms de pausa entre elas):

| Campo | em branco | diverge | grafia | confere |
|---|---|---|---|---|
| Reino, Filo, Classe | 0 | 0 | 0 | 60 cada |
| Ordem | 0 | 2 | 0 | 58 |
| Família | 0 | 4 | 0 | 56 |
| Gênero | 0 | 3 *(→ atenção)* | 0 | 57 |
| **Autor e ano** | **60** | 0 | 0 | 0 |
| **Chave GBIF** | **60** | 0 | 0 | 0 |
| Nome comum | 0 | 17 | 28 | 14 |
| IUCN | 1 | 1 | 0 | 1 |
| Portaria MMA | 1 | 0 | 0 | 0 |

**513 propostas ao todo: 122 campos em branco a preencher, 24 divergências, 28
de grafia, 4 de atenção e 366 confirmações.** Nenhuma fonte falhou; nenhum
táxon ficou sem resposta.

O que ficou **sem resposta**, e por quê:

- **57 de 60 táxons sem categoria IUCN** — o iNaturalist não publica a
  categoria de espécie "pouco preocupante", que é a maioria de uma avifauna
  comum. A coluna IUCN continua manual para elas.
- **1 táxon sem nome comum em português** (`Hydropsalis parvula`) — nem a GBIF
  nem o iNaturalist têm um. É o mesmo táxon cujo nome aceito hoje é *Setopagis
  parvula*; resolvida a sinonímia, o nome comum aparece.
- **58 de 60 fora da Lista Nacional** — o esperado: a lista tem 280 aves, e
  uma avifauna comum de Mata Atlântica quase não a toca.

Aceitando só os campos em branco e a grafia, num clique cada: **60 autorias, 60
chaves GBIF e 28 nomes comuns** entram de uma vez. Antes, eram 148 campos
digitados um a um.

---

## Listas oficiais brasileiras embutidas

**A de maior valor legal, e a única que não depende de rede.**

`js/listas-oficiais.js` traz os **1.407 táxons** da Lista Nacional de Espécies
da Fauna Ameaçadas de Extinção — Portal Brasileiro de Dados Abertos
(`dados.gov.br`), Ministério do Meio Ambiente, licença **Creative Commons
Atribuição**. O CSV de origem fica em `dados/fauna-ameacada-2021.csv` e a
conversão é feita fora do navegador, por `gerar-listas.py`, porque o app é de
zero dependências.

As categorias vêm por extenso no CSV e viram sigla: `Criticamente em Perigo
(CR)` → `CR`, `Em Perigo (EN)` → `EN`, `Vulnerável (VU)` → `VU`,
`Regionalmente Extinta (RE)` → `RE`, `Extinta (EX)` → `EX`, `Extinta na
Natureza (EW)` → `EW`. A marca `(PEX)` — provavelmente extinta — é preservada
à parte. Os nomes são normalizados para **comparar** (minúsculas, sem acento,
espaços colapsados) e a **grafia original é preservada** para exibir.

`RE`, `EW` e `EX` entraram no domínio da coluna *Portaria MMA* e na lista de
categorias que caracterizam ameaça. Uma espécie regionalmente extinta continua
**na** lista, e sumia do laudo porque o campo não sabia representá-la.

**O cruzamento roda sozinho**, sem clique e sem internet: é consulta a um
arquivo que já está no app. Toda vez que a tela de Táxons desenha, todo táxon
do catálogo é conferido.

### O caso de regressão — confirmado

No exemplo de avifauna, **`Amazona vinacea` é `VU` na lista oficial e o
atributo `listaNacional` está vazio**. O resumo da planilha de origem declarava
*"Ameaçada BR: 0"*. O correto é **1**.

O app aponta isso em três lugares:

- **Táxons**, com o número em terracota e a frase: *"O catálogo declara 0
  espécies ameaçadas na Portaria do MMA, e a lista oficial aponta 1. Um laudo
  que informa o número errado de espécies ameaçadas é passivo."*
- **Resultados**, dentro de *Espécies de interesse*, com a mesma comparação e a
  tabela de conferência.
- **Laudo**, na seção *Conferência contra a Lista Nacional*, que sai mesmo
  quando tudo confere — porque afirmar que conferiu é parte do que ele assina.

**Total de divergências contra a lista oficial no exemplo: 2 táxons dos 60.**

| Espécie | No catálogo | Na lista oficial | Situação |
|---|---|---|---|
| *Amazona vinacea* | (em branco) | `VU` (2021) | **falta preencher** — é o caso de regressão |
| *Thamnophilus caerulescens* | (em branco) | `VU` (2021) | **só a subespécie consta** |

O segundo é a diferença jurídica que o app **não** pode apagar: a lista traz
`Thamnophilus caerulescens cearensis` e `T. c. pernambucensis`, duas
subespécies do Nordeste — **não** a espécie. Preencher a espécie com a
categoria da subespécie poria no laudo uma afirmação que a portaria não faz. O
app mostra quais subespécies são, **não conta a espécie como ameaçada**, e
deixa a decisão com quem assina.

### As duas honestidades obrigatórias

Aparecem na tela onde o dado aparece, e no laudo:

1. **Este CSV é o documento de reavaliação de 2021, não o anexo literal da
   Portaria MMA nº 148/2022**, que é o ato com força legal e substituiu a
   444/2014. Serve como triagem; a conferência contra a portaria é obrigatória
   antes de assinar.
2. **Nenhuma lista estadual está embutida.** Não há fonte legível por máquina
   da Deliberação Normativa COPAM 147/2010 (MG) nem das demais. A estrutura
   está pronta (`LISTAS_OFICIAIS.ESTADUAIS`) e **vazia de propósito**: a coluna
   *Lista estadual* continua manual. O app não inventa dado estadual.

---

## Dados secundários pela GBIF

Na planilha, a aba `Outros` trazia **uma** referência bibliográfica digitada à
mão, e a comparação primário × secundário era feita no olho. A tela
**Secundários** troca isso pela lista inteira do que já foi publicado na
região:

```
GET api.gbif.org/v1/occurrence/search
    ?geoDistance={lat},{lon},{raio}km
    &taxonKey={chave da classe}
    &limit=0&facet=speciesKey&facetLimit=400&hasCoordinate=true
```

Cada `speciesKey` do facet é resolvido em `api.gbif.org/v1/species/{key}`, em
lotes de 5 com pausa, e **guardado no `localStorage` com a data** — a segunda
rodada é instantânea.

A chave da classe é **descoberta na GBIF** a partir do grupo do projeto
(`species/match?name=Aves&rank=CLASS`), nunca cravada no código. Herpetofauna é
o caso que prova a regra: não é uma classe, são duas (Amphibia + Reptilia), e
por isso o campo em `js/dados.js` é uma lista de nomes.

### O que saiu para Mariana/MG — 20 km, Aves

Rodado em 05/08/2026:

| | |
|---|---|
| Ocorrências na área | **12.619** |
| Espécies (facet `speciesKey`) | **383** |
| Resolvidas em nome | **383** (nenhuma falhou) |
| Riqueza do levantamento primário | 49 |

O cruzamento nas três listas:

| Lista | Quantas | Para que serve no laudo |
|---|---|---|
| **Exclusivas do primário** | **7** | é o valor do trabalho de campo |
| **Em comum** | **42** | corrobora o levantamento |
| **Esperadas para a região, não detectadas** | **341** | **é a que dá argumento** |

Cobertura de 11 % do que a região tem; Jaccard 10,8 %. As esperadas saem
**ordenadas por número de ocorrências na GBIF** — a ordem em que a ausência
pesa mais. As dez primeiras: *Coereba flaveola* (211), *Chiroxiphia caudata*
(181), *Pyriglena leucoptera* (157), *Tachyphonus coronatus* (146), *Elaenia
flavogaster* (144), *Tangara cyanoventris* (143), *Synallaxis spixi* (140),
*Myiozetetes similis* (138), *Aratinga leucophthalma* (137), *Coragyps atratus*
(136).

Ou o esforço foi insuficiente, ou essas espécies deixaram a área. **As duas
conclusões são do laudo, e as duas precisam ser escritas por ele, não pelo
app.**

**O filtro exato e a data ficam gravados** e saem citados no laudo — sem isso o
número não vale nada:

> Fonte: GBIF · occurrence/search (geoDistance + facet speciesKey). Filtro:
> geoDistance −20.3778, −43.4161, 20 km · classe Aves (taxonKey 212) ·
> hasCoordinate=true · 12.619 ocorrências. Consultado em 05/08/2026 às 10:49.

**Uma armadilha declarada na tela:** o cruzamento é **por nome**. Espécie que
ainda está no catálogo com um sinônimo não casa com o nome aceito da GBIF e cai
em "exclusivas do primário" parecendo achado — foi o que aconteceu com
*Hydropsalis parvula* e *Pygochelidon cyanoleuca* nas 7 exclusivas do exemplo.
O app avisa para rodar a Conferência taxonômica antes de levar a comparação
para o laudo.

---

## Importar do eBird e do iNaturalist

Os dois entram por **Projetos → Importar dados** e caem na **mesma tela de
pré-visualização e mapeamento** que já existia: viram uma tabela Darwin Core e
seguem o caminho conhecido. Criar um segundo caminho de importação seria criar
um segundo lugar para dar errado — e a tela antiga já mostra o que vai entrar,
já rejeita linha ruim com motivo, e já **reaproveita a espécie que existe no
catálogo pelo nome normalizado, sem duplicar**.

### iNaturalist — sem chave

```
GET api.inaturalist.org/v1/observations?user_login={login}&taxon_id=…&per_page=200
```

Traz espécie, data, hora, coordenada, local, quantidade e o link da
observação. É o **caderno de campo de um usuário**, não uma varredura do banco.
Pagina sozinho até 10 páginas (2.000 observações); acima disso avisa que veio
truncado e manda exportar o CSV no site.

Observação identificada **acima do nível de espécie** (gênero, família) é
separada, contada e avisada — não entra na riqueza, porque inflaria o `S`.

Usuário que não existe devolve `422`, e o app diz *"O iNaturalist não conhece o
usuário X"* em vez de um erro de rede genérico.

### eBird — precisa de chave, e ela é gratuita

```
GET api.ebird.org/v2/data/obs/geo/recent?lat=…&lng=…&dist=…&back=…
Header: X-eBirdApiToken
```

A chave sai em minutos em `ebird.org/api/keygen`. Fica no **`localStorage`
deste aparelho** — **nunca no código**, nunca no backup JSON exportado. Um
campo nos parâmetros a guarda; deixá-lo vazio a apaga.

**Sem chave, o app funciona igual** — só o eBird fica de fora, com o aviso
dizendo onde consegui-la. Chave errada devolve `403`, e o app diz *"O eBird
recusou a chave (403)"* em vez de repetir o código HTTP.

Uma limitação declarada na própria tela: **a eBird não publica endpoint de
"minhas observações"** — o que existe é por área, com teto de 50 km e 30 dias.
Então o que entra é o que a comunidade registrou na região, e deve ser tratado
como dado de apoio, não como caderno pessoal.

---

## O cache das consultas

Tudo o que sai para a rede é guardado em `localStorage`, na chave
`searaFauna.cache.v1`, **com a data da consulta**. Consulta repetida não sai de
novo. Validades: 180 dias para taxonomia, 30 para ocorrências, 1 dia para
observações. As gravações são agrupadas (383 espécies resolvidas em sequência
não podem virar 383 serializações do cache inteiro), o cache é podado pelas
entradas mais velhas acima de 4.000, e se o `localStorage` encher ele descarta
metade e tenta de novo antes de desistir em silêncio.

**Sem rede, resposta velha é melhor do que resposta nenhuma** — desde que a
tela diga que é velha, e ela diz: toda resposta carrega `consultadoEm`, e é
essa data que aparece na tela e no laudo.

---

## Importação

**Projetos → Importar dados** oferece cinco caminhos: o backup JSON do app, uma
tabela CSV/TSV qualquer, Darwin Core, o iNaturalist e o eBird.

### Tabela CSV / TSV — mapeamento na tela

Você sobe o arquivo e o app mostra as colunas que encontrou. Para cada campo do
modelo — espécie, quantidade, unidade amostral, campanha, data, hora, nome
comum, ordem, família, método, tipo de registro, coordenadas, observador,
observação — você diz qual coluna é aquela. **O mapeamento fica guardado** por
assinatura do cabeçalho: da segunda vez que chegar um arquivo com as mesmas
colunas, ele já vem preenchido.

O separador é detectado sozinho (`;`, `,`, tabulação ou `|`), as aspas seguem a
RFC 4180 (inclusive quebra de linha dentro do campo), o BOM do Excel é
descartado, e a data entra tanto em `2026-03-04` quanto em `04/03/2026`.

**Nada é gravado antes da pré-visualização.** A tela mostra quantas linhas
entram, quantas espécies, quantos indivíduos, quantas campanhas e unidades, uma
amostra das linhas aceitas e **a lista das rejeitadas com o motivo de cada
uma** — nome científico em branco, só o gênero sem epíteto, quantidade não
numérica. Linha sem quantidade entra como 1 indivíduo, e o app diz quantas
foram.

### Darwin Core

Reconhecido sozinho, sem você mapear nada: `scientificName`,
`individualCount`, `eventDate`, `decimalLatitude`, `decimalLongitude`,
`samplingProtocol`, `recordedBy`, mais `locality`/`eventID` como unidade
amostral, `vernacularName`, `order`, `family` e `basisOfRecord`. É o que sai de
GBIF, eBird, iNaturalist e SiBBr.

O `samplingProtocol` vira método do app quando dá para reconhecer
(*camera trap* → armadilha fotográfica, *mist net* → rede de neblina,
*transect* → transecto…), e o `basisOfRecord` vira tipo de registro
(`MachineObservation` → foto, `PreservedSpecimen` → captura…). O intervalo de
datas do Darwin Core (`2026-01-19/2026-01-22`) entra pela data de início.

> **A tabela traz quem foi visto e onde, mas não o esforço.** Nenhuma unidade
> importada vem com esforço preenchido — o app avisa em tela e no painel de
> avisos. Sem esforço não há densidade.

### Planilha .xlsx

O app é de zero dependências, e ler `.xlsx` em JavaScript puro exigiria uma
biblioteca. Então essa conversão acontece **uma vez, fora do navegador**:

```bash
python3 importar.py "planilha de origem (avifauna)" -o planalto.json
```

Depois, no app: **Projetos → Importar dados → Backup JSON**. Ao importar com
projetos já existentes, o app pergunta se você quer *substituir* tudo ou
*juntar* — juntando, os táxons de mesmo nome são reaproveitados em vez de
duplicados.

`importar.py` requer `openpyxl` (`pip3 install openpyxl`). É dependência **do
script**, não do app.

Opções: `-n/--nome` define o nome do projeto; `--largura` define a largura da
faixa do transecto em metros (padrão 50).

### Mapeamento (§5 da especificação)

| Origem | Destino |
|---|---|
| `Inf campo` linha 2-3 de cada bloco | unidade amostral + esforço |
| `Inf campo` blocos de 46 linhas (10 blocos) | registros |
| `Autoecologia` linha 4 = cabeçalho, dados da 5 | táxon + atributos |
| `Resumo` B6:V17 | metadados das unidades (cada TST ocupa 2 colunas) |
| `Outros` J19:K20 | fonte dos dados secundários |

**O detalhe que quebra quem não presta atenção:** em `Autoecologia`, ordem e
família só aparecem na **primeira espécie de cada grupo** e ficam `0` nas
seguintes. É agrupamento visual do Excel, não dado ausente — o script arrasta o
último valor válido para baixo. Sem isso, 59 espécies viram 14 famílias soltas
e 45 sem família.

Outros dois cuidados do script:

- **`0` quer dizer “em branco”** na planilha do João, não zero.
- A aba `Autoecologia` termina com uma **linha de totais** (14 · 25 · 59) que cai
  exatamente na coluna do nome da espécie. O script exige que o valor tenha
  letra para aceitá-lo como nome.

### Conferência da importação dos dados reais

```
campanhas .............. 2
unidades amostrais ..... 10
registros .............. 85
indivíduos ............. 107
espécies (catálogo) .... 59
famílias ............... 25
ordens ................. 14
```

Bate com a planilha. O script ainda emite quatro avisos, que aparecem na tela
de Projetos:

1. **`Brachygalba lugubris`** aparece na ficha de campo (TST 05) mas não na aba
   `Autoecologia`, que traz `Jacamaralcyon tridactyla` no lugar — as abas
   derivadas (`Aves por TST´s`, `Pre autoec`, `Tab para laudo`) usam o segundo
   nome. Provável correção que o João fez depois e não voltou à ficha de campo.
   O script **não funde os dois por conta própria**: cria o táxon marcado como
   *fora do catálogo* e avisa. Por isso o catálogo tem 60 táxons: 59 da
   autoecologia + 1 divergência sinalizada.
2. **Nenhum dos 10 transectos tem comprimento** na planilha. Sem esforço não há
   densidade — o app avisa e deixa o campo para preencher.
3. **11 espécies do catálogo não têm registro em unidade amostral.** Na planilha
   elas vieram de observação ocasional, fora dos transectos. Por isso a riqueza
   observada nos transectos é **S = 49**, e não 59.
4. **A 2ª campanha está em branco** — na planilha as 12 abas existem
   duplicadas, mas sem dado nenhum.

O app também aceita **CSV** e **Darwin Core** pela mesma rota: converta para o
JSON com um script equivalente. (Ainda não implementado — ver pendências.)

---

## Pendências jurídicas sinalizadas no app

1. A lista embutida é a **reavaliação de 2021**, não o anexo literal da
   **Portaria MMA nº 148/2022** — que é o ato com força legal e substituiu a
   444/2014. O app cruza automaticamente e aponta divergência, mas declara a
   limitação onde o dado aparece: **serve como triagem, não substitui a
   conferência contra a portaria.**
2. **Nenhuma lista estadual está embutida.** Não há fonte legível por máquina
   da COPAM 147/2010 (MG) nem das demais. A coluna *Lista estadual* continua
   manual, e o app **não inventa dado estadual**.
3. **A API do IUCN proíbe uso comercial** — consultoria remunerada é uso
   comercial, e a alternativa deles (IBAT) é paga. Por isso o app **não
   consulta a IUCN**: a categoria chega pelo **iNaturalist**, que republica o
   dado sob termo próprio, e sempre com a **autoridade declarada na tela**.
   Quando a autoridade não é a IUCN, o app diz de quem é e **não** propõe
   preencher a coluna IUCN. As listas com força legal no laudo brasileiro são a
   **Portaria do MMA** e a **estadual**, atos normativos públicos.

Os três avisos aparecem na tela de Táxons (junto ao cruzamento), na de
Resultados (junto às espécies de interesse) e no laudo.

---

## Decisões de interface que não são cosméticas

- **Nome científico sempre em itálico**, e **nunca** `text-transform: uppercase`
  em nome científico, táxon ou notação. A caixa das letras carrega significado:
  gênero é maiúsculo, epíteto específico é minúsculo, e `Furnariidae` não é
  `FURNARIIDAE`. O CSS declara `text-transform: none !important` na classe
  `.cientifico` como trava.
- **A caixa É normalizada** nas siglas de domínio fechado (`VU`, `EN`, `CR`,
  `cam`, `ins`) — ali ela não carrega significado nenhum e a planilha traz
  `'vu'` e `'VU'` na mesma coluna. Sem isso, `Amazona vinacea` (IUCN `en`,
  COPAM `vu`) sumia da seção de espécies ameaçadas do laudo.
- **Abaixo de 900 px a navegação vira barra fixa no rodapé** — o João usa
  celular em campo. O `backdrop-filter` do cabeçalho é desligado nessa faixa:
  com ele ligado, o cabeçalho vira bloco de contenção e o `position: fixed` da
  barra se ancora nele em vez da janela, jogando a barra para o topo.
- Abaixo de 640 px a barra passa a **duas fileiras de 4 abas**. Em 8 colunas
  cada aba teria 45 px e os rótulos ficariam cortados.
- **O laudo nunca sai em modo escuro.** O bloco `@media print` redeclara as
  variáveis em `:root`, `:root[data-tema="escuro"]` e
  `:root:not([data-tema="claro"])`, porque `@media` não soma especificidade e
  um `:root` sozinho perde para o seletor de atributo.
- **Tabelas rolam dentro do próprio quadro**, nunca a página. O `<body>` tem
  `overflow-x: hidden`.

---

## Verificação feita

Rodado em `http://localhost:8081/` (a 8080 estava ocupada por outro app), com
automação no Chrome.

- Carrega sem nenhum erro no console; os 11 módulos sobem.
- **`testes.html`: 20 de 20 verificações conferem** contra a saída publicada do
  `vegan` (`specpool(dune, Management)` e `estimateR(BCI[1:5,])`), o exemplo de
  Heltshe & Forrester reimpresso em Krebs (Box 13.2) e o IC log-normal de Chao.
- **Exemplo de mastofauna, fluxo inteiro:** S = 23, N = 240, esforço 534
  armadilha-noite, densidade 0,449 ind/armadilha-noite; F1 = 4, F2 = 1,
  Q1 = 4, Q2 = 1, m = 22; Chao 1 = Chao 2 = 31,0, Jackknife 1 = 26,8,
  Bootstrap = 24,7. Conferidos na mão contra as fórmulas.
- **Autoecologia por grupo:** com o projeto de mastofauna aberto, "Dependência
  de mata" e "Sensibilidade a distúrbio" **somem** da tela de Táxons, dos
  gráficos de Resultados, da tabela do laudo e do CSV; entram "Hábito",
  "Período de atividade" e "Porte". Com o de avifauna, o oposto.
- **Comparação com N campanhas:** testada com 3 campanhas no exemplo de
  mastofauna e criando a 3ª e a 4ª campanha pela interface no de avifauna.
  Tabela com uma coluna por campanha, barras, matriz de Jaccard par a par,
  exclusivas de cada uma, comuns a todas e matriz de presença.
- **Importação CSV e Darwin Core:** arquivo Darwin Core com 8 linhas — 12
  colunas mapeadas sozinhas, 5 aceitas, 3 rejeitadas com o motivo certo
  (só o gênero; quantidade `x`; linha sem nome). Arquivo CSV brasileiro com
  `;` e datas `dd/mm/aaaa` — 2 campanhas e 4 unidades montadas, e as 4
  espécies que já existiam no catálogo **reaproveitadas em vez de duplicadas**.
- Verificação GBIF em lote nas 60 espécies de avifauna: 49 conferem, 11
  divergentes. As 23 espécies de mastofauna: **23/23 exatas e aceitas**.
- 390 px: sem rolagem lateral em nenhuma das 9 telas, nos dois exemplos; barra
  de rodapé colada embaixo; os atalhos de espécie viram uma faixa que rola
  sozinha, sem levar a página junto.
- Laudo impresso com o app em tema escuro: sai em fundo branco com texto
  escuro.

### Terceira rodada — automação, medida contra as APIs de verdade

Tudo abaixo foi rodado em `http://localhost:8081/` no Chrome, em 05/08/2026,
contra as APIs públicas — não contra respostas simuladas.

- **Autoecologia em lote nas 60 espécies de avifauna:** 69 s, 513 propostas
  (122 em branco, 24 divergências, 28 de grafia, 4 de atenção, 366
  confirmações). Nenhuma fonte falhou, nenhum táxon ficou sem resposta.
  Aceitando em lote: 60 autorias, 60 chaves GBIF e 28 nomes comuns gravados,
  cada um com fonte e data em `procedencia`.
- **Lista Nacional:** 1.407 táxons carregados; `Amazona vinacea` → `VU` (2021)
  com o campo em branco no catálogo — **o caso de regressão, confirmado**; e o
  aviso *"o catálogo declara 0 e a lista oficial aponta 1"* em Táxons,
  Resultados e no laudo. `Thamnophilus caerulescens` corretamente classificado
  como "só a subespécie consta" e **fora** da contagem de ameaçadas.
- **Dados secundários, Mariana/MG, 20 km, Aves:** 12.619 ocorrências, 383
  espécies, 383 resolvidas em nome em 30 s (com o cache quente, instantâneo).
  Cruzamento: 7 exclusivas do primário, 42 em comum, 341 esperadas não
  detectadas.
- **iNaturalist:** consulta real de observações → tabela Darwin Core → o
  importador reconhece **as 12 colunas sozinho** e monta o plano. Importado
  pela interface: **nenhum táxon duplicado** (60 → 61, uma espécie nova), e
  `origemDados` gravado no projeto.
- **Degradação de rede:** com `api.gbif.org`, `api.inaturalist.org` e
  `api.ebird.org` bloqueados — a tela de Táxons desenha, o **cruzamento com a
  lista oficial continua funcionando** (é offline), a autoecologia em lote para
  no primeiro táxon em vez de insistir 60 vezes e diz qual fonte não respondeu,
  a busca de secundários avisa *"Sem conexão com a GBIF. O resto do app
  continua funcionando"*, e o laudo abre inteiro. **Zero erros de página.**
- **eBird sem chave:** mensagem explicando onde conseguir a chave gratuita, sem
  travar nada. **Com chave inválida:** *"O eBird recusou a chave (403)"*.
  ⚠️ **Não foi testado com uma chave válida** — não há chave nesta máquina.
- **390 px, com a 9ª aba:** a barra de navegação passou a duas fileiras de 5. O
  rótulo "Secundários" e os botões de ação longos estavam estourando a largura
  da tela; corrigido com `minmax(0, 1fr)` nas colunas de grid e `min-width: 0`
  nos itens. Medido de novo: **`scrollWidth` = `clientWidth` = 390 nas 9
  telas**, e 1280 no desktop.

## Velocidade de lançamento — medida, não achada

O João passa o tempo dele na tela de Registros. Antes de mexer, foi cronometrado
o lançamento de **20 registros** com automação no Chrome, sobre o catálogo de 60
espécies da Mineração — exemplo (Mariana/MG), digitando a 60 ms por tecla.

O protocolo é o mesmo nos dois lados: **o menor texto que põe a espécie-alvo no
topo do autocompletar**, mais as teclas necessárias para o registro entrar.

| | caracteres | Enter | ações | tempo | por registro |
|---|---|---|---|---|---|
| **Antes** | 111 | 40 | 152 | 7,28 s | 0,364 s |
| **Depois** | 68 | 20 | 89 | 4,42 s | 0,221 s |
| **Depois, usando os atalhos** | 58 | 20 | 79 | 3,82 s | 0,191 s |

**−41 % de ações e −39 % de tempo**; com os atalhos, −48 % e −48 %.

O que a medição mostrou, e que não era o palpite:

- **O ganho não veio da abreviação.** Forçar `cerd tho` (4+3 letras) chegou a
  gastar *mais* caracteres que o prefixo do nome, porque na maioria dos casos
  quatro letras do gênero já desempatam sozinhas. A abreviação vale para os
  gêneros disputados (`Turdus`, `Tyrannus`, `Thraupis`), não em geral — e por
  isso ela entrou como *possibilidade*, não como formato obrigatório.
- **O ganho veio de eliminar o segundo `Enter`.** Eram dois: um para escolher
  na lista, outro para lançar. Agora é um só — metade das teclas de comando.
- **E de o ranking pôr a espécie certa em primeiro mais cedo**, com a
  pontuação por prefixo de gênero e de epíteto e o empurrão de quem acabou de
  ser lançado (111 → 68 caracteres).

O que mudou no lançador:

- **Busca por abreviação e por pedaços.** Cada pedaço digitado precisa ser
  começo de alguma palavra do nome científico, do nome comum ou da família.
  `cerd tho` acha *Cerdocyon thous*; `cachorro` também.
- **Quantidade no fim do próprio campo:** `cerd tho 3` lança três.
- **Um `Enter` só**, e o foco volta para o nome sem redesenhar a tela — era no
  ciclo de foco do redesenho que a primeira letra do próximo nome se perdia
  quando se digita rápido.
- **Atalhos das últimas lançadas** nesta unidade: um toque lança um indivíduo,
  sem digitar nada. É o caso da armadilha fotográfica, onde a mesma espécie
  volta o dia inteiro.
- **Tipo de registro com padrão pelo método:** foto na armadilha fotográfica,
  captura na rede e no pitfall, visual no resto.
- No celular, a quantidade abre **teclado numérico** (`inputmode="numeric"`).

O `Tab` continua indo para a quantidade, as setas continuam trocando o item da
lista, e clicar no botão *Lançar* continua funcionando.

### O que ficou de fora

- **A lista estadual continua manual.** Não há fonte legível por máquina da
  COPAM 147/2010 nem das demais estaduais. A estrutura para recebê-las está
  pronta e vazia.
- **O eBird não foi testado com chave válida** — não há chave nesta máquina. O
  caminho sem chave e o caminho com chave errada foram, e os dois degradam com
  aviso claro. O endpoint escolhido (`data/obs/geo/recent`) é o que existe: a
  eBird não publica "minhas observações", e o teto de 50 km / 30 dias é da API.
- **A categoria IUCN cobre pouco.** O iNaturalist só publica
  `conservation_status` de quem não é "pouco preocupante" — no exemplo de
  avifauna, 57 de 60 táxons voltaram sem categoria. O app declara isso na tela;
  não há como distinguir "LC" de "não avaliada" por esta via.
- **A lista bibliográfica nominal** continua digitada à mão (Secundários →
  Lista bibliográfica digitada). A comparação com a GBIF não a substitui quando
  há um levantamento publicado que valha citar nominalmente.
- **A busca de secundários não sugere a coordenada do município.** Se nenhuma
  unidade amostral tem coordenada, o ponto é digitado — o app prefere pedir a
  chutar.
- **O cruzamento de secundários é por nome literal.** Sinônimo não resolvido no
  catálogo aparece como exclusivo do primário. Está avisado na tela, mas não há
  resolução automática de sinonímia no cruzamento.
- **Foto do registro** é um campo de texto, não upload — imagem em
  `localStorage` estouraria a cota rápido.
- **A curva do coletor ainda usa bootstrap** para o intervalo. O Mao Tau tem
  variância analítica publicada (Colwell, Mao & Chang 2004), que não foi
  implementada; só os estimadores ganharam o IC analítico.
- **O Jackknife 2 continua sem IC** — de propósito, ver acima.
- **A importação de tabela cria sempre um projeto novo.** Não há caminho para
  acrescentar linhas a um projeto que já existe.
- **A autoecologia do exemplo de mastofauna é ilustrativa**, inclusive as
  categorias de ameaça. Precisa ser conferida contra a Portaria MMA vigente e a
  lista estadual antes de virar laudo.
- **Só aves e mastofauna têm catálogo próprio de autoecologia.** Herpetofauna,
  ictiofauna e entomofauna caem nos atributos gerais — o modelo aguenta
  (é acrescentar linhas em `js/dados.js`), mas ninguém escreveu ainda.
