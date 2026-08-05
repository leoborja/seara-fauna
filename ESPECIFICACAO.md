# Fauna — Especificação do modelo

> Derivado de `planilha de origem (avifauna)` (levantamento de avifauna para
> licenciamento, Mariana/MG, 2 campanhas, 10 transectos, 59 espécies).
>
> **Princípio:** nada no núcleo pode ser específico de ave ou de transecto.
> A planilha de origem é; por isso ela não escala.

---

## 1. Modelo de dados

```
Projeto ─┬─ Campanha ─┬─ Unidade amostral ─── Registro ──┐
         │            │        │                         │
         │            │     Método                    Táxon ── Atributos
         │            │  (unidade de esforço)                 (autoecologia)
         └─ Config    └─ sazonalidade
```

### Projeto
`id · nome do empreendimento · cliente · município · uf · órgão licenciador ·
processo · responsável técnico · registro profissional · observações`

### Campanha
`id · projeto · rótulo · sazonalidade (chuva | seca | —) · data início · data fim ·
equipe · observações`

> A planilha assume exatamente 2 campanhas e duplica 12 abas para a segunda.
> Aqui são **N**, sem limite e sem duplicação de estrutura.

### Método — a peça central
Cada método declara **sua própria unidade de esforço**. É isso que permite
comparar levantamentos diferentes e que faz o modelo servir a qualquer grupo.

| Método | Unidade de esforço | Campos próprios |
|---|---|---|
| Transecto | km percorrido | comprimento, largura da faixa |
| Ponto de escuta | hora·ponto | raio, duração |
| Armadilha fotográfica | armadilha-noite | nº de câmeras, noites |
| Pitfall | balde-noite | nº de baldes, noites |
| Rede de neblina | m²·h | nº de redes, área, horas |
| Busca ativa | hora·pessoa | nº de observadores, horas |
| Playback | hora | duração, espécies alvo |
| Rede de pesca / peneira | m²·h | área, horas |

**Esforço é obrigatório.** Abundância relativa sem esforço não significa nada,
e é o que hoje impede a planilha de juntar métodos.

### Unidade amostral
`id · campanha · método · código (TST 01…) · latitude · longitude · altitude ·
fitofisionomia · área de influência (ADA | AID | AII) · data · hora início ·
hora fim · condições (nebulosidade, vento, temperatura) · esforço {valor, unidade}`

**Fórmula do esforço no transecto, herdada da planilha** (`Inf campo` L3):
```
área (ha) = (comprimento_km × 1000 × largura_m) / 10.000
```
A planilha crava `largura_m = 50`. No app vira parâmetro do método — 50 m é o
padrão, mas ponto de escuta e rede usam outra coisa.

### Registro
`id · unidade amostral · táxon · quantidade · tipo (visual | auditivo | vestígio |
captura | carcaça | foto) · data · hora · observador · foto · observação`

### Táxon
`id · reino · filo · classe · ordem · família · gênero · espécie · nome comum ·
autor · status taxonômico · chave GBIF · sinônimo de`

Serve para qualquer grupo — não há campo de ave aqui.

### Atributo de táxon (autoecologia)
Chave-valor **por grupo**, extensível sem tocar em código.

> **Como foi implementado:** `DADOS.atributosDoGrupo(grupo)` devolve os
> atributos de `todos` mais os próprios do grupo, uma entrada por chave. A
> mesma chave pode ter **domínio diferente por grupo** — `dieta` traz
> nectarívora em aves e folívora em mastofauna. `dependenciaMata` e
> `sensibilidade` são declaradas de **aves** (Silva 1995 e Stotz et al. 1996
> são escalas de ave) e somem em mastofauna, onde entram `habito`,
> `atividade` e `porte`. Nenhuma tela conhece a lista.

Exemplo de registro:

```
{ taxonId, grupo: 'aves', chave: 'dependenciaMata', valor: '1', fonte: 'Stotz et al.' }
```

Catálogo inicial de aves, tirado da planilha (`Autoecologia`, linha 4):

| Chave | Rótulo | Domínio |
|---|---|---|
| `iucn` | IUCN | LC, NT, VU, EN, CR, DD |
| `listaNacional` | Portaria MMA | VU, EN, CR (ver §6) |
| `listaEstadual` | Lista estadual (COPAM 147 em MG) | VU, EN, CR |
| `sensibilidade` | Sensibilidade a distúrbio | b, m, a |
| `endemismo` | Endemismo | Brasil, M. Atlântica, Cerrado, — |
| `dependenciaMata` | Dependência de mata | 1 independente, 2 semidep., 3 dependente |
| `habitat` | Hábitat preferencial | cam (campestre), flo, aqu, gen |
| `dieta` | Guilda trófica | car, nec, gen, ins, fru, gra, oni, det |
| `migratoria` | Migratória | sim, não, parcial |
| `cinegetica` | Cinegética | sim, não |
| `exotica` | Exótica | sim, não |

---

## 2. Índices — **calcular, não colar**

> A planilha **não calcula nenhum deles**. As abas `Dives` e `Estimates` só têm
> referências e somas; o cabeçalho diz literalmente *"Colar aqui os valores"*.
> Ele roda o EstimateS por fora. Implementar isso mata a dependência.

Sendo `S` a riqueza observada, `N` o total de indivíduos, `ni` a abundância da
espécie *i* e `pi = ni/N`:

```
Riqueza                S = número de espécies

Simpson (dominância)   D  = Σ [ ni(ni−1) ] / [ N(N−1) ]
Simpson (diversidade)  1−D
Simpson (recíproco)    1/D
Equitabilidade Simpson E  = (1/D) / S

Shannon                H' = − Σ ( pi × ln pi )
Equitabilidade Pielou  J' = H' / ln(S)

Densidade              indivíduos / esforço   (ex.: ind/ha, ind/armadilha-noite)
Abundância relativa    ni / N
Frequência de ocorrência  (nº de unidades onde ocorre) / (nº total de unidades)
```

## 3. Estimadores de riqueza

`F1`, `F2` = espécies com 1 e 2 **indivíduos** (abundância)
`Q1`, `Q2` = espécies em 1 e 2 **unidades amostrais** (incidência)
`m` = número de unidades amostrais

```
Chao 1                 S + F1² / (2·F2)
Chao 1 corrigido       S + F1(F1−1) / (2(F2+1))          ← usar quando F2 = 0

Chao 2                 S + Q1² / (2·Q2)
Chao 2 corrigido       S + ((m−1)/m) · Q1(Q1−1) / (2(Q2+1))

Jackknife 1            S + Q1 · (m−1)/m
Jackknife 2            S + Q1(2m−3)/m − Q2(m−2)² / (m(m−1))

Bootstrap              S + Σ (1 − pk)^m,  pk = proporção de unidades com a espécie k
```

**Curva de rarefação** (Mao Tau, baseada em indivíduos) — a curva do coletor:
```
E[Sn] = Σ_i [ 1 − C(N−ni, n) / C(N, n) ]
```
Calcular com logaritmo de fatorial para não estourar em N grande.

Todo estimador acompanha **intervalo de confiança 95 %** — é o que a planilha
importa do EstimateS (`S(est) 95% CI Lower/Upper Bound`).

> **Como foi implementado** (nota posterior à especificação): intervalo
> log-normal de Chao (1987, *Biometrics* 43:783–791, eqs. 11–12) sobre a
> variância analítica de cada estimador, com a fonte de cada fórmula declarada
> na tela e no laudo. Uma exceção: **o Jackknife 2 sai sem IC**, porque não
> existe variância analítica publicada para o jackknife de segunda ordem —
> a documentação do `vegan::specpool` registra a lacuna. Ver `README.md`,
> "O intervalo de confiança", e `testes.html` para a conferência numérica.

---

## 4. Integrações externas

Testadas nesta máquina em 04/08/2026 contra as 59 espécies reais:

| Fonte | Chave | Custo | Resultado no teste |
|---|---|---|---|
| **GBIF** `api.gbif.org/v1/species/match` | não precisa | grátis | **58/59 exatas** |
| **iNaturalist** `api.inaturalist.org/v1/taxa` | não precisa | grátis | traz status de conservação |
| **IUCN Red List** | token | grátis | **uso comercial proibido** — ver §6 |

O que a GBIF devolve: `usageKey · scientificName · canonicalName · rank · status
(ACCEPTED/SYNONYM) · confidence · matchType · kingdom → species · family`.

> **Como foi implementado** (nota posterior à especificação): a hierarquia
> completa que a GBIF já devolvia era **descartada**. Passou a alimentar o
> preenchimento automático da autoecologia, junto de mais três fontes:
>
> | Fonte | O que traz |
> |---|---|
> | `species/match` | reino → gênero, autoria, ano, `usageKey` |
> | `species/{key}/vernacularNames` | nome comum, filtrando `language: "por"` |
> | `api.inaturalist.org/v1/taxa` | categoria de conservação e nome comum `pt-BR` |
> | Lista Nacional embutida (§6) | categoria da Portaria — **offline** |
>
> A regra de ouro vale para todas: cada campo vira uma proposta com **valor
> atual × valor proposto × fonte × data da consulta**, e o responsável técnico
> aceita ou recusa uma a uma, ou em lote. Campo já preenchido nunca é
> sobrescrito sem ordem expressa; a diferença entre "campo em branco" e
> "diverge do que você preencheu" é explícita na tela. Todo valor aceito grava
> `procedencia` (fonte, `consultadoEm`, `aceitoEm`), que sai numa seção própria
> do laudo.
>
> Três classes de proposta nascem fora de qualquer ação em lote: **troca de
> gênero** (mudaria o nome científico), **categoria cuja autoridade não é a
> IUCN** (o iNaturalist republica listas regionais também) e **espécie que a
> lista oficial só traz como subespécie**.
>
> **Dados secundários** deixaram de ser uma referência digitada à mão:
> `occurrence/search` com `geoDistance` e `facet=speciesKey` devolve tudo o que
> foi publicado num raio, e o cruzamento sai em três listas — exclusivas do
> primário, em comum, e **esperadas para a região mas não detectadas**. A chave
> da classe é perguntada à GBIF (`species/match?rank=CLASS`), não cravada.
>
> **eBird e iNaturalist** entram pelo importador que já existia: viram tabela
> Darwin Core e caem na tela de pré-visualização e mapeamento, que já
> reaproveita táxon existente sem duplicar. A chave do eBird mora no
> `localStorage` do aparelho — nunca no código — e sem ela só o eBird fica
> indisponível.

**Regra de ouro:** a API **sugere**, nunca sobrescreve. Toda divergência vira um
aviso que o responsável técnico aceita ou recusa — a assinatura do laudo é dele.

Achados reais do teste (usar como caso de regressão):

| Espécie na planilha | O que a GBIF apontou |
|---|---|
| família `Furariidae` (10 ocorrências) | erro de digitação de **Furnariidae** — saiu no laudo |
| `Hydropsalis parvula` | hoje é **Setopagis parvula** (Gould, 1837) |
| `Geranoaetus albicaudatus` | sinônimo |
| `Pygochelidon cyanoleuca` | sinônimo |
| `Icterus jamacaii` | sinônimo |
| `Psittacara leucophthalmus` | sinônimo |
| `Todirostrum poliocephalum` | planilha: Rhynchocyclidae · GBIF: Tyrannidae |

O último **não é erro** — é divergência real entre autores sobre desmembrar
Rhynchocyclidae de Tyrannidae. Mostrar as duas, deixar ele escolher.

---

## 5. Importação

**Da planilha dele** (mapeamento direto, é o caso de teste):

| Origem | Destino |
|---|---|
| `Inf campo` linha 2-3 | unidade amostral + esforço |
| `Inf campo` blocos de 46 linhas (10 blocos) | registros |
| `Autoecologia` linha 4 = cabeçalho, dados da 5 | táxon + atributos |
| `Resumo` B6:R17 | metadados das unidades |
| `Outros` | dados secundários e áreas prioritárias |

**Atenção na leitura:** em `Autoecologia`, ordem e família só aparecem na primeira
espécie do grupo e ficam `0` nas seguintes — é agrupamento visual. Tem que
arrastar o último valor válido.

Também aceitar **CSV** e **Darwin Core** (padrão do GBIF), que é o que sai de
eBird, iNaturalist e SiBBr.

---

## 6. Pendências jurídicas — sinalizar no app

1. **A planilha usa a Portaria MMA 444/2014**, substituída pela **148/2022**.
   Lista desatualizada em laudo oficial é passivo. Confirmar com o João.
2. **A API do IUCN proíbe uso comercial** (consultoria remunerada é uso comercial;
   a alternativa deles é o IBAT, pago). As listas com força legal no laudo
   brasileiro são a **Portaria do MMA** e a **estadual** — atos normativos
   públicos, livres. Embutir essas; IUCN só como referência via GBIF/iNaturalist.

> **Como foi implementado** (nota posterior à especificação): a lista nacional
> está **embutida** em `js/listas-oficiais.js` — 1.407 táxons do Portal
> Brasileiro de Dados Abertos (MMA, licença Creative Commons Atribuição),
> convertidos do CSV por `gerar-listas.py`. O cruzamento é **offline** e roda
> sozinho: é consulta pura.
>
> Duas limitações são declaradas na tela e no laudo, não escondidas:
>
> - O CSV é o documento de **reavaliação de 2021**, **não** o anexo literal da
>   Portaria 148/2022. Serve como triagem; a conferência contra a portaria
>   continua obrigatória.
> - **Nenhuma lista estadual** foi encontrada em formato legível por máquina —
>   nem a COPAM 147/2010 (MG). A estrutura (`LISTAS_OFICIAIS.ESTADUAIS`) está
>   pronta e **vazia de propósito**; a coluna continua manual.
>
> O domínio de `listaNacional` ganhou `RE`, `EW` e `EX`, que a lista usa e que
> o campo não sabia representar — uma espécie regionalmente extinta continua
> **na** lista.
>
> **Caso de regressão fixado:** no exemplo de avifauna, `Amazona vinacea` é
> `VU` na lista oficial com `listaNacional` vazio. O resumo da planilha de
> origem declarava "Ameaçada BR: 0"; o correto é 1. O app compara os dois
> números e aponta a divergência com destaque em Táxons, em Resultados e no
> laudo. `Thamnophilus caerulescens`, que a lista traz apenas como duas
> subespécies do Nordeste, é sinalizado **sem** ser contado como ameaçado — a
> lista protege a subespécie, não a espécie.

---

## 7. Saídas

- Tabela de espécies com autoecologia (a `Tab para laudo`)
- Riqueza e abundância por unidade amostral e por campanha
- Curva do coletor / rarefação com IC 95 %
- Composição por ordem, família e guilda trófica
- Espécies de interesse: ameaçadas, endêmicas, migratórias, cinegéticas, exóticas
- Comparação dados primários × secundários (exclusivas e em comum)
- Comparação entre campanhas
- Laudo A4 imprimível
