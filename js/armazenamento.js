/* ============================================================================
   Seara Biologia — Fauna — armazenamento.js
   Persistência em localStorage + export/import JSON + export CSV.
   O catálogo de táxons é do app inteiro (não do projeto): a mesma espécie
   aparece em vários empreendimentos, e a autoecologia não muda de cliente
   para cliente.
   ========================================================================== */
(function (global) {
  'use strict';

  var CHAVE = 'searaFauna.v1';
  var D = global.DADOS;
  var M = global.MOTOR;

  function uid(pref) {
    return (pref || 'f') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  function estadoInicial() {
    return {
      versao: 1,
      projetos: [],
      taxons: [],
      tema: 'auto',
      projetoAtivo: null,
      campanhaAtiva: null,
      unidadeAtiva: null,
      exemploSemeado: false,
      /* projetos cujo painel de achados ele mandou sumir — por projeto,
         porque dispensar o de um empreendimento não diz nada sobre o outro */
      achadosDispensados: {},
      /* de-para de colunas guardado por cabeçalho de arquivo importado */
      mapeamentos: {}
    };
  }

  var estado = estadoInicial();

  function carregar() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (bruto) {
        var lido = JSON.parse(bruto);
        estado = Object.assign(estadoInicial(), lido);
        if (!Array.isArray(estado.projetos)) estado.projetos = [];
        if (!Array.isArray(estado.taxons)) estado.taxons = [];
      }
    } catch (e) {
      console.warn('Não foi possível ler os dados salvos:', e);
      estado = estadoInicial();
    }
    return estado;
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      console.error('Falha ao salvar:', e);
      return false;
    }
  }

  function obter() { return estado; }

  function substituir(novo) {
    estado = Object.assign(estadoInicial(), novo);
    salvar();
    return estado;
  }

  /* ------------------------------------------------------------- projetos */

  function projetoVazio(dados) {
    return Object.assign({
      id: uid('p'),
      nome: '',
      cliente: '',
      municipio: '',
      uf: 'MG',
      orgao: '',
      processo: '',
      responsavel: '',
      registroProfissional: '',
      grupo: 'aves',
      observacao: '',
      /* Dados secundários = lista de espécies vinda de literatura, para a
         comparação primários × secundários do laudo. */
      secundarios: { titulo: '', autores: '', especies: [] },
      campanhas: []
    }, dados || {});
  }

  function novoProjeto(dados) {
    var p = projetoVazio(dados);
    estado.projetos.push(p);
    salvar();
    return p;
  }

  function atualizarProjeto(id, dados) {
    var p = acharProjeto(id);
    if (!p) return null;
    Object.assign(p, dados);
    salvar();
    return p;
  }

  function removerProjeto(id) {
    estado.projetos = estado.projetos.filter(function (p) { return p.id !== id; });
    if (estado.projetoAtivo === id) definirAtivos(null, null, null);
    salvar();
  }

  function acharProjeto(id) {
    return estado.projetos.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ------------------------------------------------------------ campanhas */

  function novaCampanha(projetoId, dados) {
    var p = acharProjeto(projetoId);
    if (!p) return null;
    var c = Object.assign({
      id: uid('c'),
      rotulo: (p.campanhas.length + 1) + 'ª campanha',
      sazonalidade: p.campanhas.length % 2 === 0 ? 'chuva' : 'seca',
      dataInicio: hoje(),
      dataFim: hoje(),
      equipe: '',
      observacao: '',
      unidades: []
    }, dados || {});
    p.campanhas.push(c);
    salvar();
    return c;
  }

  function atualizarCampanha(projetoId, campanhaId, dados) {
    var c = acharCampanha(projetoId, campanhaId);
    if (!c) return null;
    Object.assign(c, dados);
    salvar();
    return c;
  }

  function removerCampanha(projetoId, campanhaId) {
    var p = acharProjeto(projetoId);
    if (!p) return;
    p.campanhas = p.campanhas.filter(function (c) { return c.id !== campanhaId; });
    if (estado.campanhaAtiva === campanhaId) { estado.campanhaAtiva = null; estado.unidadeAtiva = null; }
    salvar();
  }

  function acharCampanha(projetoId, campanhaId) {
    var p = acharProjeto(projetoId);
    if (!p) return null;
    return p.campanhas.filter(function (c) { return c.id === campanhaId; })[0] || null;
  }

  /* ---------------------------------------------------- unidades amostrais */

  function unidadeVazia(metodoChave, indice) {
    var met = D.metodo(metodoChave || 'transecto');
    var esf = {};
    met.campos.forEach(function (c) { if (c.padrao !== undefined) esf[c.chave] = c.padrao; });
    return {
      id: uid('u'),
      metodo: met.chave,
      codigo: prefixo(met.chave) + ' ' + String((indice || 0) + 1).padStart(2, '0'),
      latitude: '', longitude: '', altitude: '',
      fitofisionomia: '',
      areaInfluencia: 'ADA',
      data: hoje(),
      horaInicio: '', horaFim: '',
      nebulosidade: '', vento: '', temperatura: '',
      observacao: '',
      esforco: esf,
      registros: []
    };
  }

  function prefixo(metodoChave) {
    return {
      transecto: 'TST', pontoEscuta: 'PE', armadilhaFoto: 'AF', pitfall: 'PF',
      redeNeblina: 'RN', buscaAtiva: 'BA', playback: 'PB', redePesca: 'RP'
    }[metodoChave] || 'UA';
  }

  function novaUnidade(projetoId, campanhaId, dados) {
    var c = acharCampanha(projetoId, campanhaId);
    if (!c) return null;
    var u = Object.assign(unidadeVazia((dados && dados.metodo) || 'transecto', c.unidades.length), dados || {});
    c.unidades.push(u);
    salvar();
    return u;
  }

  function atualizarUnidade(projetoId, campanhaId, unidadeId, dados) {
    var u = acharUnidade(projetoId, campanhaId, unidadeId);
    if (!u) return null;
    Object.assign(u, dados);
    salvar();
    return u;
  }

  function removerUnidade(projetoId, campanhaId, unidadeId) {
    var c = acharCampanha(projetoId, campanhaId);
    if (!c) return;
    c.unidades = c.unidades.filter(function (u) { return u.id !== unidadeId; });
    if (estado.unidadeAtiva === unidadeId) estado.unidadeAtiva = null;
    salvar();
  }

  function acharUnidade(projetoId, campanhaId, unidadeId) {
    var c = acharCampanha(projetoId, campanhaId);
    if (!c) return null;
    return c.unidades.filter(function (u) { return u.id === unidadeId; })[0] || null;
  }

  /* ------------------------------------------------------------- registros */

  function novoRegistro(unidade, dados) {
    var r = Object.assign({
      id: uid('r'),
      taxonId: '',
      quantidade: 1,
      tipo: 'visual',
      data: unidade.data || hoje(),
      hora: '',
      observador: '',
      foto: '',
      observacao: ''
    }, dados || {});
    unidade.registros.push(r);
    salvar();
    return r;
  }

  function atualizarRegistro(unidade, registroId, dados) {
    var r = (unidade.registros || []).filter(function (x) { return x.id === registroId; })[0];
    if (!r) return null;
    Object.assign(r, dados);
    salvar();
    return r;
  }

  function removerRegistro(unidade, registroId) {
    unidade.registros = (unidade.registros || []).filter(function (r) { return r.id !== registroId; });
    salvar();
  }

  /* ---------------------------------------------------------------- táxons */

  function taxonVazio(dados) {
    return Object.assign({
      id: uid('t'),
      grupo: 'aves',
      reino: 'Animalia',
      filo: 'Chordata',
      classe: '',
      ordem: '',
      familia: '',
      genero: '',
      epiteto: '',
      nomeComum: '',
      autor: '',
      statusTaxonomico: '',
      chaveGbif: '',
      sinonimoDe: '',
      foraDoCatalogo: false,
      atributos: {},
      /* Última verificação na GBIF, guardada para funcionar offline. */
      gbif: null
    }, dados || {});
  }

  function novoTaxon(dados) {
    var t = taxonVazio(dados);
    estado.taxons.push(t);
    salvar();
    return t;
  }

  function atualizarTaxon(id, dados) {
    var t = acharTaxon(id);
    if (!t) return null;
    Object.assign(t, dados);
    salvar();
    return t;
  }

  function removerTaxon(id) {
    estado.taxons = estado.taxons.filter(function (t) { return t.id !== id; });
    /* remove também os registros órfãos, senão o cálculo conta indivíduos
       sem espécie e a riqueza fica errada sem ninguém perceber */
    estado.projetos.forEach(function (p) {
      p.campanhas.forEach(function (c) {
        c.unidades.forEach(function (u) {
          u.registros = (u.registros || []).filter(function (r) { return r.taxonId !== id; });
        });
      });
    });
    salvar();
  }

  function acharTaxon(id) {
    return estado.taxons.filter(function (t) { return t.id === id; })[0] || null;
  }

  function taxonsPorId() {
    var m = {};
    estado.taxons.forEach(function (t) { m[t.id] = t; });
    return m;
  }

  /** Busca por nome científico normalizado (sem acento, sem caixa). */
  function acharTaxonPorNome(nome) {
    var alvo = M.normalizar(nome);
    for (var i = 0; i < estado.taxons.length; i++) {
      if (M.normalizar(M.nomeCientifico(estado.taxons[i])) === alvo) return estado.taxons[i];
    }
    return null;
  }

  /* Quantos registros existem para cada táxon, no app inteiro. */
  function usoDosTaxons() {
    var uso = {};
    estado.projetos.forEach(function (p) {
      p.campanhas.forEach(function (c) {
        c.unidades.forEach(function (u) {
          (u.registros || []).forEach(function (r) {
            uso[r.taxonId] = (uso[r.taxonId] || 0) + 1;
          });
        });
      });
    });
    return uso;
  }

  /* --------------------------------------------------------------- ativos */

  function ativos() {
    var p = acharProjeto(estado.projetoAtivo);
    var c = p ? (p.campanhas.filter(function (x) { return x.id === estado.campanhaAtiva; })[0] || null) : null;
    var u = c ? (c.unidades.filter(function (x) { return x.id === estado.unidadeAtiva; })[0] || null) : null;
    return { projeto: p, campanha: c, unidade: u };
  }

  function definirAtivos(projetoId, campanhaId, unidadeId) {
    estado.projetoAtivo = projetoId || null;
    estado.campanhaAtiva = campanhaId || null;
    estado.unidadeAtiva = unidadeId || null;
    salvar();
  }

  function definirTema(t) { estado.tema = t; salvar(); }

  /* --------------------------------------------------------- export/import */

  function exportarJSON() { return JSON.stringify(estado, null, 2); }

  function importarJSON(texto) {
    var lido = JSON.parse(texto);
    if (!lido || !Array.isArray(lido.projetos)) {
      throw new Error('Arquivo inválido: não encontrei a lista de projetos.');
    }
    return substituir(lido);
  }

  /** Junta o arquivo importado ao que já existe, sem apagar nada. */
  function mesclarJSON(texto) {
    var lido = JSON.parse(texto);
    if (!lido || !Array.isArray(lido.projetos)) {
      throw new Error('Arquivo inválido: não encontrei a lista de projetos.');
    }
    var mapaNome = {};
    estado.taxons.forEach(function (t) { mapaNome[M.normalizar(M.nomeCientifico(t))] = t; });

    var deParaTaxon = {};
    (lido.taxons || []).forEach(function (t) {
      var nome = M.normalizar(M.nomeCientifico(t));
      if (mapaNome[nome]) { deParaTaxon[t.id] = mapaNome[nome].id; return; }
      var novo = clonar(t);
      novo.id = uid('t');
      estado.taxons.push(novo);
      mapaNome[nome] = novo;
      deParaTaxon[t.id] = novo.id;
    });

    (lido.projetos || []).forEach(function (p) {
      var np = clonar(p);
      np.id = uid('p');
      (np.campanhas || []).forEach(function (c) {
        c.id = uid('c');
        (c.unidades || []).forEach(function (u) {
          u.id = uid('u');
          (u.registros || []).forEach(function (r) {
            r.id = uid('r');
            if (deParaTaxon[r.taxonId]) r.taxonId = deParaTaxon[r.taxonId];
          });
        });
      });
      estado.projetos.push(np);
    });
    salvar();
    return estado;
  }

  /** CSV dos registros de um projeto (separador ';' — padrão Excel pt-BR). */
  function exportarCSVRegistros(projeto, taxons) {
    var mapa = {};
    (taxons || estado.taxons).forEach(function (t) { mapa[t.id] = t; });
    var cab = ['Campanha', 'Sazonalidade', 'Unidade amostral', 'Método', 'Data', 'Ordem', 'Família',
      'Nome científico', 'Nome comum', 'Quantidade', 'Tipo de registro', 'Observador', 'Observação'];
    var linhas = [cab.join(';')];
    (projeto.campanhas || []).forEach(function (c) {
      (c.unidades || []).forEach(function (u) {
        var met = D.metodo(u.metodo);
        (u.registros || []).forEach(function (r) {
          var t = mapa[r.taxonId] || {};
          linhas.push([
            c.rotulo, c.sazonalidade, u.codigo, met.rotulo, u.data,
            t.ordem || '', t.familia || '', M.nomeCientifico(t), t.nomeComum || '',
            String(r.quantidade).replace('.', ','), r.tipo, r.observador || '', r.observacao || ''
          ].map(csvCampo).join(';'));
        });
      });
    });
    return '﻿' + linhas.join('\r\n');
  }

  /** CSV da tabela de espécies com autoecologia (a `Tab para laudo`). */
  function exportarCSVTaxons(lista, grupo) {
    /* As colunas de autoecologia são as do grupo pedido — exportar um
       catálogo de mastofauna com coluna "Dependência de mata" seria exportar
       uma escala de ave em branco. */
    var attrs = D.atributosDoGrupo(grupo || 'aves');
    var cab = ['Ordem', 'Família', 'Nome científico', 'Nome comum'];
    attrs.forEach(function (a) { cab.push(a.rotulo); });
    cab.push('Chave GBIF', 'Status taxonômico');
    var linhas = [cab.join(';')];
    (lista || []).forEach(function (t) {
      var l = [t.ordem || '', t.familia || '', M.nomeCientifico(t), t.nomeComum || ''];
      attrs.forEach(function (a) { l.push((t.atributos || {})[a.chave] || ''); });
      l.push(t.chaveGbif || '', t.statusTaxonomico || '');
      linhas.push(l.map(csvCampo).join(';'));
    });
    return '﻿' + linhas.join('\r\n');
  }

  function csvCampo(v) {
    var s = String(v === null || v === undefined ? '' : v);
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function baixar(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: (tipo || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ------------------------------------------------------ projetos exemplo */
  /**
   * Abre um dos exemplos de `js/exemplos.js` (avifauna em transecto ou
   * mastofauna em armadilha fotográfica). Os dois coexistem: abrir um não
   * apaga o outro, e o catálogo de táxons é compartilhado por nome
   * científico.
   */
  function abrirExemplo(chave) {
    var E = global.EXEMPLOS;
    if (!E) return null;
    var ex = E.achar(chave);
    if (!ex) return null;
    var p = E.montar(chave, global.ARMAZENAMENTO);
    if (!p) return null;
    estado.exemploSemeado = true;
    if (ex.avisos && ex.avisos.length) {
      estado.importacao = { origem: ex.origem || ex.rotulo, avisos: ex.avisos.slice() };
    }
    var c = p.campanhas[0];
    definirAtivos(p.id, c ? c.id : null, (c && c.unidades[0]) ? c.unidades[0].id : null);
    salvar();
    return p;
  }

  /* Na primeira abertura, para a tela não estar vazia. Pode ser apagado sem
     medo: não volta depois de apagado. */
  function semear() {
    if (estado.exemploSemeado) return null;
    return abrirExemplo('avifauna');
  }

  global.ARMAZENAMENTO = {
    uid: uid, hoje: hoje, clonar: clonar,
    carregar: carregar, salvar: salvar, obter: obter, substituir: substituir,

    novoProjeto: novoProjeto, atualizarProjeto: atualizarProjeto,
    removerProjeto: removerProjeto, acharProjeto: acharProjeto, projetoVazio: projetoVazio,

    novaCampanha: novaCampanha, atualizarCampanha: atualizarCampanha,
    removerCampanha: removerCampanha, acharCampanha: acharCampanha,

    novaUnidade: novaUnidade, atualizarUnidade: atualizarUnidade,
    removerUnidade: removerUnidade, acharUnidade: acharUnidade, unidadeVazia: unidadeVazia,
    prefixo: prefixo,

    novoRegistro: novoRegistro, atualizarRegistro: atualizarRegistro, removerRegistro: removerRegistro,

    novoTaxon: novoTaxon, atualizarTaxon: atualizarTaxon, removerTaxon: removerTaxon,
    acharTaxon: acharTaxon, taxonVazio: taxonVazio, taxonsPorId: taxonsPorId,
    acharTaxonPorNome: acharTaxonPorNome, usoDosTaxons: usoDosTaxons,

    ativos: ativos, definirAtivos: definirAtivos, definirTema: definirTema,

    exportarJSON: exportarJSON, importarJSON: importarJSON, mesclarJSON: mesclarJSON,
    exportarCSVRegistros: exportarCSVRegistros, exportarCSVTaxons: exportarCSVTaxons,
    baixar: baixar, semear: semear, abrirExemplo: abrirExemplo
  };
})(typeof window !== 'undefined' ? window : globalThis);
