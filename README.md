# Seara Biologia — Levantamento de Fauna

App web estático para levantamento de fauna em licenciamento ambiental.
Substitui a planilha de 30 abas: modela N campanhas sem duplicar estrutura,
**calcula** os índices e estimadores em vez de colar valores do EstimateS — com
o intervalo de confiança log-normal de Chao e a fonte de cada variância no
próprio laudo — e confere a nomenclatura contra a GBIF.

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
index.html            8 telas + os símbolos SVG da marca
testes.html           conferência numérica do motor contra exemplos publicados
css/estilo.css        paleta verde-folha #1B5E3F + terracota #B4633A, claro e escuro
js/dados.js           métodos e unidades de esforço, autoecologia POR GRUPO, avisos legais
js/motor.js           índices, estimadores, variâncias, rarefação — funções puras
js/graficos.js        curva do coletor, barras, roscas, dot-and-whisker — SVG à mão
js/gbif.js            consulta e comparação com a GBIF
js/exemplos.js        os dois projetos de demonstração (avifauna e mastofauna)
js/importador.js      leitor genérico de CSV / TSV / Darwin Core
js/armazenamento.js   localStorage, CRUD, export/import JSON e CSV
js/app.js             interface e eventos
assets/               marca, ícones, selo, favicon
importar.py           conversor .xlsx → JSON do app
exemplo-planalto.json planilha da Mineração — exemplo (Mariana/MG) já convertida
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

## As 8 telas

| Tela | O que faz |
|---|---|
| **Projetos** | Empreendimento: cliente, município/UF, órgão, processo, responsável técnico |
| **Campanhas** | N campanhas por projeto, com sazonalidade. Sem limite, sem duplicação |
| **Unidades amostrais** | Método, código, geo, ambiente, condições e **esforço** |
| **Registros** | Lançamento rápido: autocompletar de espécie, `Enter` salva e devolve o foco |
| **Táxons / Autoecologia** | Catálogo com os atributos **do grupo escolhido** e o botão de verificar na GBIF |
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

## Importação

**Projetos → Importar dados** oferece três caminhos: o backup JSON do app, uma
tabela CSV/TSV qualquer, e Darwin Core.

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

1. A planilha usa a **Portaria MMA 444/2014**, substituída pela **148/2022**.
   Lista desatualizada em laudo oficial é passivo. **Confirmar com o João** qual
   deve valer.
2. **A API do IUCN proíbe uso comercial** — consultoria remunerada é uso
   comercial, e a alternativa deles (IBAT) é paga. Por isso o app **não consulta
   a IUCN**: a categoria é digitada pelo responsável técnico, como referência.
   As listas com força legal no laudo brasileiro são a **Portaria do MMA** e a
   **estadual**, atos normativos públicos.

Os dois avisos aparecem na tela de Resultados, junto às espécies de interesse.

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

- Carrega sem nenhum erro no console; os 7 módulos sobem.
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
- 390 px: sem rolagem lateral em nenhuma das 8 telas, nos dois exemplos; barra
  de rodapé colada embaixo; os atalhos de espécie viram uma faixa que rola
  sozinha, sem levar a página junto.
- Laudo impresso com o app em tema escuro: sai em fundo branco com texto
  escuro.

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

- **A lista de dados secundários** é digitada à mão (Resultados → Dados
  primários × secundários → Editar lista); não é lida da planilha, que também
  não a traz.
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
