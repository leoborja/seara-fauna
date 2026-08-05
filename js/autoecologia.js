/* ============================================================================
   Seara Biologia — Fauna — autoecologia.js

   O que este arquivo resolve: até aqui, a integração com a GBIF só conferia o
   NOME. Toda a autoecologia — hierarquia, nome comum, categoria de ameaça,
   autoria — continuava sendo digitada espécie por espécie. Era a maior perda
   de tempo do trabalho, e é o que acaba aqui.

   A REGRA QUE ATRAVESSA TUDO: a máquina PROPÕE, o responsável técnico DECIDE.
   Nada é gravado sem ele aceitar. Campo que ele já preencheu nunca é
   sobrescrito sem ele mandar — vira uma divergência, que é coisa diferente de
   um campo em branco.

   E toda proposta carrega DE ONDE VEIO e QUANDO: fonte e data de consulta
   ficam gravadas no táxon (`procedencia`) e saem no laudo. A assinatura é
   dele; ele tem que poder responder de onde saiu cada número.

   AS QUATRO FONTES
   ─────────────────────────────────────────────────────────────────────────
   1. GBIF `species/match`      hierarquia completa (reino → gênero), autoria,
                                ano e a chave da espécie. A GBIF já devolvia
                                tudo isso e o app jogava fora.
   2. GBIF `vernacularNames`    nome comum, filtrando `language: "por"`.
   3. iNaturalist `taxa`        categoria de conservação e nome comum pt-BR.
   4. Lista Nacional (embutida) categoria da Portaria — OFFLINE, é a de maior
                                valor legal e não depende de rede nenhuma.

   POR QUE NÃO A API DA IUCN: o termo de uso dela proíbe uso comercial, e
   consultoria ambiental remunerada é uso comercial (a alternativa deles, o
   IBAT, é paga). A categoria da Lista Vermelha entra pelo iNaturalist, que
   republica o dado sob termo próprio — e sempre com a autoridade declarada
   na tela, porque nem todo `conservation_status` do iNaturalist é da IUCN:
   muitos são listas regionais. Quando não é IUCN, o app diz de quem é e não
   propõe preencher o campo IUCN.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.MOTOR;
  var D = global.DADOS;
  var F = global.FONTES;
  var B = global.GBIF;
  var LO = global.LISTAS_OFICIAIS;

  /* ========================================================================
     1. LISTA OFICIAL — cruzamento OFFLINE, roda sozinho
     ===================================================================== */
  /**
   * Confere um táxon contra a Lista Nacional embutida. Função pura, sem rede:
   * é consulta a um arquivo que já está aqui. Roda sozinha assim que o táxon
   * entra no catálogo.
   *
   * @returns {{
   *   situacao: 'ausente'|'confere'|'faltando'|'diferente'|'subespecie'|'naoConsta',
   *   oficial: Object|null,       registro da lista
   *   atual: string,              o que o João preencheu
   *   sugerido: string,           o que a lista diz
   *   grave: boolean,             merece destaque na tela e no laudo
   *   texto: string
   * }}
   */
  function conferirListaOficial(taxon) {
    var nome = M.nomeCientifico(taxon);
    var atual = D.siglaAmeaca((taxon.atributos || {}).listaNacional || '');
    var achado = LO ? LO.buscar(nome) : null;

    if (!achado) {
      /* Não está na lista. Só é problema se o catálogo AFIRMA que está. */
      if (atual) {
        return {
          situacao: 'naoConsta', casamento: null, oficial: null, atual: atual, sugerido: '', grave: true,
          texto: 'O catálogo traz ' + atual + ' na Portaria do MMA, mas esta espécie não aparece na ' +
            'lista oficial embutida. Confira: pode ser categoria de outra lista, ou nome desatualizado.'
        };
      }
      return { situacao: 'ausente', casamento: null, oficial: null, atual: '', sugerido: '', grave: false, texto: '' };
    }

    var reg = achado.registro;
    var cat = reg.categoria;

    if (achado.tipo === 'subespecie') {
      /* A lista protege SUBESPÉCIES, não a espécie inteira. A diferença é
         jurídica, não é detalhe: preencher a espécie com a categoria da
         subespécie põe no laudo uma afirmação que a portaria não faz. */
      var quais = achado.subespecies.map(function (s) { return s.nome + ' (' + s.categoria + ')'; }).join(', ');
      return {
        situacao: 'subespecie', casamento: 'subespecie', oficial: reg, atual: atual, sugerido: '', grave: !!atual,
        subespecies: achado.subespecies,
        texto: 'A lista oficial não traz a espécie, e sim ' +
          (achado.subespecies.length === 1 ? 'a subespécie ' : 'as subespécies ') + quais +
          '. Só vale se a população levantada for dessa subespécie — quem decide é você.'
      };
    }

    if (!atual) {
      return {
        situacao: 'faltando', casamento: achado.tipo, oficial: reg, atual: '', sugerido: cat, grave: true,
        texto: 'Consta da lista oficial como ' + cat + ' (' + reg.ano + ')' +
          (reg.provavelmenteExtinta ? ', com marca de provavelmente extinta' : '') +
          ', e o campo está em branco no catálogo.'
      };
    }

    if (D.mesmoCodigo(atual, cat)) {
      return {
        situacao: 'confere', casamento: achado.tipo, oficial: reg, atual: atual, sugerido: cat, grave: false,
        texto: 'Confere com a lista oficial: ' + cat + ' (' + reg.ano + ').'
      };
    }

    return {
      situacao: 'diferente', casamento: achado.tipo, oficial: reg, atual: atual, sugerido: cat, grave: true,
      texto: 'O catálogo traz ' + atual + ' e a lista oficial traz ' + cat + ' (' + reg.ano + ').' +
        (reg.categoria2014 && reg.categoria2014 !== reg.categoria2021
          ? ' A categoria mudou de ' + reg.categoria2014 + ' (2014) para ' + reg.categoria2021 + ' (2021).'
          : '')
    };
  }

  /** O cruzamento de um catálogo inteiro, com o resumo que vai para a tela. */
  function cruzarListaOficial(taxons) {
    var itens = (taxons || []).map(function (t) {
      var c = conferirListaOficial(t);
      c.taxon = t;
      return c;
    });
    var por = function (s) { return itens.filter(function (x) { return x.situacao === s; }); };
    var naLista = itens.filter(function (x) {
      return x.situacao !== 'ausente' && x.situacao !== 'naoConsta';
    });
    return {
      itens: itens,
      naLista: naLista,
      faltando: por('faltando'),
      diferentes: por('diferente'),
      subespecies: por('subespecie'),
      naoConsta: por('naoConsta'),
      confere: por('confere'),
      divergencias: por('faltando').concat(por('diferente'), por('naoConsta'), por('subespecie').filter(function (x) { return x.grave; })),
      /* Quantas espécies do levantamento estão ameaçadas segundo a lista
         oficial — VU, EN, CR, e também RE/EX/EW, que continuam na lista.
         CASAMENTO POR SUBESPÉCIE FICA DE FORA: a lista protege a subespécie,
         não a espécie. Contar aqui seria afirmar no laudo uma proteção que a
         portaria não dá, e o número de espécies ameaçadas é justamente o que
         não pode sair errado. Elas aparecem em `subespecies`, para decisão. */
      ameacadasOficial: naLista.filter(function (x) {
        return x.oficial && x.casamento !== 'subespecie' && D.ehAmeaca(x.oficial.categoria);
      })
    };
  }

  /* ========================================================================
     2. PROPOSTAS — o que cada fonte tem a dizer sobre um táxon
     ===================================================================== */

  var CAMPOS_TAXON = [
    { chave: 'reino', rotulo: 'Reino' },
    { chave: 'filo', rotulo: 'Filo' },
    { chave: 'classe', rotulo: 'Classe' },
    { chave: 'ordem', rotulo: 'Ordem' },
    { chave: 'familia', rotulo: 'Família' },
    { chave: 'genero', rotulo: 'Gênero' }
  ];

  function limpo(v) { return String(v === undefined || v === null ? '' : v).trim(); }

  function proposta(o) {
    return {
      chave: o.chave,
      alvo: o.alvo || 'taxon',            // 'taxon' | 'atributo'
      rotulo: o.rotulo,
      atual: limpo(o.atual),
      sugerido: limpo(o.sugerido),
      fonte: o.fonte,
      consultadoEm: o.consultadoEm || null,
      tipo: o.tipo,                        // 'preenche' | 'diverge' | 'confirma' | 'atencao'
      nota: o.nota || '',
      decidido: null
    };
  }

  /**
   * "Papagaio de peito roxo" e "papagaio-de-peito-roxo" são O MESMO NOME em
   * duas grafias — a segunda é a do CBRO, que a GBIF republica. Tratar isso
   * como divergência encheria a tela de 45 decisões sobre hífen, que é
   * exatamente o tipo de trabalho manual que esta rodada existe para acabar.
   */
  function mesmoNomeComum(a, b) {
    function chave(s) {
      return M.normalizar(s).replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return chave(a) === chave(b);
  }

  /** Campo em branco → 'preenche'. Campo com outro valor → 'diverge'. Igual → 'confirma'. */
  function classificar(atual, sugerido, comparaCodigo) {
    if (!limpo(sugerido)) return null;
    if (!limpo(atual)) return 'preenche';
    var igual = comparaCodigo
      ? D.mesmoCodigo(atual, sugerido)
      : M.normalizar(atual) === M.normalizar(sugerido);
    return igual ? 'confirma' : 'diverge';
  }

  /**
   * Monta as propostas para um táxon a partir do que as fontes devolveram.
   * FUNÇÃO PURA — não toca no táxon, não fala com a rede. Dá para testar.
   *
   * @param {Object} taxon
   * @param {Object} r  { match, vernaculo, inat }  respostas já obtidas
   */
  function propor(taxon, r) {
    r = r || {};
    var itens = [];
    var attrs = taxon.atributos || {};

    function por(o) {
      var tipo = o.tipo || classificar(o.atual, o.sugerido, o.codigo);
      if (!tipo) return;
      o.tipo = tipo;
      itens.push(proposta(o));
    }

    /* ---------------------------------------------- GBIF: hierarquia + autoria */
    var d = r.match && r.match.ok && r.match.dados ? r.match.dados : null;
    if (d && d.matchType !== 'NONE') {
      var deGbif = {
        reino: d.kingdom, filo: d.phylum, classe: d['class'],
        ordem: d.order, familia: d.family, genero: d.genus
      };
      CAMPOS_TAXON.forEach(function (c) {
        /* GÊNERO É CASO À PARTE: trocar o gênero TROCA O NOME CIENTÍFICO,
           porque o nome é gênero + epíteto. Um "aceitar todos" que renomeia
           espécie caladinho é justamente o que não pode acontecer. Por isso
           divergência de gênero nasce como 'atencao' e fica de fora de
           qualquer ação em lote. */
        var divergeGenero = c.chave === 'genero' && limpo(taxon.genero) && limpo(deGbif.genero) &&
          M.normalizar(taxon.genero) !== M.normalizar(deGbif.genero);
        por({
          chave: c.chave, rotulo: c.rotulo,
          atual: taxon[c.chave], sugerido: deGbif[c.chave],
          fonte: 'GBIF · species/match',
          consultadoEm: r.match.consultadoEm,
          tipo: divergeGenero ? 'atencao' : null,
          nota: divergeGenero
            ? 'Trocar o gênero muda o NOME CIENTÍFICO da espécie — é decisão de nomenclatura, não de ' +
              'preenchimento. Resolva pela Conferência taxonômica, que registra o nome antigo como sinônimo.'
            : ''
        });
      });

      /* autoria e ano vêm dentro do scientificName: "Amazona vinacea (Kuhl, 1820)" */
      var autor = B.autorDe(d.scientificName, d.canonicalName);
      por({
        chave: 'autor', rotulo: 'Autor e ano',
        atual: taxon.autor, sugerido: autor,
        fonte: 'GBIF · species/match',
        consultadoEm: r.match.consultadoEm,
        nota: autor ? 'Extraído de "' + d.scientificName + '".' : ''
      });

      por({
        chave: 'chaveGbif', rotulo: 'Chave GBIF',
        atual: taxon.chaveGbif, sugerido: d.usageKey ? String(d.usageKey) : '',
        fonte: 'GBIF · species/match',
        consultadoEm: r.match.consultadoEm,
        nota: 'Identificador da espécie na GBIF. É o que permite consultar nome comum e ocorrências.'
      });
    }

    /* ------------------------------------------------ nome comum em português */
    var nomeComum = '', fonteNome = '', emNome = null, notaNome = '';
    var vern = r.vernaculo && r.vernaculo.ok ? (r.vernaculo.dados || []) : [];
    if (vern.length) {
      nomeComum = vern[0].nome;
      fonteNome = 'GBIF · vernacularNames (language: por)';
      emNome = r.vernaculo.consultadoEm;
      notaNome = vern[0].vezes > 1
        ? 'Confirmado por ' + vern[0].vezes + ' fontes na GBIF' +
          (vern.length > 1 ? '. Outras formas: ' + vern.slice(1, 4).map(function (x) { return x.nome; }).join(', ') : '') + '.'
        : (vern.length > 1 ? 'Outras formas: ' + vern.slice(1, 4).map(function (x) { return x.nome; }).join(', ') + '.' : '');
    }
    var inat = r.inat && r.inat.ok ? r.inat.dados : null;
    if (!nomeComum && inat && inat.nomeComum) {
      nomeComum = inat.nomeComum;
      fonteNome = 'iNaturalist · taxa (locale pt-BR)';
      emNome = r.inat.consultadoEm;
    }
    /* mesmo nome, grafia diferente (hífen do CBRO) não é divergência */
    var tipoNome = null;
    if (limpo(nomeComum) && limpo(taxon.nomeComum) &&
        M.normalizar(taxon.nomeComum) !== M.normalizar(nomeComum) &&
        mesmoNomeComum(taxon.nomeComum, nomeComum)) {
      tipoNome = 'grafia';
      notaNome = 'Mesmo nome, grafia diferente: a fonte usa a forma com hífen, que é a do CBRO. ' +
        (notaNome ? notaNome : '');
    }
    por({
      chave: 'nomeComum', rotulo: 'Nome comum',
      atual: taxon.nomeComum, sugerido: nomeComum,
      fonte: fonteNome, consultadoEm: emNome, nota: notaNome, tipo: tipoNome
    });

    /* ------------------------------------------------------- categoria IUCN */
    if (inat && inat.conservacao && inat.conservacao.sigla) {
      var cs = inat.conservacao;
      if (cs.ehIucn) {
        por({
          chave: 'iucn', alvo: 'atributo', rotulo: 'IUCN', codigo: true,
          atual: attrs.iucn, sugerido: cs.sigla,
          fonte: 'iNaturalist · ' + cs.autoridade,
          consultadoEm: r.inat.consultadoEm,
          nota: 'Categoria da Lista Vermelha (' + cs.statusName + '), republicada pelo iNaturalist. ' +
            'A API da IUCN não é consultada: o termo de uso dela proíbe uso comercial.'
        });
      } else {
        /* Autoridade que não é a IUCN — é lista regional, e preencher o campo
           IUCN com ela seria pôr no laudo uma categoria que a IUCN não deu. */
        por({
          chave: 'iucn', alvo: 'atributo', rotulo: 'IUCN', codigo: true, tipo: 'atencao',
          atual: attrs.iucn, sugerido: cs.sigla,
          fonte: 'iNaturalist · ' + (cs.autoridade || 'autoridade não declarada'),
          consultadoEm: r.inat.consultadoEm,
          nota: 'ATENÇÃO: a categoria ' + cs.sigla + ' (' + cs.statusName + ') vem de ' +
            (cs.autoridade || 'autoridade não declarada') +
            (cs.lugar ? ', para ' + cs.lugar : '') + ' — NÃO é a Lista Vermelha da IUCN. ' +
            'Aceite só se for isso mesmo que você quer no laudo.'
        });
      }
    }

    /* -------------------------------------- Lista Nacional (offline, legal) */
    var lo = conferirListaOficial(taxon);
    if (lo.situacao === 'faltando' || lo.situacao === 'diferente') {
      por({
        chave: 'listaNacional', alvo: 'atributo', rotulo: 'Portaria MMA', codigo: true,
        tipo: lo.situacao === 'faltando' ? 'preenche' : 'diverge',
        atual: lo.atual, sugerido: lo.sugerido,
        fonte: 'Lista Nacional (MMA) · reavaliação 2021',
        consultadoEm: LO ? LO.FONTE.convertidoEm : null,
        nota: lo.texto + ' ' + (LO ? LO.FONTE.limitacao : '')
      });
    } else if (lo.situacao === 'subespecie' || lo.situacao === 'naoConsta') {
      por({
        chave: 'listaNacional', alvo: 'atributo', rotulo: 'Portaria MMA', codigo: true,
        tipo: 'atencao',
        atual: lo.atual, sugerido: lo.situacao === 'subespecie' ? '' : lo.atual,
        fonte: 'Lista Nacional (MMA) · reavaliação 2021',
        consultadoEm: LO ? LO.FONTE.convertidoEm : null,
        nota: lo.texto
      });
    } else if (lo.situacao === 'confere') {
      por({
        chave: 'listaNacional', alvo: 'atributo', rotulo: 'Portaria MMA', codigo: true,
        tipo: 'confirma',
        atual: lo.atual, sugerido: lo.sugerido,
        fonte: 'Lista Nacional (MMA) · reavaliação 2021',
        consultadoEm: LO ? LO.FONTE.convertidoEm : null,
        nota: lo.texto
      });
    }

    return itens;
  }

  /* ========================================================================
     3. CONSULTA — as três chamadas de rede de um táxon
     ===================================================================== */
  /**
   * Busca as fontes de UM táxon e devolve as propostas prontas.
   * `chaveGbif` conhecida poupa a chamada de match? Não: o match é o que
   * confere o nome. O que ela poupa é a busca do nome comum às cegas.
   */
  function consultarTaxon(taxon, opcoes) {
    opcoes = opcoes || {};
    var nome = M.nomeCientifico(taxon);
    var reg = { match: null, vernaculo: null, inat: null };
    var falhas = [];

    return B.consultar(nome).then(function (match) {
      reg.match = match;
      if (!match.ok) falhas.push({ fonte: 'GBIF · species/match', erro: match.erro, offline: match.offline });

      var chave = (match.ok && match.dados && match.dados.matchType !== 'NONE' && match.dados.usageKey)
        ? match.dados.usageKey
        : (taxon.chaveGbif || null);

      if (!chave) return null;
      return F.esperar(F.PAUSA_MS).then(function () { return F.gbifNomeComum(chave); });
    }).then(function (vern) {
      reg.vernaculo = vern;
      if (vern && !vern.ok) falhas.push({ fonte: 'GBIF · vernacularNames', erro: vern.erro, offline: vern.offline });
      if (opcoes.semInat) return null;
      return F.esperar(F.PAUSA_MS).then(function () { return F.inatTaxon(nome); });
    }).then(function (inat) {
      reg.inat = inat;
      if (inat && !inat.ok) falhas.push({ fonte: 'iNaturalist · taxa', erro: inat.erro, offline: inat.offline });

      var itens = propor(taxon, reg);
      return {
        taxon: taxon,
        propostas: itens,
        respostas: reg,
        falhas: falhas,
        offline: falhas.some(function (f) { return f.offline; }),
        consultadoEm: new Date().toISOString()
      };
    }, function (e) {
      /* nem isso pode derrubar a tela */
      return {
        taxon: taxon, propostas: propor(taxon, reg), respostas: reg,
        falhas: falhas.concat([{ fonte: 'autoecologia', erro: e.message, offline: false }]),
        offline: false, consultadoEm: new Date().toISOString()
      };
    });
  }

  /**
   * O botão em lote. Um táxon por vez, com respiro entre eles — e parável.
   * Se a rede cai, para: não adianta insistir sessenta vezes.
   */
  function consultarLote(taxons, aoProgresso, devoParar) {
    var lista = (taxons || []).slice();
    var saida = [], i = 0;

    function passo() {
      if (i >= lista.length || (devoParar && devoParar())) return Promise.resolve(saida);
      return consultarTaxon(lista[i]).then(function (res) {
        saida.push(res);
        i++;
        if (aoProgresso) aoProgresso(i, lista.length, res);
        if (res.offline) return saida;
        return F.esperar(F.PAUSA_MS).then(passo);
      });
    }
    return passo();
  }

  /* ========================================================================
     4. APLICAR — o único ponto que ESCREVE no dado
     ===================================================================== */
  /**
   * Aplica UMA proposta ao táxon e registra a procedência.
   * Não salva: quem salva é quem chamou (ARMAZENAMENTO.salvar).
   *
   * `procedencia` é o que faz a origem do dado aparecer no laudo: para cada
   * campo aceito, de que fonte veio, quando foi consultado e quando ele
   * aceitou.
   */
  function aplicar(taxon, p) {
    if (!p || !p.sugerido) return false;
    if (p.alvo === 'atributo') {
      if (!taxon.atributos) taxon.atributos = {};
      taxon.atributos[p.chave] = p.sugerido;
    } else {
      taxon[p.chave] = p.sugerido;
    }
    if (!taxon.procedencia) taxon.procedencia = {};
    taxon.procedencia[(p.alvo === 'atributo' ? 'at_' : '') + p.chave] = {
      valor: p.sugerido,
      fonte: p.fonte,
      consultadoEm: p.consultadoEm,
      aceitoEm: new Date().toISOString()
    };
    return true;
  }

  /** As fontes distintas usadas num catálogo — para a nota de procedência do laudo. */
  function fontesUsadas(taxons) {
    var mapa = {};
    (taxons || []).forEach(function (t) {
      var pr = t.procedencia || {};
      Object.keys(pr).forEach(function (k) {
        var f = pr[k];
        if (!f || !f.fonte) return;
        if (!mapa[f.fonte]) mapa[f.fonte] = { fonte: f.fonte, campos: 0, taxons: {}, primeira: null, ultima: null };
        var m = mapa[f.fonte];
        m.campos++;
        m.taxons[t.id] = 1;
        var em = f.consultadoEm || f.aceitoEm;
        if (em) {
          if (!m.primeira || em < m.primeira) m.primeira = em;
          if (!m.ultima || em > m.ultima) m.ultima = em;
        }
      });
    });
    return Object.keys(mapa).map(function (k) {
      var m = mapa[k];
      return { fonte: m.fonte, campos: m.campos, taxons: Object.keys(m.taxons).length, primeira: m.primeira, ultima: m.ultima };
    }).sort(function (a, b) { return b.campos - a.campos; });
  }

  /** Quantos campos de autoecologia estão preenchidos, e quantos faltam. */
  function cobertura(taxons, grupo) {
    var attrs = D.atributosDoGrupo(grupo || 'aves');
    var campos = ['classe', 'ordem', 'familia', 'nomeComum', 'autor'];
    var total = 0, cheios = 0;
    (taxons || []).forEach(function (t) {
      campos.forEach(function (c) { total++; if (limpo(t[c])) cheios++; });
      attrs.forEach(function (a) { total++; if (limpo((t.atributos || {})[a.chave])) cheios++; });
    });
    return { total: total, preenchidos: cheios, vazios: total - cheios, perc: total ? cheios / total : 0 };
  }

  global.AUTOECOLOGIA = {
    conferirListaOficial: conferirListaOficial,
    cruzarListaOficial: cruzarListaOficial,
    propor: propor,
    mesmoNomeComum: mesmoNomeComum,
    consultarTaxon: consultarTaxon,
    consultarLote: consultarLote,
    aplicar: aplicar,
    fontesUsadas: fontesUsadas,
    cobertura: cobertura,
    CAMPOS_TAXON: CAMPOS_TAXON
  };
})(typeof window !== 'undefined' ? window : globalThis);
