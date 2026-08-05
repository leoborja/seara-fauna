/* ============================================================================
   Seara Biologia — Fauna — gbif.js
   Conferência taxonômica contra a GBIF. Sem chave, sem autenticação.

   REGRA DE OURO: a API sugere, nunca sobrescreve. Toda divergência vira um
   card que o responsável técnico aceita ou recusa. A assinatura do laudo é
   dele, não da API.

   Se a rede falhar, o app continua inteiro — só a verificação fica
   indisponível, com aviso claro. O último resultado de cada táxon fica
   guardado no localStorage e continua sendo exibido offline.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.MOTOR;

  var BASE_MATCH = 'https://api.gbif.org/v1/species/match';
  var BASE_BUSCA = 'https://api.gbif.org/v1/species/search';
  var PAUSA_MS = 120;          // respiro entre chamadas: não irritar o servidor
  var TEMPO_LIMITE = 12000;

  /* ------------------------------------------------------------ utilidades */

  function esperar(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function buscarComPrazo(url) {
    if (typeof AbortController === 'undefined') return fetch(url);
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TEMPO_LIMITE);
    return fetch(url, { signal: ctrl.signal }).then(function (r) {
      clearTimeout(t);
      return r;
    }, function (e) {
      clearTimeout(t);
      throw e;
    });
  }

  /** Distância de edição — usada para separar erro de digitação de divergência real. */
  function levenshtein(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var linha = [], i, j;
    for (j = 0; j <= b.length; j++) linha[j] = j;
    for (i = 1; i <= a.length; i++) {
      var ant = linha[0];
      linha[0] = i;
      for (j = 1; j <= b.length; j++) {
        var tmp = linha[j];
        linha[j] = Math.min(
          linha[j] + 1,
          linha[j - 1] + 1,
          ant + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
        ant = tmp;
      }
    }
    return linha[b.length];
  }

  /** Tira o autor de "Furnarius rufus (Gmelin, 1788)" → "Furnarius rufus". */
  function canonico(nomeCientifico) {
    var s = String(nomeCientifico || '').trim();
    var p = s.split(/\s+/);
    var out = [];
    for (var i = 0; i < p.length && out.length < 3; i++) {
      /* para no primeiro pedaço que parece autor: começa com maiúscula depois
         do epíteto, ou tem parêntese/vírgula/dígito */
      if (i >= 2 || /[(),0-9]/.test(p[i])) break;
      if (i === 1 && /^[A-ZÀ-Ý]/.test(p[i])) break;
      out.push(p[i]);
    }
    return out.join(' ');
  }

  /**
   * Autor: o que sobra do scientificName depois do nome canônico.
   *
   * A ESPINHA DORSAL DA GBIF ÀS VEZES DEVOLVE A AUTORIA TRUNCADA. Medido em
   * 05/08/2026 nas 23 espécies do exemplo de mastofauna:
   *
   *   Procyon cancrivorus  → scientificName "Procyon cancrivorus G"
   *   Mazama gouazoubira   → scientificName "Mazama gouazoubira G.Fischer"
   *
   * O certo é "(G. Cuvier, 1798)" e "(G. Fischer, 1814)". Devolver "G" faria
   * o app PROPOR a troca de uma autoria correta por um fragmento — e o
   * "aceitar todos" gravaria isso sem ninguém ver.
   *
   * Por isso só volta autoria que parece completa: com o ANO de quatro
   * dígitos, que a nomenclatura zoológica exige citar. Sem ano, devolve vazio
   * e o campo simplesmente não é proposto. Melhor faltar a sugestão do que
   * estragar o que já estava certo.
   */
  function autorDe(scientificName, canonicalName) {
    var s = String(scientificName || '').trim();
    var c = String(canonicalName || '').trim();
    if (!c || s.indexOf(c) !== 0) return '';
    var a = s.slice(c.length).trim();
    return /\b\d{4}\b/.test(a) ? a : '';
  }

  /* ============================================================ consulta */

  /**
   * Consulta uma espécie na GBIF.
   * @returns {Promise<{ok, offline, erro, dados, alternativas}>}
   */
  function consultar(nome) {
    var url = BASE_MATCH + '?name=' + encodeURIComponent(nome) +
      '&kingdom=Animalia&verbose=true';

    return buscarComPrazo(url).then(function (r) {
      if (!r.ok) throw new Error('GBIF respondeu ' + r.status);
      return r.json();
    }).then(function (d) {
      var resultado = {
        ok: true, offline: false, erro: null,
        consultadoEm: new Date().toISOString(),
        nomeConsultado: nome,
        dados: d,
        alternativas: []
      };
      /* Quando a GBIF só reconhece o gênero (HIGHERRANK) ou não reconhece nada
         (NONE), o nome pode existir como sinônimo em outra lista taxonômica.
         É assim que `Hydropsalis parvula` aparece como `Setopagis parvula`. */
      if (d.matchType === 'HIGHERRANK' || d.matchType === 'NONE' || d.rank !== 'SPECIES') {
        return esperar(PAUSA_MS).then(function () {
          return buscarSinonimo(nome);
        }).then(function (alts) {
          resultado.alternativas = alts;
          return resultado;
        }, function () { return resultado; });
      }
      return resultado;
    }, function (e) {
      var offline = (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        e.name === 'AbortError' || e.name === 'TypeError';
      return {
        ok: false, offline: offline,
        erro: offline ? 'Sem conexão com a GBIF.' : ('Falha na consulta: ' + e.message),
        consultadoEm: new Date().toISOString(),
        nomeConsultado: nome, dados: null, alternativas: []
      };
    });
  }

  /** Procura o nome em todas as listas taxonômicas da GBIF, não só na espinha dorsal. */
  function buscarSinonimo(nome) {
    var url = BASE_BUSCA + '?q=' + encodeURIComponent(nome) + '&limit=12';
    return buscarComPrazo(url).then(function (r) {
      if (!r.ok) throw new Error('GBIF respondeu ' + r.status);
      return r.json();
    }).then(function (d) {
      var alvo = M.normalizar(nome);
      var vistos = {}, saida = [];
      (d.results || []).forEach(function (x) {
        if (!x.accepted) return;
        if (M.normalizar(canonico(x.scientificName)) !== alvo) return;
        var aceito = canonico(x.accepted);
        if (!aceito || M.normalizar(aceito) === alvo) return;
        var chave = M.normalizar(aceito);
        if (vistos[chave]) { vistos[chave].vezes++; return; }
        vistos[chave] = {
          nomeAceito: aceito,
          nomeAceitoCompleto: x.accepted,
          familia: x.family || '',
          rank: x.rank || '',
          vezes: 1
        };
        saida.push(vistos[chave]);
      });
      /* espécie primeiro, depois o que mais listas confirmam */
      saida.sort(function (a, b) {
        var ra = a.rank === 'SPECIES' ? 0 : 1, rb = b.rank === 'SPECIES' ? 0 : 1;
        return ra - rb || b.vezes - a.vezes;
      });
      return saida;
    });
  }

  /* ============================================================ comparação */

  /**
   * Compara o táxon do João com o que a GBIF devolveu. Função pura.
   * @returns {{estado, divergencias:[], resumo}}
   *   estado: 'confere' | 'divergente' | 'naoEncontrado' | 'erro'
   */
  function comparar(taxon, resposta) {
    if (!resposta || !resposta.ok || !resposta.dados) {
      return { estado: 'erro', divergencias: [], resumo: (resposta && resposta.erro) || 'Sem resposta.' };
    }

    var d = resposta.dados;
    var nome = M.nomeCientifico(taxon);
    var divs = [];

    if (d.matchType === 'NONE') {
      (resposta.alternativas || []).forEach(function (a) {
        divs.push(diverg('nome', 'Nome científico', nome, a.nomeAceito,
          'A GBIF não reconhece este nome, mas outra lista taxonômica o traz como sinônimo de ' +
          a.nomeAceito + '.', 'sinonimo'));
      });
      return {
        estado: 'naoEncontrado', divergencias: divs,
        resumo: 'A GBIF não encontrou este nome (matchType NONE).'
      };
    }

    if (d.matchType === 'HIGHERRANK' || d.rank !== 'SPECIES') {
      divs.push(diverg('rank', 'Nível taxonômico', nome, d.canonicalName || '',
        'A GBIF só reconheceu até ' + (d.rank === 'GENUS' ? 'o gênero' : 'o nível ' + d.rank) +
        ' — a combinação de gênero e epíteto não consta da espinha dorsal.', 'rank'));
      (resposta.alternativas || []).forEach(function (a) {
        divs.push(diverg('nome', 'Nome científico', nome, a.nomeAceito,
          'Outra lista taxonômica da GBIF traz este nome como sinônimo de ' +
          a.nomeAceito + (a.nomeAceitoCompleto !== a.nomeAceito ? ' (' + a.nomeAceitoCompleto + ')' : '') + '.',
          'sinonimo'));
      });
    }

    /* grafia — FUZZY significa que a GBIF corrigiu o que foi digitado */
    if (d.matchType === 'FUZZY' && d.canonicalName && M.normalizar(d.canonicalName) !== M.normalizar(nome)) {
      divs.push(diverg('nome', 'Nome científico', nome, d.canonicalName,
        'Casamento aproximado (FUZZY): provável erro de digitação.', 'grafia'));
    }

    /* sinônimo — a GBIF aceita outro nome para este táxon */
    if (d.status === 'SYNONYM' && d.species && M.normalizar(d.species) !== M.normalizar(nome)) {
      divs.push(diverg('nome', 'Nome científico', nome, d.species,
        'A GBIF trata este nome como sinônimo. O nome aceito é ' + d.species + '.', 'sinonimo'));
    }

    /* hierarquia */
    [['familia', 'Família', d.family], ['ordem', 'Ordem', d.order], ['classe', 'Classe', d['class']]]
      .forEach(function (par) {
        var atual = (taxon[par[0]] || '').trim();
        var sug = (par[2] || '').trim();
        if (!sug || !atual) {
          if (sug && !atual) {
            divs.push(diverg(par[0], par[1], '', sug, 'Campo em branco — a GBIF traz ' + sug + '.', 'faltando'));
          }
          return;
        }
        if (M.normalizar(atual) === M.normalizar(sug)) return;
        var dist = levenshtein(atual.toLowerCase(), sug.toLowerCase());
        var tipo = dist <= 2 ? 'digitacao' : 'divergencia';
        var texto = dist <= 2
          ? 'Difere de ' + sug + ' por ' + dist + (dist === 1 ? ' letra' : ' letras') +
            ' — provável erro de digitação.'
          : 'A GBIF classifica em ' + sug + '. Pode ser divergência real entre autores; ' +
            'quem decide o que vai no laudo é você.';
        divs.push(diverg(par[0], par[1], atual, sug, texto, tipo));
      });

    /* autor e chave — sugestões de preenchimento, nunca correção */
    var autor = autorDe(d.scientificName, d.canonicalName);
    if (autor && !(taxon.autor || '').trim()) {
      divs.push(diverg('autor', 'Autor', '', autor, 'Autoria segundo a GBIF.', 'faltando'));
    }
    if (d.usageKey && String(taxon.chaveGbif || '') !== String(d.usageKey)) {
      divs.push(diverg('chaveGbif', 'Chave GBIF', taxon.chaveGbif || '', String(d.usageKey),
        'Identificador da espécie na GBIF (usageKey).', 'faltando'));
    }

    var graves = divs.filter(function (x) { return x.tipo !== 'faltando'; });
    return {
      estado: graves.length ? 'divergente' : 'confere',
      divergencias: divs,
      resumo: descreverCasamento(d)
    };
  }

  function diverg(chave, rotulo, atual, sugerido, texto, tipo) {
    return { chave: chave, rotulo: rotulo, atual: atual, sugerido: sugerido, texto: texto, tipo: tipo };
  }

  function descreverCasamento(d) {
    var m = {
      EXACT: 'casamento exato', FUZZY: 'casamento aproximado',
      HIGHERRANK: 'casou só em nível superior', NONE: 'sem casamento'
    }[d.matchType] || d.matchType;
    var st = d.status === 'ACCEPTED' ? 'nome aceito' : (d.status === 'SYNONYM' ? 'sinônimo' : (d.status || '').toLowerCase());
    return m + ' · ' + st + ' · confiança ' + (d.confidence === undefined ? '—' : d.confidence + ' %');
  }

  /* =============================================================== lote */

  /**
   * Verifica uma lista de táxons, um a um, com pausa entre as chamadas.
   * @param {Array}    taxons
   * @param {Function} aoProgresso  (feito, total, taxon, resultado) => void
   * @param {Function} devoParar    () => bool  — permite cancelar
   */
  function verificarLote(taxons, aoProgresso, devoParar) {
    var lista = taxons.slice();
    var saida = [];
    var i = 0;

    function passo() {
      if (i >= lista.length || (devoParar && devoParar())) return Promise.resolve(saida);
      var t = lista[i];
      return consultar(M.nomeCientifico(t)).then(function (res) {
        var cmp = comparar(t, res);
        saida.push({ taxon: t, resposta: res, comparacao: cmp });
        i++;
        if (aoProgresso) aoProgresso(i, lista.length, t, res, cmp);
        /* Se caiu a rede, não adianta insistir 58 vezes. */
        if (!res.ok && res.offline) return saida;
        return esperar(PAUSA_MS).then(passo);
      });
    }
    return passo();
  }

  global.GBIF = {
    consultar: consultar,
    buscarSinonimo: buscarSinonimo,
    comparar: comparar,
    verificarLote: verificarLote,
    levenshtein: levenshtein,
    canonico: canonico,
    autorDe: autorDe,
    PAUSA_MS: PAUSA_MS
  };
})(typeof window !== 'undefined' ? window : globalThis);
