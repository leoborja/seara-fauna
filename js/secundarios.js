/* ============================================================================
   Seara Biologia — Fauna — secundarios.js

   O que este arquivo resolve: na planilha, a aba `Outros` trazia UMA
   referência bibliográfica digitada à mão, e a comparação entre o que foi
   levantado em campo e o que a literatura já registrou era feita no olho.

   Aqui a lista secundária vem da GBIF: todas as ocorrências publicadas num
   raio em volta da área, do grupo do projeto. Para Mariana/MG, 20 km, Aves,
   são mais de doze mil ocorrências e quase quatrocentas espécies — número
   que ninguém digita à mão.

   O QUE SAI DISSO, E POR QUE IMPORTA NO LAUDO
   ─────────────────────────────────────────────────────────────────────────
   · exclusivas do primário   o que SÓ o levantamento dele achou — é o valor
                              do trabalho de campo, e costuma ser o que o
                              órgão pergunta.
   · em comum                 corrobora o levantamento.
   · esperadas não detectadas o que a região tem e o campo não pegou. ESTA é
                              a que dá argumento: ou o esforço foi curto, ou
                              a espécie sumiu da área — e as duas conclusões
                              vão para o laudo.

   O filtro usado e a data da consulta ficam gravados, porque o laudo precisa
   citar a fonte. Sem isso o número não vale nada.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.MOTOR;
  var D = global.DADOS;
  var F = global.FONTES;

  /* ========================================================================
     1. A CHAVE DO GRUPO — descoberta na GBIF, nunca cravada
     ===================================================================== */
  /**
   * Classes GBIF de cada grupo faunístico. São NOMES, não números: o número
   * (`taxonKey`) é perguntado à própria GBIF. Cravar 212 aqui seria apostar
   * que a espinha dorsal da GBIF nunca muda.
   */
  function classesDoGrupo(grupo) {
    var g = D.grupo(grupo);
    if (g && g.classesGbif && g.classesGbif.length) return g.classesGbif.slice();
    if (g && g.classe) return [g.classe];
    return [];
  }

  /** Resolve os nomes de classe em chaves numéricas da GBIF. */
  function chavesDoGrupo(grupo) {
    var nomes = classesDoGrupo(grupo);
    if (!nomes.length) {
      return Promise.resolve({
        ok: true, chaves: [], nomes: [], semClasse: true,
        aviso: 'Este grupo não declara uma classe do GBIF. A busca sai sem filtro de grupo — ' +
          'vai trazer tudo o que houver na área.'
      });
    }
    return Promise.all(nomes.map(function (n) { return F.gbifChaveDeClasse(n); }))
      .then(function (rs) {
        var chaves = [], resolvidos = [], erro = null, offline = false;
        rs.forEach(function (r, i) {
          if (r.ok && r.dados && r.dados.chave) {
            chaves.push(r.dados.chave);
            resolvidos.push({ nome: r.dados.nome, chave: r.dados.chave, consultadoEm: r.consultadoEm });
          } else {
            erro = (r && r.erro) || ('Não consegui resolver a classe ' + nomes[i] + '.');
            if (r && r.offline) offline = true;
          }
        });
        return {
          ok: chaves.length > 0, chaves: chaves, nomes: resolvidos,
          erro: chaves.length ? null : erro, offline: offline
        };
      });
  }

  /* ========================================================================
     2. O LEVANTAMENTO SECUNDÁRIO
     ===================================================================== */
  /**
   * @param {Object}   op  { lat, lon, raioKm, grupo, semCache }
   * @param {Function} aoProgresso (etapa, feitas, total) => void
   * @param {Function} devoParar   () => bool
   */
  function levantar(op, aoProgresso, devoParar) {
    op = op || {};
    var passo = function (etapa, a, b) { if (aoProgresso) aoProgresso(etapa, a, b); };

    passo('classe', 0, 1);
    return chavesDoGrupo(op.grupo).then(function (cls) {
      if (!cls.ok && !cls.semClasse) {
        return { ok: false, erro: cls.erro, offline: cls.offline };
      }
      passo('ocorrencias', 0, 1);
      return F.gbifOcorrencias({
        lat: op.lat, lon: op.lon, raioKm: op.raioKm,
        taxonKey: cls.chaves.length ? cls.chaves.join('&taxonKey=') : null,
        classe: cls.nomes.map(function (n) { return n.nome; }).join(' + '),
        limiteEspecies: op.limiteEspecies || 400,
        semCache: op.semCache
      }).then(function (oc) {
        if (!oc.ok) return { ok: false, erro: oc.erro, offline: oc.offline };

        var chaves = oc.dados.especies.map(function (e) { return e.chave; });
        var porChave = {};
        oc.dados.especies.forEach(function (e) { porChave[e.chave] = e.ocorrencias; });

        passo('especies', 0, chaves.length);
        return F.resolverEspecies(chaves, function (f, t) { passo('especies', f, t); }, devoParar)
          .then(function (res) {
            var especies = res.especies.map(function (x) {
              return {
                chave: x.chave,
                nome: x.dados.nome,
                nomeCompleto: x.dados.nomeCompleto,
                autor: x.dados.autor,
                rank: x.dados.rank,
                classe: x.dados.classe, ordem: x.dados.ordem, familia: x.dados.familia,
                ocorrencias: porChave[x.chave] || 0
              };
            }).filter(function (e) { return e.nome; })
              .sort(function (a, b) { return b.ocorrencias - a.ocorrencias; });

            return {
              ok: true,
              offline: res.offline,
              parcial: res.falhas > 0 || (devoParar && devoParar()),
              naoResolvidas: chaves.length - especies.length,
              ocorrencias: oc.dados.ocorrencias,
              chavesEncontradas: chaves.length,
              especies: especies,
              filtro: {
                lat: Number(op.lat), lon: Number(op.lon), raioKm: Number(op.raioKm) || 20,
                grupo: op.grupo,
                classes: cls.nomes.map(function (n) { return n.nome; }),
                taxonKeys: cls.chaves,
                hasCoordinate: true,
                limiteEspecies: op.limiteEspecies || 400
              },
              consultadoEm: oc.consultadoEm,
              doCache: oc.doCache,
              fonte: 'GBIF · occurrence/search (geoDistance + facet speciesKey)'
            };
          });
      });
    });
  }

  /* ========================================================================
     3. O CRUZAMENTO — as três listas
     ===================================================================== */
  /**
   * @param {string[]} primarias    nomes científicos do levantamento de campo
   * @param {Array}    secundarias  [{nome, ocorrencias, familia, ordem}]
   */
  function cruzar(primarias, secundarias) {
    var p = {}, s = {};
    (primarias || []).forEach(function (n) {
      var k = M.normalizar(n);
      if (k) p[k] = String(n).trim();
    });
    (secundarias || []).forEach(function (e) {
      var k = M.normalizar(e.nome);
      if (k) s[k] = e;
    });

    var soPrimario = [], comuns = [], esperadas = [];
    Object.keys(p).forEach(function (k) {
      if (s[k]) comuns.push({ nome: p[k], ocorrencias: s[k].ocorrencias, familia: s[k].familia, ordem: s[k].ordem });
      else soPrimario.push({ nome: p[k], ocorrencias: null, familia: '', ordem: '' });
    });
    Object.keys(s).forEach(function (k) {
      if (!p[k]) esperadas.push(s[k]);
    });

    function porNome(a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); }
    function porOcor(a, b) { return (b.ocorrencias || 0) - (a.ocorrencias || 0) || porNome(a, b); }

    var uniao = soPrimario.length + comuns.length + esperadas.length;
    return {
      soPrimario: soPrimario.sort(porNome),
      comuns: comuns.sort(porOcor),
      /* as mais registradas na região primeiro: é a ordem em que a ausência
         pesa mais no laudo */
      esperadas: esperadas.sort(porOcor),
      riquezaPrimaria: Object.keys(p).length,
      riquezaSecundaria: Object.keys(s).length,
      uniao: uniao,
      jaccard: uniao ? comuns.length / uniao : null,
      /* que fração do que a região tem o levantamento pegou */
      cobertura: Object.keys(s).length ? comuns.length / Object.keys(s).length : null
    };
  }

  /* ========================================================================
     4. COORDENADA DA ÁREA
     ===================================================================== */
  /** Média das coordenadas das unidades amostrais, quando existirem. */
  function centroDoProjeto(projeto) {
    var lats = [], lons = [];
    ((projeto && projeto.campanhas) || []).forEach(function (c) {
      (c.unidades || []).forEach(function (u) {
        var la = parseFloat(String(u.latitude || '').replace(',', '.'));
        var lo = parseFloat(String(u.longitude || '').replace(',', '.'));
        if (isFinite(la) && isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180) {
          lats.push(la); lons.push(lo);
        }
      });
    });
    if (!lats.length) return null;
    var soma = function (v) { return v.reduce(function (a, b) { return a + b; }, 0); };
    return {
      lat: soma(lats) / lats.length,
      lon: soma(lons) / lons.length,
      unidades: lats.length
    };
  }

  /* ========================================================================
     5. OBSERVAÇÕES EXTERNAS → tabela para o importador
     ===================================================================== */
  /**
   * Converte o que o iNaturalist e o eBird devolveram numa tabela Darwin Core.
   *
   * POR QUE PASSAR PELO CSV: a tela de pré-visualização e mapeamento do
   * importador já existe, já mostra o que vai entrar, já rejeita linha ruim
   * com motivo e já reaproveita táxon existente pelo nome normalizado. Criar
   * um segundo caminho de importação seria criar um segundo lugar para dar
   * errado. Os cabeçalhos são os termos do Darwin Core, que o importador
   * reconhece sozinho.
   */
  function paraDarwinCore(observacoes, opcoes) {
    opcoes = opcoes || {};
    var cab = ['scientificName', 'vernacularName', 'individualCount', 'eventDate', 'eventTime',
      'decimalLatitude', 'decimalLongitude', 'locality', 'recordedBy', 'basisOfRecord',
      'samplingProtocol', 'occurrenceRemarks'];

    function campo(v) {
      var s = String(v === undefined || v === null ? '' : v);
      return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    var linhas = [cab.join(';')];
    (observacoes || []).forEach(function (o) {
      linhas.push([
        o.nome, o.nomeComum, o.quantidade, o.data, o.hora,
        o.lat, o.lon, o.local || opcoes.local || '',
        o.observador || opcoes.observador || '',
        'HumanObservation',
        opcoes.metodo || 'busca ativa',
        o.url || opcoes.observacao || ''
      ].map(campo).join(';'));
    });
    return '﻿' + linhas.join('\r\n');
  }

  /**
   * Só o que é espécie serve para riqueza. Observação identificada em
   * gênero ou família entra na conta como se fosse espécie e infla o S —
   * por isso sai daqui, contada e avisada, não jogada fora em silêncio.
   */
  function filtrarEspecies(observacoes) {
    var especies = [], acima = [];
    (observacoes || []).forEach(function (o) {
      var partes = String(o.nome || '').trim().split(/\s+/);
      var ehEspecie = partes.length >= 2 && (!o.rank || o.rank === 'species' ||
        o.rank === 'subspecies' || o.rank === 'variety' || o.rank === 'hybrid');
      if (ehEspecie) especies.push(o);
      else acima.push(o);
    });
    return { especies: especies, acimaDeEspecie: acima };
  }

  global.SECUNDARIOS = {
    classesDoGrupo: classesDoGrupo,
    chavesDoGrupo: chavesDoGrupo,
    levantar: levantar,
    cruzar: cruzar,
    centroDoProjeto: centroDoProjeto,
    paraDarwinCore: paraDarwinCore,
    filtrarEspecies: filtrarEspecies
  };
})(typeof window !== 'undefined' ? window : globalThis);
