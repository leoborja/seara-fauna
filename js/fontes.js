/* ============================================================================
   Seara Biologia — Fauna — fontes.js
   Camada de rede: GBIF, iNaturalist e eBird. Mais o cache.

   TRÊS REGRAS QUE VALEM PARA TUDO AQUI:

   1. Nada nesta camada escreve no dado do João. Ela só devolve o que a fonte
      respondeu, com a data da consulta grudada. Quem decide o que vira dado é
      a tela de revisão, e quem decide de verdade é ele.

   2. Toda resposta é cacheada no localStorage COM A DATA. Consulta repetida
      não sai de novo para a rede — e é o que permite abrir o laudo no
      escritório, sem internet, e ainda ver de onde cada dado veio.

   3. Rede que cai não trava tela. Toda função devolve `{ok:false, offline}`
      em vez de estourar; a tela mostra o aviso e o resto do app continua
      inteiro.

   CHAVES DE API: só o eBird pede uma. Ela fica no localStorage do aparelho
   dele, NUNCA no código. Sem chave, o eBird simplesmente não aparece — o
   resto funciona igual.

   O QUE NÃO ESTÁ AQUI, DE PROPÓSITO: a API da IUCN. O termo de uso dela
   proíbe uso comercial, e consultoria ambiental remunerada é uso comercial.
   A categoria da Lista Vermelha entra pelo iNaturalist, que republica o dado
   sob termo próprio, sempre com a autoridade declarada na tela.
   ========================================================================== */
(function (global) {
  'use strict';

  var TEMPO_LIMITE = 15000;
  var PAUSA_MS = 120;

  var CHAVE_CACHE = 'searaFauna.cache.v1';
  var CHAVE_EBIRD = 'searaFauna.chaveEbird';
  var TETO_CACHE = 4000;             // entradas; acima disso, poda as mais velhas
  var VALIDADE_PADRAO = 180;         // dias

  /* ========================================================================
     CACHE
     ===================================================================== */
  var cache = null;

  function carregarCache() {
    if (cache) return cache;
    try {
      cache = JSON.parse(localStorage.getItem(CHAVE_CACHE) || '{}') || {};
    } catch (e) {
      cache = {};
    }
    return cache;
  }

  var gravarPendente = null;
  function gravarCache() {
    /* agrupa as gravações: 383 espécies resolvidas em sequência não podem
       virar 383 serializações do cache inteiro */
    if (gravarPendente) return;
    gravarPendente = setTimeout(function () {
      gravarPendente = null;
      try {
        podar();
        localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache));
      } catch (e) {
        /* cheio: joga metade fora e tenta de novo, uma vez */
        try {
          var ks = Object.keys(cache);
          ks.slice(0, Math.floor(ks.length / 2)).forEach(function (k) { delete cache[k]; });
          localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache));
        } catch (e2) {
          console.warn('Cache de consultas cheio — seguindo sem cache.');
        }
      }
    }, 400);
  }

  function podar() {
    var ks = Object.keys(cache);
    if (ks.length <= TETO_CACHE) return;
    ks.sort(function (a, b) {
      return String(cache[a] && cache[a].em).localeCompare(String(cache[b] && cache[b].em));
    });
    ks.slice(0, ks.length - TETO_CACHE).forEach(function (k) { delete cache[k]; });
  }

  function diasDesde(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return Infinity;
    return (Date.now() - t) / 86400000;
  }

  function lerCache(chave, validadeDias) {
    var c = carregarCache()[chave];
    if (!c) return null;
    if (diasDesde(c.em) > (validadeDias === undefined ? VALIDADE_PADRAO : validadeDias)) return null;
    return c;
  }

  function gravarNoCache(chave, dados) {
    carregarCache()[chave] = { em: new Date().toISOString(), dados: dados };
    gravarCache();
    return cache[chave];
  }

  function estatisticasCache() {
    var c = carregarCache();
    var ks = Object.keys(c);
    var maisVelha = null, maisNova = null;
    ks.forEach(function (k) {
      var e = c[k].em;
      if (!maisVelha || e < maisVelha) maisVelha = e;
      if (!maisNova || e > maisNova) maisNova = e;
    });
    var bytes = 0;
    try { bytes = (localStorage.getItem(CHAVE_CACHE) || '').length; } catch (e) { bytes = 0; }
    return { entradas: ks.length, bytes: bytes, maisVelha: maisVelha, maisNova: maisNova };
  }

  function limparCache() {
    cache = {};
    try { localStorage.removeItem(CHAVE_CACHE); } catch (e) { /* nada a fazer */ }
  }

  /* ========================================================================
     REDE
     ===================================================================== */
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function pegar(url, cabecalhos) {
    var opc = cabecalhos ? { headers: cabecalhos } : {};
    if (typeof AbortController !== 'undefined') {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, TEMPO_LIMITE);
      opc.signal = ctrl.signal;
      return fetch(url, opc).then(function (r) { clearTimeout(t); return r; },
        function (e) { clearTimeout(t); throw e; });
    }
    return fetch(url, opc);
  }

  function ehOffline(e) {
    return (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      e.name === 'AbortError' || e.name === 'TypeError';
  }

  function falha(e, fonte) {
    var off = ehOffline(e);
    return {
      ok: false, offline: off, fonte: fonte,
      erro: off ? 'Sem conexão com ' + fonte + '.' : (fonte + ': ' + e.message),
      consultadoEm: new Date().toISOString()
    };
  }

  /**
   * Consulta com cache. Se já tem resposta guardada e dentro da validade,
   * nem sai para a rede — devolve o que está guardado, com a data original.
   */
  function consultar(chaveCache, url, opcoes) {
    opcoes = opcoes || {};
    var guardado = opcoes.semCache ? null : lerCache(chaveCache, opcoes.validade);
    if (guardado) {
      return Promise.resolve({
        ok: true, offline: false, doCache: true,
        fonte: opcoes.fonte || 'GBIF',
        consultadoEm: guardado.em, dados: guardado.dados
      });
    }
    return pegar(url, opcoes.cabecalhos).then(function (r) {
      if (!r.ok) {
        var e = new Error('respondeu ' + r.status);
        e.status = r.status;
        throw e;
      }
      return r.json();
    }).then(function (d) {
      var reduzido = opcoes.reduzir ? opcoes.reduzir(d) : d;
      var c = gravarNoCache(chaveCache, reduzido);
      return {
        ok: true, offline: false, doCache: false,
        fonte: opcoes.fonte || 'GBIF',
        consultadoEm: c.em, dados: reduzido
      };
    }, function (e) {
      /* Sem rede, resposta velha é melhor do que resposta nenhuma — desde
         que a tela diga que é velha, e ela diz (`consultadoEm`). */
      var velho = lerCache(chaveCache, Infinity);
      if (velho) {
        return {
          ok: true, offline: true, doCache: true, vencido: true,
          fonte: opcoes.fonte || 'GBIF',
          consultadoEm: velho.em, dados: velho.dados
        };
      }
      return falha(e, opcoes.fonte || 'GBIF');
    });
  }

  /* ========================================================================
     GBIF — nomes comuns em português
     ===================================================================== */
  /**
   * `GET species/{key}/vernacularNames` e fica só com `language: "por"`.
   * A GBIF devolve o mesmo nome repetido por várias fontes; conta as
   * repetições e devolve o mais confirmado primeiro.
   */
  function gbifNomeComum(usageKey) {
    if (!usageKey) return Promise.resolve({ ok: false, erro: 'Sem chave GBIF.', fonte: 'GBIF' });
    return consultar('gbif:vern:' + usageKey,
      'https://api.gbif.org/v1/species/' + encodeURIComponent(usageKey) + '/vernacularNames?limit=200',
      {
        fonte: 'GBIF',
        reduzir: function (d) {
          var contagem = {}, ordem = [];
          (d.results || []).forEach(function (x) {
            if (String(x.language || '').toLowerCase() !== 'por') return;
            var nome = String(x.vernacularName || '').trim();
            if (!nome) return;
            var k = nome.toLowerCase();
            if (!contagem[k]) { contagem[k] = { nome: nome, vezes: 0, fontes: [] }; ordem.push(k); }
            contagem[k].vezes++;
            if (x.source && contagem[k].fontes.indexOf(x.source) < 0) contagem[k].fontes.push(x.source);
          });
          return ordem.map(function (k) { return contagem[k]; })
            .sort(function (a, b) { return b.vezes - a.vezes; })
            .slice(0, 8);
        }
      });
  }

  /* ========================================================================
     GBIF — registro completo de uma espécie pela chave
     ===================================================================== */
  function gbifEspecie(key) {
    return consultar('gbif:sp:' + key,
      'https://api.gbif.org/v1/species/' + encodeURIComponent(key),
      {
        fonte: 'GBIF',
        reduzir: function (d) {
          return {
            key: d.key, nubKey: d.nubKey,
            nome: d.canonicalName || d.scientificName || '',
            nomeCompleto: d.scientificName || '',
            autor: d.authorship || '',
            rank: d.rank || '', status: d.taxonomicStatus || '',
            reino: d.kingdom || '', filo: d.phylum || '', classe: d['class'] || '',
            ordem: d.order || '', familia: d.family || '', genero: d.genus || ''
          };
        }
      });
  }

  /** Chave GBIF de uma classe (Aves, Mammalia…) — descoberta, não cravada. */
  function gbifChaveDeClasse(nomeClasse) {
    if (!nomeClasse) return Promise.resolve({ ok: false, erro: 'Sem nome de classe.', fonte: 'GBIF' });
    return consultar('gbif:classe:' + nomeClasse,
      'https://api.gbif.org/v1/species/match?name=' + encodeURIComponent(nomeClasse) +
      '&rank=CLASS&kingdom=Animalia',
      {
        fonte: 'GBIF',
        validade: 3650,
        reduzir: function (d) {
          return {
            chave: d.usageKey || d.classKey || null,
            nome: d.canonicalName || d.scientificName || nomeClasse,
            rank: d.rank || '', casamento: d.matchType || ''
          };
        }
      });
  }

  /* ========================================================================
     GBIF — ocorrências numa área (os DADOS SECUNDÁRIOS)
     ===================================================================== */
  /**
   * Quantas ocorrências e quais espécies a GBIF tem num raio em volta de um
   * ponto. É isto que substitui a garimpagem bibliográfica: em vez de UMA
   * referência digitada à mão, a lista inteira do que já foi registrado ali,
   * com o filtro e a data guardados para o laudo poder citar a fonte.
   *
   * `facet=speciesKey` devolve só as chaves; resolver cada uma em nome é o
   * passo seguinte (`resolverEspecies`), com cache — são muitas chamadas.
   */
  function gbifOcorrencias(op) {
    var lat = Number(op.lat), lon = Number(op.lon), raio = Number(op.raioKm);
    if (!isFinite(lat) || !isFinite(lon)) {
      return Promise.resolve({ ok: false, erro: 'Coordenada inválida.', fonte: 'GBIF' });
    }
    if (!isFinite(raio) || raio <= 0) raio = 20;

    var url = 'https://api.gbif.org/v1/occurrence/search' +
      '?geoDistance=' + lat + ',' + lon + ',' + raio + 'km' +
      (op.taxonKey ? '&taxonKey=' + encodeURIComponent(op.taxonKey) : '') +
      '&limit=0&facet=speciesKey&facetLimit=' + (op.limiteEspecies || 400) +
      '&hasCoordinate=true';

    return consultar('gbif:oco:' + lat + ',' + lon + ',' + raio + ',' + (op.taxonKey || 'todos'), url, {
      fonte: 'GBIF',
      validade: op.validade === undefined ? 30 : op.validade,
      semCache: !!op.semCache,
      reduzir: function (d) {
        var f = (d.facets || [])[0] || {};
        return {
          ocorrencias: d.count || 0,
          filtro: {
            lat: lat, lon: lon, raioKm: raio,
            taxonKey: op.taxonKey || null, classe: op.classe || '',
            hasCoordinate: true
          },
          especies: (f.counts || []).map(function (x) {
            return { chave: x.name, ocorrencias: x.count };
          })
        };
      }
    });
  }

  /**
   * Resolve N chaves de espécie em nome científico, em lotes pequenos e com
   * respiro entre eles. O cache faz a segunda rodada ser instantânea.
   *
   * @param {Function} aoProgresso (feitas, total) => void
   * @param {Function} devoParar   () => bool
   */
  function resolverEspecies(chaves, aoProgresso, devoParar) {
    var lista = (chaves || []).slice();
    var saida = [], i = 0, houveFalha = 0, offline = false;
    var POR_LOTE = 5;

    function lote() {
      if (i >= lista.length || (devoParar && devoParar()) || offline) {
        return Promise.resolve({ especies: saida, falhas: houveFalha, offline: offline });
      }
      var pedaco = lista.slice(i, i + POR_LOTE);
      return Promise.all(pedaco.map(function (k) { return gbifEspecie(k); }))
        .then(function (rs) {
          rs.forEach(function (r, j) {
            if (r.ok) saida.push({ chave: pedaco[j], dados: r.dados, consultadoEm: r.consultadoEm });
            else { houveFalha++; if (r.offline) offline = true; }
          });
          i += POR_LOTE;
          if (aoProgresso) aoProgresso(Math.min(i, lista.length), lista.length);
          if (i >= lista.length) return { especies: saida, falhas: houveFalha, offline: offline };
          return esperar(PAUSA_MS).then(lote);
        });
    }
    return lote();
  }

  /* ========================================================================
     iNaturalist — nome comum em pt-BR e categoria de conservação
     ===================================================================== */
  var IUCN_SIGLA = {
    'least concern': 'LC', 'near threatened': 'NT', 'vulnerable': 'VU',
    'endangered': 'EN', 'critically endangered': 'CR',
    'extinct in the wild': 'EW', 'extinct': 'EX',
    'data deficient': 'DD', 'not evaluated': ''
  };

  function siglaConservacao(status, statusName) {
    var s = String(status || '').trim().toLowerCase();
    var direto = { lc: 'LC', nt: 'NT', vu: 'VU', en: 'EN', cr: 'CR', ew: 'EW', ex: 'EX', dd: 'DD' }[s];
    if (direto) return direto;
    return IUCN_SIGLA[String(statusName || '').trim().toLowerCase()] || '';
  }

  /** A autoridade é IUCN mesmo, ou é uma lista regional republicada? */
  function ehIucn(autoridade) {
    return /iucn/i.test(String(autoridade || ''));
  }

  function inatTaxon(nome) {
    if (!nome) return Promise.resolve({ ok: false, erro: 'Sem nome.', fonte: 'iNaturalist' });
    return consultar('inat:taxa:' + nome,
      'https://api.inaturalist.org/v1/taxa?q=' + encodeURIComponent(nome) +
      '&locale=pt-BR&per_page=5',
      {
        fonte: 'iNaturalist',
        reduzir: function (d) {
          var alvo = null;
          var k = String(nome).trim().toLowerCase();
          (d.results || []).forEach(function (r) {
            if (alvo) return;
            if (String(r.name || '').trim().toLowerCase() === k) alvo = r;
          });
          if (!alvo) return null;
          var cs = alvo.conservation_status || null;
          return {
            id: alvo.id,
            nome: alvo.name,
            rank: alvo.rank,
            nomeComum: alvo.preferred_common_name || '',
            conservacao: cs ? {
              sigla: siglaConservacao(cs.status, cs.status_name),
              statusName: cs.status_name || cs.status || '',
              autoridade: cs.authority || '',
              lugar: (cs.place && cs.place.display_name) || '',
              ehIucn: ehIucn(cs.authority)
            } : null
          };
        }
      });
  }

  /* ========================================================================
     iNaturalist — observações (importação de dado primário)
     ===================================================================== */
  /**
   * Sem chave. `user_login` é obrigatório: é o caderno de campo DELE que
   * entra, não uma varredura do banco inteiro.
   */
  function inatObservacoes(op) {
    var login = String(op.login || '').trim();
    if (!login) return Promise.resolve({ ok: false, erro: 'Informe o usuário do iNaturalist.', fonte: 'iNaturalist' });

    var base = 'https://api.inaturalist.org/v1/observations?user_login=' + encodeURIComponent(login) +
      '&per_page=200&order_by=observed_on&order=asc' +
      (op.taxonId ? '&taxon_id=' + encodeURIComponent(op.taxonId) : '') +
      (op.de ? '&d1=' + encodeURIComponent(op.de) : '') +
      (op.ate ? '&d2=' + encodeURIComponent(op.ate) : '');

    var todas = [], pagina = 1, total = null;
    var MAX_PAGINAS = 10;   // 2.000 observações; acima disso é caso de exportar CSV

    function passo() {
      return consultar('inat:obs:' + login + ':' + (op.taxonId || '') + ':' + (op.de || '') + ':' +
        (op.ate || '') + ':p' + pagina, base + '&page=' + pagina, {
          fonte: 'iNaturalist',
          validade: op.validade === undefined ? 1 : op.validade,
          semCache: !!op.semCache,
          reduzir: function (d) {
            return {
              total: d.total_results || 0,
              resultados: (d.results || []).map(function (r) {
                var t = r.taxon || {};
                var loc = String(r.location || '').split(',');
                return {
                  nome: t.name || '',
                  rank: t.rank || '',
                  nomeComum: t.preferred_common_name || '',
                  data: r.observed_on || (r.time_observed_at || '').slice(0, 10) || '',
                  hora: (r.time_observed_at || '').slice(11, 16),
                  lat: loc[0] || '', lon: loc[1] || '',
                  local: r.place_guess || '',
                  quantidade: r.species_guess && r.species_guess.match(/^\d+$/) ? r.species_guess : '',
                  observador: (r.user && (r.user.login || r.user.name)) || login,
                  url: r.uri || ''
                };
              })
            };
          }
        }).then(function (res) {
          if (!res.ok) return res;
          total = res.dados.total;
          todas = todas.concat(res.dados.resultados);
          if (res.dados.resultados.length === 200 && pagina < MAX_PAGINAS && todas.length < total) {
            pagina++;
            return esperar(PAUSA_MS).then(passo);
          }
          return {
            ok: true, offline: res.offline, doCache: res.doCache, fonte: 'iNaturalist',
            consultadoEm: res.consultadoEm,
            dados: { total: total, truncado: todas.length < total, resultados: todas }
          };
        });
    }
    return passo();
  }

  /* ========================================================================
     eBird — precisa de chave, e é gratuita
     ===================================================================== */
  function chaveEbird() {
    try { return localStorage.getItem(CHAVE_EBIRD) || ''; } catch (e) { return ''; }
  }

  function definirChaveEbird(v) {
    try {
      if (v) localStorage.setItem(CHAVE_EBIRD, String(v).trim());
      else localStorage.removeItem(CHAVE_EBIRD);
    } catch (e) { /* modo privado: fica só nesta sessão */ }
  }

  function temEbird() { return !!chaveEbird(); }

  /**
   * Observações recentes num raio. A eBird não publica endpoint de "minhas
   * observações" — o que existe é por área. Por isso o eBird entra como
   * levantamento da região, não como caderno pessoal.
   *
   * A chave vai no cabeçalho `X-eBirdApiToken` e mora no localStorage deste
   * aparelho. Nunca no código, nunca no JSON exportado.
   */
  function ebirdProximas(op) {
    var chave = op.chave || chaveEbird();
    if (!chave) {
      return Promise.resolve({
        ok: false, semChave: true, fonte: 'eBird',
        erro: 'O eBird exige uma chave de API. Ela é gratuita e sai em minutos em ebird.org/api/keygen. ' +
          'Sem ela, o resto do app funciona igual — só o eBird fica de fora.'
      });
    }
    var lat = Number(op.lat), lon = Number(op.lon);
    if (!isFinite(lat) || !isFinite(lon)) {
      return Promise.resolve({ ok: false, erro: 'Coordenada inválida.', fonte: 'eBird' });
    }
    var dist = Math.min(Math.max(Number(op.raioKm) || 25, 1), 50);   // a API aceita até 50 km
    var dias = Math.min(Math.max(Number(op.dias) || 30, 1), 30);     // e até 30 dias

    var url = 'https://api.ebird.org/v2/data/obs/geo/recent?lat=' + lat.toFixed(4) +
      '&lng=' + lon.toFixed(4) + '&dist=' + dist + '&back=' + dias + '&includeProvisional=true';

    return consultar('ebird:geo:' + lat.toFixed(3) + ',' + lon.toFixed(3) + ',' + dist + ',' + dias, url, {
      fonte: 'eBird',
      validade: op.validade === undefined ? 1 : op.validade,
      semCache: !!op.semCache,
      cabecalhos: { 'X-eBirdApiToken': chave },
      reduzir: function (d) {
        return (d || []).map(function (o) {
          return {
            nome: o.sciName || '',
            nomeComum: o.comName || '',
            quantidade: (o.howMany === undefined || o.howMany === null) ? '' : o.howMany,
            data: String(o.obsDt || '').slice(0, 10),
            hora: String(o.obsDt || '').slice(11, 16),
            lat: o.lat === undefined ? '' : o.lat,
            lon: o.lng === undefined ? '' : o.lng,
            local: o.locName || ''
          };
        });
      }
    }).then(function (r) {
      /* 403 quase sempre é chave errada — dizer isso poupa meia hora dele */
      if (!r.ok && /403|401/.test(String(r.erro))) {
        r.erro = 'O eBird recusou a chave (403). Confira em ebird.org/api/keygen.';
        r.chaveInvalida = true;
      }
      return r;
    });
  }

  global.FONTES = {
    /* GBIF */
    gbifNomeComum: gbifNomeComum,
    gbifEspecie: gbifEspecie,
    gbifChaveDeClasse: gbifChaveDeClasse,
    gbifOcorrencias: gbifOcorrencias,
    resolverEspecies: resolverEspecies,
    /* iNaturalist */
    inatTaxon: inatTaxon,
    inatObservacoes: inatObservacoes,
    siglaConservacao: siglaConservacao,
    /* eBird */
    ebirdProximas: ebirdProximas,
    chaveEbird: chaveEbird, definirChaveEbird: definirChaveEbird, temEbird: temEbird,
    /* cache */
    lerCache: lerCache, gravarNoCache: gravarNoCache,
    limparCache: limparCache, estatisticasCache: estatisticasCache,
    /* utilidades */
    consultar: consultar, esperar: esperar, PAUSA_MS: PAUSA_MS
  };
})(typeof window !== 'undefined' ? window : globalThis);
