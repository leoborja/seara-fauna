/* ============================================================================
   Seara Biologia — Fauna — motor.js
   Índices, estimadores de riqueza e rarefação.
   TODAS as funções são puras: recebem dados, devolvem dados. Nenhuma toca no
   DOM, nenhuma lê o estado global. É isto que permite conferir os números.

   Fórmulas conforme ESPECIFICACAO.md §2 e §3, ao pé da letra.

   A especificação pede IC 95 % mas não diz como calcular. Os ESTIMADORES usam
   o intervalo log-normal de Chao (1987) sobre a variância analítica de cada um
   — é o intervalo do EstimateS, e cada fórmula tem a fonte no comentário, em
   §3b. `testes.html` confere todas contra exemplo publicado com número
   conhecido. Nenhuma variância foi escrita de memória.

   Só a CURVA DE RAREFAÇÃO continua com intervalo por reamostragem bootstrap
   (200 repetições). A semente é fixa de propósito: o mesmo conjunto de dados
   tem que devolver sempre o mesmo intervalo, senão o laudo assinado não é
   reproduzível.
   ========================================================================== */
(function (global) {
  'use strict';

  var B_REAMOSTRAS = 200;   // repetições do bootstrap
  var SEMENTE = 20260804;   // semente fixa: laudo tem que ser reprodutível

  /* ------------------------------------------------------- pseudoaleatório */
  /* LCG de 32 bits (Numerical Recipes). Determinístico de propósito. */
  function gerador(semente) {
    var s = (semente >>> 0) || 1;
    return function () {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* --------------------------------------------------------------- números */
  function n(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  /* log Γ(x) — Lanczos. Usado no Mao Tau para não estourar o fatorial. */
  var LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = 0.99999999999980993, t = x + 7.5;
    for (var i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  function lfat(k) { return lgamma(k + 1); }

  /* =========================================================================
     1. AGREGAÇÃO — dos registros para os vetores de abundância e incidência
     ====================================================================== */

  /** Soma as quantidades por táxon dentro de uma lista de registros. */
  function abundanciaPorTaxon(registros) {
    var mapa = {};
    (registros || []).forEach(function (r) {
      var q = n(r.quantidade);
      if (q === null || q <= 0) q = 1;               // registro sem quantidade = 1 indivíduo
      if (!r.taxonId) return;
      mapa[r.taxonId] = (mapa[r.taxonId] || 0) + q;
    });
    return mapa;
  }

  /** Junta vários mapas de abundância em um só. */
  function somarMapas(mapas) {
    var t = {};
    (mapas || []).forEach(function (m) {
      Object.keys(m).forEach(function (k) { t[k] = (t[k] || 0) + m[k]; });
    });
    return t;
  }

  function vetor(mapa) {
    return Object.keys(mapa).map(function (k) { return mapa[k]; })
      .filter(function (v) { return v > 0; });
  }

  /** Incidência: em quantas unidades amostrais cada táxon apareceu. */
  function incidencia(mapasPorUnidade) {
    var q = {};
    (mapasPorUnidade || []).forEach(function (m) {
      Object.keys(m).forEach(function (k) { if (m[k] > 0) q[k] = (q[k] || 0) + 1; });
    });
    return q;
  }

  /* =========================================================================
     2. ÍNDICES  (ESPECIFICACAO §2)
     ====================================================================== */
  /**
   * @param {number[]} ni  abundância de cada espécie (só valores > 0)
   * @returns {{S,N,simpsonD,simpsonDiversidade,simpsonReciproco,equitSimpson,
   *            shannon,pielou}}
   */
  function indices(ni) {
    var v = (ni || []).filter(function (x) { return x > 0; });
    var S = v.length;
    var N = v.reduce(function (a, b) { return a + b; }, 0);

    var res = {
      S: S, N: N,
      simpsonD: null, simpsonDpi2: null, simpsonDiversidade: null,
      simpsonReciproco: null, equitSimpson: null, shannon: null, pielou: null
    };
    if (!S || !N) return res;

    /* Simpson (dominância): D = Σ ni(ni−1) / N(N−1)
       Com N = 1 o denominador zera: não há dominância definível em um só
       indivíduo, e devolver 1 seria inventar um resultado. */
    if (N > 1) {
      var soma = 0;
      for (var i = 0; i < S; i++) soma += v[i] * (v[i] - 1);
      var D = soma / (N * (N - 1));
      res.simpsonD = D;
      res.simpsonDiversidade = 1 - D;
      res.simpsonReciproco = D > 0 ? 1 / D : null;

      /* A equitabilidade NÃO pode sair da forma não-viesada acima.
         E = (1/D)/S pressupõe D = Σpi², cujo 1/D tem teto em S. Com a forma
         não-viesada, 1/D passa de S em amostra pequena e a equitabilidade
         estoura 1 — o TST 01 do exemplo de avifauna dava 3,09, e equitabilidade
         é proporção, tem que ficar em [0,1]. Por isso o Dpi² separado. */
      var somaPi2 = 0;
      for (var k = 0; k < S; k++) { var pk = v[k] / N; somaPi2 += pk * pk; }
      res.simpsonDpi2 = somaPi2;
      res.equitSimpson = (somaPi2 > 0 && S > 0) ? (1 / somaPi2) / S : null;
    }

    /* Shannon: H' = − Σ pi ln pi */
    var H = 0;
    for (var j = 0; j < S; j++) {
      var p = v[j] / N;
      if (p > 0) H -= p * Math.log(p);
    }
    res.shannon = H;
    /* Math.min(1, …): com abundâncias perfeitamente iguais o ponto flutuante
       devolve 1,0000000000000002. É artefato, não resultado — e equitabilidade
       acima de 1 num laudo dá margem a questionamento do órgão. */
    res.pielou = S > 1 ? Math.min(1, H / Math.log(S)) : null;   // ln(1)=0 → indefinido

    return res;
  }

  /** Densidade = indivíduos / esforço. */
  function densidade(N, esforco) {
    var e = n(esforco);
    if (e === null || e <= 0 || N === null || N === undefined) return null;
    return N / e;
  }

  /** Abundância relativa de cada táxon (ni / N). */
  function abundanciaRelativa(mapa) {
    var N = 0, r = {};
    Object.keys(mapa).forEach(function (k) { N += mapa[k]; });
    if (!N) return r;
    Object.keys(mapa).forEach(function (k) { r[k] = mapa[k] / N; });
    return r;
  }

  /** Frequência de ocorrência = unidades onde ocorre / total de unidades. */
  function frequenciaOcorrencia(quantIncidencia, m) {
    var r = {};
    if (!m) return r;
    Object.keys(quantIncidencia).forEach(function (k) { r[k] = quantIncidencia[k] / m; });
    return r;
  }

  /* =========================================================================
     3. ESTIMADORES DE RIQUEZA  (ESPECIFICACAO §3)
     ====================================================================== */

  function contarF(ni) {
    var F1 = 0, F2 = 0;
    ni.forEach(function (x) { if (x === 1) F1++; else if (x === 2) F2++; });
    return { F1: F1, F2: F2 };
  }

  function contarQ(quantIncidencia) {
    var Q1 = 0, Q2 = 0;
    Object.keys(quantIncidencia).forEach(function (k) {
      if (quantIncidencia[k] === 1) Q1++; else if (quantIncidencia[k] === 2) Q2++;
    });
    return { Q1: Q1, Q2: Q2 };
  }

  /** Chao 1 — usa a forma corrigida quando F2 = 0 (a clássica divide por zero). */
  function chao1(S, F1, F2) {
    if (F2 > 0) return { valor: S + (F1 * F1) / (2 * F2), corrigido: false };
    return { valor: S + (F1 * (F1 - 1)) / (2 * (F2 + 1)), corrigido: true };
  }

  function chao1Corrigido(S, F1, F2) {
    return S + (F1 * (F1 - 1)) / (2 * (F2 + 1));
  }

  function chao2(S, Q1, Q2, m) {
    if (Q2 > 0) return { valor: S + (Q1 * Q1) / (2 * Q2), corrigido: false };
    return { valor: chao2Corrigido(S, Q1, Q2, m), corrigido: true };
  }

  function chao2Corrigido(S, Q1, Q2, m) {
    if (!m) return null;
    return S + ((m - 1) / m) * (Q1 * (Q1 - 1)) / (2 * (Q2 + 1));
  }

  function jackknife1(S, Q1, m) {
    if (!m) return null;
    return S + Q1 * (m - 1) / m;
  }

  function jackknife2(S, Q1, Q2, m) {
    if (!m || m < 2) return null;
    return S + Q1 * (2 * m - 3) / m - Q2 * Math.pow(m - 2, 2) / (m * (m - 1));
  }

  /** Bootstrap: S + Σ (1 − pk)^m, pk = proporção de unidades com a espécie k. */
  function bootstrapRiqueza(quantIncidencia, m) {
    if (!m) return null;
    var S = Object.keys(quantIncidencia).length, soma = 0;
    Object.keys(quantIncidencia).forEach(function (k) {
      var pk = quantIncidencia[k] / m;
      soma += Math.pow(1 - pk, m);
    });
    return S + soma;
  }

  /* =========================================================================
     3b. VARIÂNCIAS ANALÍTICAS E INTERVALO DE CONFIANÇA LOG-NORMAL

     Nada aqui é escrito de cabeça. Cada fórmula tem fonte, e o arquivo
     `testes.html` confere cada uma contra um exemplo publicado com número
     conhecido (dune e BCI do pacote R `vegan`, e o exemplo de Heltshe &
     Forrester reimpresso em Krebs).

     O intervalo é o log-normal de Chao, que é o que o EstimateS usa:

         K  = exp( 1,96 · sqrt( ln( 1 + V̂ / (Ŝ − S_obs)² ) ) )
         IC = [ S_obs + (Ŝ − S_obs)/K ,  S_obs + (Ŝ − S_obs)·K ]

     CHAO, A. 1987. Estimating the population size for capture-recapture data
     with unequal catchability. Biometrics 43:783–791, eqs. (11)–(12), p.787.
     (Chao atribui a transformação logarítmica a K. Burnham, com. pess.)

     Ele nunca exclui a estimativa pontual — que era o defeito do intervalo
     por percentil de bootstrap usado antes — e é assimétrico, como tem que
     ser: a incerteza de quantas espécies faltam é maior para cima.

     ATENÇÃO ao que NÃO tem IC: o Jackknife 2. O `vegan` diz na própria
     documentação de `specpool` que a variância de segunda ordem "is still
     missing"; o `SpadeR` calcula uma por método delta que não está publicada
     como tal. Preferimos faltar IC a inventar variância.
     ====================================================================== */

  /**
   * Var(Chao 1) clássico, quando F2 > 0.
   * CHAO, A. 1987. Biometrics 43:783–791, p.786:
   *   var = F2 [ ¼(F1/F2)⁴ + (F1/F2)³ + ½(F1/F2)² ]
   *
   * Nota: Chao (1984) NÃO traz variância analítica — usa bootstrap
   * percentílico. E a eq. (10) de Colwell & Coddington (1994) reproduz esta
   * fórmula com erro de tipografia (os coeficientes ¼ e ½ caem dentro dos
   * parênteses); o próprio Colwell registra a errata no guia do EstimateS.
   */
  function varChao1(F1, F2) {
    if (!F2) return null;
    var r = F1 / F2;
    return F2 * (0.25 * Math.pow(r, 4) + Math.pow(r, 3) + 0.5 * r * r);
  }

  /**
   * Var(Chao 1 corrigido) — a forma S + F1(F1−1)/(2(F2+1)).
   * EstimateS 9.1.0 User's Guide, Appendix B, eq. 6 (F2 > 0) e eq. 7 (F2 = 0),
   * com o fator de amostra pequena A. Mesma implementação de
   * `SpadeR::SpecAbunChao1bc`.
   *
   *   F2 > 0: A·F1(F1−1)/(2(F2+1))
   *           + A²·F1(2F1−1)²/(4(F2+1)²)
   *           + A²·F1²F2(F1−1)²/(4(F2+1)⁴)
   *
   *   F2 = 0: A·F1(F1−1)/2 + A²·F1(2F1−1)²/4 − A²·F1⁴/(4·Ŝ)
   *
   * Aqui A = 1, para casar com o estimador declarado na ESPECIFICACAO, que
   * também não traz o fator de amostra pequena.
   *
   * Divergência conhecida e declarada: o `vegan` recusa esta fórmula
   * ("the commonly used variance estimator is wrong for bias-reduced Chao
   * estimate") e usa uma derivação própria, não publicada como tal. Em
   * BCI[1,] as duas dão EP 11,5854 (EstimateS) e 11,5838 (vegan) — 0,014 %
   * de diferença. Seguimos o EstimateS, que é a referência do laudo.
   *
   * @param {number} Sest  estimativa completa (S + a correção) — só usada em F2 = 0
   */
  function varChao1Corrigido(F1, F2, Sest, A) {
    var a = (A === undefined || A === null) ? 1 : A;
    if (!F1) return 0;
    if (F2 > 0) {
      var d = F2 + 1;
      return a * (F1 * (F1 - 1)) / (2 * d) +
        a * a * (F1 * Math.pow(2 * F1 - 1, 2)) / (4 * d * d) +
        a * a * (F1 * F1 * F2 * Math.pow(F1 - 1, 2)) / (4 * Math.pow(d, 4));
    }
    if (!Sest) return null;
    return a * (F1 * (F1 - 1)) / 2 +
      a * a * (F1 * Math.pow(2 * F1 - 1, 2)) / 4 -
      a * a * Math.pow(F1, 4) / (4 * Sest);
  }

  /**
   * Var(Chao 2) — a análoga por incidência.
   * CHAO, A. & COLWELL, R. K. 2017. Thirty years of progeny from Chao's
   * inequality. SORT 41(1):3–54, eq. (3a); mesma do EstimateS Appendix B
   * eq. 9 e de `vegan::specpool`:
   *
   *   var = Q2 [ ¼A²(Q1/Q2)⁴ + A²(Q1/Q2)³ + ½A(Q1/Q2)² ],  A = (m−1)/m
   *
   * O parâmetro `A` acompanha o estimador: o Chao 2 clássico da
   * ESPECIFICACAO é S + Q1²/(2Q2), SEM o fator (m−1)/m, então a variância
   * dele também vai sem (A = 1). O Chao 2 corrigido tem o fator, e a
   * variância dele leva A = (m−1)/m. O EstimateS e o `vegan` aplicam o
   * fator também ao clássico — por isso o Chao 2 daqui fica um pouco acima
   * do deles, e a diferença é exatamente 1/m.
   */
  function varChao2(Q1, Q2, A) {
    if (!Q2) return null;
    var a = (A === undefined || A === null) ? 1 : A;
    var r = Q1 / Q2;
    return Q2 * (0.25 * a * a * Math.pow(r, 4) + a * a * Math.pow(r, 3) + 0.5 * a * r * r);
  }

  /** Var(Chao 2 corrigido) — eq. 6/7 do EstimateS por incidência, A = (m−1)/m. */
  function varChao2Corrigido(Q1, Q2, m, Sest) {
    if (!m) return null;
    return varChao1Corrigido(Q1, Q2, Sest, (m - 1) / m);
  }

  /**
   * Var(Jackknife 1) de incidência.
   * HELTSHE, J. F. & FORRESTER, N. E. 1983. Estimating species richness
   * using the jackknife procedure. Biometrics 39:1–11.
   * Reimpressa em COLWELL & CODDINGTON (1994), Phil. Trans. R. Soc. B
   * 345:101–118, eq. (12), e em KREBS, Ecological Methodology, cap. 13,
   * eq. (13.4):
   *
   *   var = ((m−1)/m) · [ Σ_j j²·f_j − Q1²/m ]
   *
   * onde f_j = número de unidades amostrais que contêm exatamente j espécies
   * únicas (espécies que só ocorrem naquela unidade), e Q1 = total de únicas.
   *
   * Divergência declarada: `vegan::specpool` subtrai Q1/m e não Q1²/m, e cita
   * Smith & van Belle (1984) em vez de Heltshe & Forrester. Não achamos a
   * variância de jackknife 1 em Smith & van Belle para decidir quem está
   * certo. Seguimos Heltshe & Forrester, que é o que fecha com o exemplo
   * numérico publicado por Krebs (Box 13.2 → 4,05).
   *
   * @param {number[]} unicasPorUnidade  quantas espécies únicas cada unidade tem
   */
  function varJackknife1(unicasPorUnidade, Q1, m) {
    if (!m || !Q1) return 0;
    var soma = 0;
    (unicasPorUnidade || []).forEach(function (r) { soma += r * r; });
    var v = ((m - 1) / m) * (soma - (Q1 * Q1) / m);
    return v > 0 ? v : 0;
  }

  /**
   * Var(Bootstrap).
   * SMITH, E. P. & VAN BELLE, G. 1984. Nonparametric estimation of species
   * richness. Biometrics 40:119–129. Implementada em `vegan::specpool` e
   * reimpressa em KREBS, cap. 13, eq. (13.12):
   *
   *   var = Σ_i q_i(1−q_i) + 2 Σ_{i<j} [ (Z_ij/m)^m − q_i·q_j ]
   *
   * q_i = (1−p_i)^m, p_i = proporção de unidades em que a espécie i ocorre;
   * Z_ij = número de unidades em que AMBAS as espécies i e j estão ausentes.
   * O termo cruzado é o que faz a variância do bootstrap não ser a soma de
   * binomiais independentes — espécies raras aparecem e somem juntas.
   */
  function varBootstrapRiqueza(mapasPorUnidade, quantIncidencia) {
    var mapas = mapasPorUnidade || [];
    var m = mapas.length;
    if (!m) return null;
    var ids = Object.keys(quantIncidencia);
    var S = ids.length;
    if (!S) return 0;

    /* matriz de ausência: ausente[i][u] = true se a espécie i não está em u */
    var ausente = ids.map(function (id) {
      return mapas.map(function (mp) { return !(mp[id] > 0); });
    });
    var q = ids.map(function (id) {
      return Math.pow(1 - quantIncidencia[id] / m, m);
    });

    var soma = 0;
    for (var i = 0; i < S; i++) soma += q[i] * (1 - q[i]);

    var cruz = 0;
    for (var a = 0; a < S; a++) {
      for (var b = a + 1; b < S; b++) {
        var z = 0;
        for (var u = 0; u < m; u++) if (ausente[a][u] && ausente[b][u]) z++;
        cruz += Math.pow(z / m, m) - q[a] * q[b];
      }
    }
    var v = soma + 2 * cruz;
    return v > 0 ? v : 0;
  }

  /**
   * IC 95 % log-normal de Chao (1987), eqs. (11)–(12).
   *   K  = exp( 1,96 · sqrt( ln( 1 + V̂ / (Ŝ − S_obs)² ) ) )
   *   IC = [ S_obs + (Ŝ − S_obs)/K , S_obs + (Ŝ − S_obs)·K ]
   *
   * Devolve null quando não há o que transformar (Ŝ = S_obs, variância nula
   * ou ausente) — nesses casos a tela mostra "—" em vez de inventar limite.
   */
  function icLogNormal(Sobs, Sest, variancia) {
    if (Sest === null || Sest === undefined || !isFinite(Sest)) return null;
    if (variancia === null || variancia === undefined || !isFinite(variancia) || variancia <= 0) return null;
    var d = Sest - Sobs;
    if (!(d > 1e-9)) return null;          // Ŝ = S_obs: eq. (12) não se aplica
    var K = Math.exp(1.96 * Math.sqrt(Math.log(1 + variancia / (d * d))));
    if (!isFinite(K) || K <= 0) return null;
    return [Sobs + d / K, Sobs + d * K];
  }

  /** Quantas espécies únicas (Q1) cada unidade amostral contém. */
  function unicasPorUnidade(mapasPorUnidade, quantIncidencia) {
    var unicas = {};
    Object.keys(quantIncidencia).forEach(function (k) { if (quantIncidencia[k] === 1) unicas[k] = 1; });
    return (mapasPorUnidade || []).map(function (mp) {
      var n = 0;
      Object.keys(mp).forEach(function (k) { if (mp[k] > 0 && unicas[k]) n++; });
      return n;
    });
  }

  /* ---------------------------------------------------------- reamostragem */

  /** Sorteia N indivíduos a partir das proporções observadas (bootstrap). */
  function reamostrarIndividuos(ni, rnd) {
    var N = ni.reduce(function (a, b) { return a + b; }, 0);
    var acum = [], s = 0, i;
    for (i = 0; i < ni.length; i++) { s += ni[i]; acum.push(s); }
    var novo = new Array(ni.length);
    for (i = 0; i < ni.length; i++) novo[i] = 0;
    for (var k = 0; k < N; k++) {
      var alvo = rnd() * N, lo = 0, hi = acum.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (acum[mid] > alvo) hi = mid; else lo = mid + 1; }
      novo[lo]++;
    }
    return novo;
  }

  function percentil(arr, p) {
    var v = arr.filter(function (x) { return x !== null && isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    var idx = (v.length - 1) * p;
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return v[lo];
    return v[lo] + (v[hi] - v[lo]) * (idx - lo);
  }

  /** Erro-padrão de um conjunto de reamostras (desvio padrão amostral). */
  function erroPadrao(arr) {
    var v = arr.filter(function (x) { return x !== null && isFinite(x); });
    if (v.length < 2) return null;
    var media = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
    var soma = 0;
    v.forEach(function (x) { soma += (x - media) * (x - media); });
    return Math.sqrt(soma / (v.length - 1));
  }

  /**
   * IC 95 % = estimativa ± 1,96 × erro-padrão bootstrap.
   *
   * Usado SÓ na curva de rarefação — os estimadores de riqueza usam o
   * intervalo log-normal de Chao com variância analítica (§3b).
   *
   * Por que ± EP e não pelos percentis da reamostragem: reamostrar indivíduos
   * com reposição perde sistematicamente as espécies raras, então a nuvem de
   * reamostras fica deslocada para baixo e o intervalo de percentis chega a
   * não conter a própria estimativa. O bootstrap entra aqui só para medir a
   * DISPERSÃO; o centro é sempre o valor observado.
   *
   * `piso` trava o limite inferior.
   */
  function icNormal(estimativa, reamostras, piso) {
    if (estimativa === null || !isFinite(estimativa)) return null;
    var ep = erroPadrao(reamostras);
    if (ep === null) return null;
    var lo = estimativa - 1.96 * ep;
    var hi = estimativa + 1.96 * ep;
    if (piso !== undefined && piso !== null) lo = Math.max(lo, piso);
    if (lo > estimativa) lo = estimativa;
    return [lo, hi];
  }

  /**
   * Estimadores de riqueza com IC 95 % por bootstrap.
   * @param {Object[]} mapasPorUnidade  um mapa {taxonId: n} por unidade amostral
   */
  function estimadores(mapasPorUnidade) {
    var mapas = (mapasPorUnidade || []).filter(function (m) { return Object.keys(m).length; });
    var m = mapas.length;
    var total = somarMapas(mapas);
    var ni = vetor(total);
    var S = ni.length;
    var N = ni.reduce(function (a, b) { return a + b; }, 0);
    var f = contarF(ni);
    var inc = incidencia(mapas);
    var q = contarQ(inc);

    var c1 = chao1(S, f.F1, f.F2);
    var c2 = chao2(S, q.Q1, q.Q2, m);
    var c1c = chao1Corrigido(S, f.F1, f.F2);
    var c2c = chao2Corrigido(S, q.Q1, q.Q2, m);

    var base = {
      S: S, N: N, m: m,
      F1: f.F1, F2: f.F2, Q1: q.Q1, Q2: q.Q2,
      chao1: c1.valor, chao1Corrigido: c1c, chao1UsouCorrecao: c1.corrigido,
      chao2: c2.valor, chao2Corrigido: c2c, chao2UsouCorrecao: c2.corrigido,
      jack1: jackknife1(S, q.Q1, m),
      jack2: jackknife2(S, q.Q1, q.Q2, m),
      bootstrap: bootstrapRiqueza(inc, m),
      variancia: {},
      ic: {},
      /* estimadores sem IC e o porquê — a tela e o laudo mostram isso */
      semIC: {}
    };

    if (!S) return base;

    /* ---- variâncias analíticas (ver §3b: cada uma com a fonte) ---- */
    var v = base.variancia;
    v.chao1 = c1.corrigido
      ? varChao1Corrigido(f.F1, f.F2, c1.valor)     // F2 = 0 → forma corrigida
      : varChao1(f.F1, f.F2);
    v.chao1Corrigido = varChao1Corrigido(f.F1, f.F2, c1c);
    if (m >= 2) {
      v.chao2 = c2.corrigido
        ? varChao2Corrigido(q.Q1, q.Q2, m, c2.valor)
        : varChao2(q.Q1, q.Q2);
      v.chao2Corrigido = varChao2Corrigido(q.Q1, q.Q2, m, c2c);
      v.jack1 = varJackknife1(unicasPorUnidade(mapas, inc), q.Q1, m);
      v.bootstrap = varBootstrapRiqueza(mapas, inc);
    }

    /* ---- IC 95 % log-normal de Chao (1987) ---- */
    base.ic.chao1 = icLogNormal(S, base.chao1, v.chao1);
    base.ic.chao1Corrigido = icLogNormal(S, base.chao1Corrigido, v.chao1Corrigido);
    base.ic.chao2 = icLogNormal(S, base.chao2, v.chao2);
    base.ic.chao2Corrigido = icLogNormal(S, base.chao2Corrigido, v.chao2Corrigido);
    base.ic.jack1 = icLogNormal(S, base.jack1, v.jack1);
    base.ic.bootstrap = icLogNormal(S, base.bootstrap, v.bootstrap);

    /* O Jackknife 2 fica SEM intervalo, de propósito. A documentação do
       `vegan::specpool` diz textualmente que a variância de segunda ordem
       "is still missing"; o `SpadeR` calcula uma por método delta que não
       está publicada como tal. Melhor faltar IC que inventar variância. */
    base.semIC.jack2 = 'não há variância analítica publicada para o jackknife de 2ª ordem ' +
      '(o pacote vegan declara a lacuna na própria documentação de specpool)';
    base.semIC.S = 'riqueza observada é contagem, não estimativa — não tem erro de amostragem a estimar';

    /* Estimativa igual à riqueza observada (Q1 = 0, por exemplo): a
       transformação logarítmica divide por zero e o intervalo não existe. */
    ['chao1', 'chao2', 'jack1', 'bootstrap'].forEach(function (k) {
      if (!base.ic[k] && base[k] !== null && !base.semIC[k]) {
        base.semIC[k] = (base[k] - S < 1e-9)
          ? 'a estimativa coincide com a riqueza observada — não há extrapolação para cercar'
          : 'variância não estimável com estes dados';
      }
    });

    return base;
  }

  /* =========================================================================
     4. RAREFAÇÃO — Mao Tau, por indivíduos (a curva do coletor)
        E[Sn] = Σ_i [ 1 − C(N−ni, n) / C(N, n) ]
        Calculada em logaritmo de fatorial para não estourar em N grande.
     ====================================================================== */
  function esperadoSn(ni, N, nn) {
    var soma = 0;
    for (var i = 0; i < ni.length; i++) {
      var resto = N - ni[i];
      if (resto < nn) { soma += 1; continue; }   // C(N−ni, n) = 0
      var logRaz = (lfat(resto) - lfat(resto - nn)) - (lfat(N) - lfat(N - nn));
      soma += 1 - Math.exp(logRaz);
    }
    return soma;
  }

  /**
   * Curva de rarefação por indivíduos, com IC 95 % por bootstrap.
   * @param {number[]} ni      abundâncias observadas
   * @param {number}   passos  nº máximo de pontos da curva (padrão 60)
   */
  function rarefacao(ni, passos) {
    var v = (ni || []).filter(function (x) { return x > 0; });
    var N = v.reduce(function (a, b) { return a + b; }, 0);
    if (!N) return [];
    var max = passos || 60;
    var salto = Math.max(1, Math.ceil(N / max));

    var ns = [];
    for (var x = 1; x <= N; x += salto) ns.push(x);
    if (ns[ns.length - 1] !== N) ns.push(N);

    /* bootstrap: reamostra os N indivíduos e recalcula a curva inteira */
    var rnd = gerador(SEMENTE + 2);
    var reps = [];
    for (var b = 0; b < B_REAMOSTRAS; b++) {
      var novo = reamostrarIndividuos(v, rnd).filter(function (z) { return z > 0; });
      reps.push(novo);
    }

    return ns.map(function (nn) {
      var esp = esperadoSn(v, N, nn);
      var amostras = reps.map(function (r) {
        var Nb = r.reduce(function (a, c) { return a + c; }, 0);
        return esperadoSn(r, Nb, Math.min(nn, Nb));
      });
      var ic = icNormal(esp, amostras, 0);
      return {
        n: nn,
        esperado: esp,
        inferior: ic ? Math.max(0, ic[0]) : null,
        superior: ic ? ic[1] : null
      };
    });
  }

  /**
   * Curva de Coleman — a aproximação da curva de rarefação.
   * GOTELLI, N. J. & COLWELL, R. K. 2011. Estimating species richness.
   * In: Biological Diversity: Frontiers in Measurement and Assessment,
   * cap. 4, eq. (4.1):
   *
   *   E(s*) = Σ_i [ 1 − (1 − n* ÷ N)^{n_i} ]
   *
   * É mais barata que o Mao Tau e sempre fica um pouco abaixo dele; serve
   * de conferência visual da curva exata, não de substituta.
   */
  function colemanSn(ni, N, nn) {
    if (!N) return 0;
    var f = 1 - nn / N, soma = 0;
    for (var i = 0; i < ni.length; i++) soma += 1 - Math.pow(f, ni[i]);
    return soma;
  }

  function curvaColeman(ni, pontos) {
    var v = (ni || []).filter(function (x) { return x > 0; });
    var N = v.reduce(function (a, b) { return a + b; }, 0);
    if (!N) return [];
    return (pontos || []).map(function (nn) {
      return { n: nn, esperado: colemanSn(v, N, nn) };
    });
  }

  /**
   * Curva de acumulação observada: riqueza acumulada na ordem em que as
   * unidades foram amostradas. Não é estimativa — é o que aconteceu.
   */
  function acumulacao(mapasPorUnidade, rotulos) {
    var vistas = {}, saida = [], indAcum = 0;
    (mapasPorUnidade || []).forEach(function (mapa, i) {
      Object.keys(mapa).forEach(function (k) {
        if (mapa[k] > 0) { vistas[k] = 1; indAcum += mapa[k]; }
      });
      saida.push({
        unidade: i + 1,
        rotulo: (rotulos && rotulos[i]) || ('UA ' + (i + 1)),
        riqueza: Object.keys(vistas).length,
        individuos: indAcum
      });
    });
    return saida;
  }

  /* =========================================================================
     5. COMPOSIÇÃO — por ordem, família, guilda, o que for
     ====================================================================== */
  /**
   * @param {Object}   mapaAbund  {taxonId: n}
   * @param {Object}   taxonsPorId
   * @param {Function} chave      taxon → string (ou null para ignorar)
   */
  function composicao(mapaAbund, taxonsPorId, chave) {
    var grupos = {};
    Object.keys(mapaAbund).forEach(function (id) {
      var t = taxonsPorId[id];
      if (!t) return;
      var g = chave(t);
      if (g === null || g === undefined || g === '') g = '—';
      if (!grupos[g]) grupos[g] = { rotulo: g, especies: 0, individuos: 0 };
      grupos[g].especies += 1;
      grupos[g].individuos += mapaAbund[id];
    });
    var lista = Object.keys(grupos).map(function (k) { return grupos[k]; });
    var totalE = lista.reduce(function (a, b) { return a + b.especies; }, 0);
    var totalI = lista.reduce(function (a, b) { return a + b.individuos; }, 0);
    lista.forEach(function (g) {
      g.percEspecies = totalE ? g.especies / totalE : 0;
      g.percIndividuos = totalI ? g.individuos / totalI : 0;
    });
    lista.sort(function (a, b) {
      return b.individuos - a.individuos || b.especies - a.especies ||
        String(a.rotulo).localeCompare(String(b.rotulo), 'pt-BR');
    });
    return { itens: lista, totalEspecies: totalE, totalIndividuos: totalI };
  }

  /* =========================================================================
     6. ESPÉCIES DE INTERESSE
     ====================================================================== */
  /* RE (regionalmente extinta), EW (extinta na natureza) e EX (extinta)
     entram porque a Lista Nacional as usa: uma espécie extinta na área é
     achado de laudo, não ausência de achado. Ver DADOS.AMEACA. */
  var AMEACA = ['VU', 'EN', 'CR', 'RE', 'EW', 'EX'];

  /* A caixa das letras NÃO carrega significado nestas siglas de domínio
     fechado — a planilha do João traz 'vu' e 'VU', 'b' e 'B', na mesma
     coluna. Normalizar aqui é o que impede uma espécie ameaçada de sumir do
     laudo por causa da digitação. Nome científico é o oposto: lá a caixa é
     nomenclatura e nunca se toca. */
  function cod(v) { return String(v === undefined || v === null ? '' : v).trim().toLowerCase(); }

  function ehAmeaca(v) { return AMEACA.indexOf(cod(v).toUpperCase()) >= 0; }

  function ameacada(t) {
    var a = t.atributos || {};
    return ehAmeaca(a.listaNacional) || ehAmeaca(a.listaEstadual) || ehAmeaca(a.iucn);
  }

  function especiesDeInteresse(taxons) {
    var r = {
      ameacadas: [], endemicas: [], migratorias: [], cinegeticas: [], exoticas: [],
      ameacadasNacional: [], ameacadasEstadual: [], ameacadasIucn: []
    };
    (taxons || []).forEach(function (t) {
      var a = t.atributos || {};
      if (ehAmeaca(a.listaNacional)) r.ameacadasNacional.push(t);
      if (ehAmeaca(a.listaEstadual)) r.ameacadasEstadual.push(t);
      if (ehAmeaca(a.iucn)) r.ameacadasIucn.push(t);
      if (ameacada(t)) r.ameacadas.push(t);
      if (a.endemismo) r.endemicas.push(t);
      if (cod(a.migratoria) === 'sim' || cod(a.migratoria) === 'parcial') r.migratorias.push(t);
      if (cod(a.cinegetica) === 'sim') r.cinegeticas.push(t);
      if (cod(a.exotica) === 'sim') r.exoticas.push(t);
    });
    return r;
  }

  /* =========================================================================
     7. COMPARAÇÕES — entre campanhas, primários × secundários
     ====================================================================== */
  function comparar(listaA, listaB) {
    var a = {}, b = {};
    (listaA || []).forEach(function (x) { a[normalizar(x)] = x; });
    (listaB || []).forEach(function (x) { b[normalizar(x)] = x; });
    var soA = [], soB = [], comum = [];
    Object.keys(a).forEach(function (k) { (b[k] ? comum : soA).push(a[k]); });
    Object.keys(b).forEach(function (k) { if (!a[k]) soB.push(b[k]); });
    var total = soA.length + soB.length + comum.length;
    return {
      exclusivasA: soA.sort(cmp), exclusivasB: soB.sort(cmp), comuns: comum.sort(cmp),
      total: total,
      similaridadeJaccard: total ? comum.length / total : null
    };
  }

  /**
   * Comparação de N listas de espécies — N campanhas, N áreas, o que for.
   * `comparar` acima só sabe comparar duas, e era o que limitava a tela de
   * resultados às duas primeiras campanhas.
   *
   * @param {{rotulo:string, nomes:string[]}[]} listas
   * @returns {{
   *   rotulos: string[],
   *   porLista: {rotulo, riqueza, exclusivas:string[], compartilhadas:number}[],
   *   comunsTodas: string[],   espécies presentes em TODAS as listas
   *   uniao: string[],         todas as espécies, sem repetir
   *   matriz: {nome:string, presenca:boolean[], quantas:number}[],
   *   jaccard: number[][]      similaridade par a par (null na diagonal)
   * }}
   */
  function compararN(listas) {
    var ls = (listas || []).map(function (l) {
      var conj = {};
      (l.nomes || []).forEach(function (x) {
        var k = normalizar(x);
        if (k) conj[k] = String(x).trim();
      });
      return { rotulo: l.rotulo, conj: conj, chaves: Object.keys(conj) };
    });

    var uniao = {};
    ls.forEach(function (l) { l.chaves.forEach(function (k) { uniao[k] = l.conj[k]; }); });
    var chavesUniao = Object.keys(uniao).sort(function (a, b) { return cmp(uniao[a], uniao[b]); });

    var matriz = chavesUniao.map(function (k) {
      var pres = ls.map(function (l) { return !!l.conj[k]; });
      return {
        nome: uniao[k],
        presenca: pres,
        quantas: pres.filter(Boolean).length
      };
    });

    var porLista = ls.map(function (l, i) {
      var excl = matriz.filter(function (m) { return m.quantas === 1 && m.presenca[i]; })
        .map(function (m) { return m.nome; });
      return {
        rotulo: l.rotulo,
        riqueza: l.chaves.length,
        exclusivas: excl,
        compartilhadas: l.chaves.length - excl.length
      };
    });

    var comunsTodas = ls.length
      ? matriz.filter(function (m) { return m.quantas === ls.length; }).map(function (m) { return m.nome; })
      : [];

    /* Jaccard par a par: |A∩B| / |A∪B| */
    var jaccard = ls.map(function (a, i) {
      return ls.map(function (b, j) {
        if (i === j) return null;
        var inter = 0;
        a.chaves.forEach(function (k) { if (b.conj[k]) inter++; });
        var uni = a.chaves.length + b.chaves.length - inter;
        return uni ? inter / uni : null;
      });
    });

    return {
      rotulos: ls.map(function (l) { return l.rotulo; }),
      porLista: porLista,
      comunsTodas: comunsTodas,
      uniao: chavesUniao.map(function (k) { return uniao[k]; }),
      matriz: matriz,
      jaccard: jaccard
    };
  }

  function cmp(x, y) { return String(x).localeCompare(String(y), 'pt-BR'); }

  function normalizar(s) {
    return String(s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  /* =========================================================================
     8. NOME CIENTÍFICO
        A caixa das letras carrega significado: gênero maiúsculo, epíteto
        minúsculo. Nunca aplicar uppercase nem lowercase no conjunto.
     ====================================================================== */
  function nomeCientifico(t) {
    if (!t) return '';
    var g = (t.genero || '').trim(), e = (t.epiteto || '').trim();
    if (g && e) return g + ' ' + e;
    return (g || e || t.nomeCientifico || '').trim();
  }

  /** Quebra "Tyrannus melancholicus" em gênero + epíteto, sem mexer na caixa. */
  function partirNome(nome) {
    var p = String(nome || '').trim().replace(/\s+/g, ' ').split(' ');
    return { genero: p[0] || '', epiteto: p.slice(1).join(' ') || '' };
  }

  /* =========================================================================
     9. RESUMOS DE ALTO NÍVEL
     ====================================================================== */

  /** Métricas de uma unidade amostral isolada. */
  function resumoUnidade(unidade, metodoDef) {
    var mapa = abundanciaPorTaxon(unidade.registros);
    var ni = vetor(mapa);
    var ind = indices(ni);
    var esf = metodoDef && metodoDef.esforco ? metodoDef.esforco(unidade.esforco || {}) : null;
    var area = metodoDef && metodoDef.area ? metodoDef.area(unidade.esforco || {}) : null;
    return {
      mapa: mapa,
      indices: ind,
      esforco: esf,
      unidadeEsforco: metodoDef ? metodoDef.unidade : '',
      areaHa: area,
      densidade: densidade(ind.N, esf),
      densidadeHa: area ? densidade(ind.N, area) : null
    };
  }

  global.MOTOR = {
    /* agregação */
    abundanciaPorTaxon: abundanciaPorTaxon, somarMapas: somarMapas, vetor: vetor,
    incidencia: incidencia,
    /* índices */
    indices: indices, densidade: densidade,
    abundanciaRelativa: abundanciaRelativa, frequenciaOcorrencia: frequenciaOcorrencia,
    /* estimadores */
    estimadores: estimadores,
    chao1: chao1, chao1Corrigido: chao1Corrigido,
    chao2: chao2, chao2Corrigido: chao2Corrigido,
    jackknife1: jackknife1, jackknife2: jackknife2, bootstrapRiqueza: bootstrapRiqueza,
    contarF: contarF, contarQ: contarQ,
    /* variâncias analíticas e IC log-normal — cada uma com a fonte em §3b */
    varChao1: varChao1, varChao1Corrigido: varChao1Corrigido,
    varChao2: varChao2, varChao2Corrigido: varChao2Corrigido,
    varJackknife1: varJackknife1, varBootstrapRiqueza: varBootstrapRiqueza,
    icLogNormal: icLogNormal, unicasPorUnidade: unicasPorUnidade,
    /* curvas */
    rarefacao: rarefacao, acumulacao: acumulacao, esperadoSn: esperadoSn,
    colemanSn: colemanSn, curvaColeman: curvaColeman,
    /* composição e interesse */
    composicao: composicao, especiesDeInteresse: especiesDeInteresse,
    ameacada: ameacada, ehAmeaca: ehAmeaca,
    /* comparações */
    comparar: comparar, compararN: compararN, normalizar: normalizar,
    /* nomes */
    nomeCientifico: nomeCientifico, partirNome: partirNome,
    /* resumos */
    resumoUnidade: resumoUnidade,
    /* utilidades expostas para teste */
    lgamma: lgamma, percentil: percentil, erroPadrao: erroPadrao,
    icNormal: icNormal, B_REAMOSTRAS: B_REAMOSTRAS
  };
})(typeof window !== 'undefined' ? window : globalThis);
