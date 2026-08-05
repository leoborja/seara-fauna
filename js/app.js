/* ============================================================================
   Seara Biologia — Fauna — app.js
   Interface e eventos. Todo o cálculo vem de motor.js; aqui só apresentação.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DADOS, M = window.MOTOR, G = window.GRAFICOS,
      A = window.ARMAZENAMENTO, B = window.GBIF;
  var estado;

  /* ------------------------------------------------------------- utilidades */
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Número no formato brasileiro: 1.234,56 */
  function fmt(v, casas) {
    if (v === null || v === undefined || v === '' || !isFinite(v)) return '—';
    if (casas === undefined) casas = casasAuto(v);
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }

  function casasAuto(v) {
    var a = Math.abs(v);
    if (a === 0) return 0;
    if (a < 1) return 3;
    if (a < 100) return 2;
    return 1;
  }

  function pct(v, casas) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return fmt(v * 100, casas === undefined ? 1 : casas) + ' %';
  }

  function dataBR(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 && p[0].length === 4 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('mostra');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('mostra'); }, 3200);
  }

  function icone(id, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + '><use href="#' + id + '"></use></svg>'; }

  function avisoHtml(texto, tipo) {
    if (!texto) return '';
    return '<div class="aviso ' + (tipo === 'info' ? 'aviso-info' : '') + '">' +
      icone(tipo === 'info' ? 'ico-info' : 'ico-alerta') + '<span>' + texto + '</span></div>';
  }

  /* ============================================================================
     NOME CIENTÍFICO — itálico sempre, caixa jamais alterada.
     Gênero maiúsculo e epíteto minúsculo carregam significado nomenclatural.
     ========================================================================== */
  function nomeHtml(t, comAutor) {
    if (!t) return '<span class="taxon-sup">—</span>';
    var n = M.nomeCientifico(t);
    var h = '<i class="cientifico">' + esc(n) + '</i>';
    if (comAutor && t.autor) h += ' <span class="cientifico-autor">' + esc(t.autor) + '</span>';
    return h;
  }

  function nomeTexto(t) { return t ? M.nomeCientifico(t) : ''; }

  /* ============================================================================
     GRUPO FAUNÍSTICO — o que decide qual autoecologia aparece.
     Dependência de mata e sensibilidade de Stotz são escalas de AVE; hábito,
     período de atividade e porte são de mamífero. Nenhuma tela conhece essa
     lista: ela vem toda de DADOS.atributosDoGrupo().
     ========================================================================== */
  function grupoDoProjeto() {
    var p = A.ativos().projeto;
    return (p && p.grupo) || 'aves';
  }

  /* --------------------------------------------------------------- métodos */
  function metodoDe(u) { return D.metodo(u.metodo); }

  function esforcoDe(u) {
    var met = metodoDe(u);
    return met.esforco(u.esforco || {});
  }

  function esforcoTexto(u) {
    var met = metodoDe(u), e = esforcoDe(u);
    if (e === null) return '—';
    return fmt(e, casasAuto(e)) + ' ' + met.unidade;
  }

  /* ------------------------------------------------------------------ tema */
  function aplicarTema() {
    var t = estado.tema || 'auto';
    document.documentElement.setAttribute('data-tema', t);
    var escuro = t === 'escuro' ||
      (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('#ico-tema').innerHTML = '<use href="#' + (escuro ? 'ico-sol' : 'ico-lua') + '"></use>';
  }

  function alternarTema() {
    var escuro = document.documentElement.getAttribute('data-tema') === 'escuro' ||
      (estado.tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    A.definirTema(escuro ? 'claro' : 'escuro');
    aplicarTema();
    renderizar(telaAtual());
  }

  /* ----------------------------------------------------------------- modal */
  var modalOk = null;

  function abrirModal(titulo, campos, aoSalvar, opts) {
    opts = opts || {};
    $('#modal-titulo').textContent = titulo;
    $('#modal-campos').innerHTML = campos.map(campoHtml).join('');
    modalOk = aoSalvar;
    /* Modal só de escolha (exemplos, tipo de importação) não tem o que
       salvar: o botão sumiria como enfeite inerte. */
    $('#modal-ok').hidden = !!opts.semSalvar;
    $('#modal-cancelar').textContent = opts.semSalvar ? 'Fechar' : 'Cancelar';
    $('#modal-fundo').hidden = false;
    setTimeout(function () {
      var p = $('#modal-campos input:not([type=hidden]), #modal-campos select, #modal-campos textarea, #modal-campos button');
      if (p) p.focus();
    }, 30);
  }

  function campoHtml(c) {
    if (c.tipo === 'html') return c.html;
    if (c.tipo === 'titulo') return '<h3 style="margin-top:var(--e2)">' + esc(c.rotulo) + '</h3>';
    var id = 'mc-' + c.chave;
    var dica = c.dica ? '<span class="dica-campo">' + esc(c.dica) + '</span>' : '';
    if (c.tipo === 'textarea') {
      return '<div class="campo"><label for="' + id + '">' + esc(c.rotulo) + '</label>' +
        '<textarea id="' + id + '" name="' + esc(c.chave) + '">' + esc(c.valor || '') + '</textarea>' + dica + '</div>';
    }
    if (c.tipo === 'select') {
      return '<div class="campo"><label for="' + id + '">' + esc(c.rotulo) + '</label><select id="' + id + '" name="' + esc(c.chave) + '">' +
        c.opcoes.map(function (o) {
          var v = typeof o === 'string' ? o : (o.valor !== undefined ? o.valor : o.chave);
          var r = typeof o === 'string' ? o : o.rotulo;
          return '<option value="' + esc(v) + '"' + (String(c.valor === undefined ? '' : c.valor) === String(v) ? ' selected' : '') + '>' + esc(r) + '</option>';
        }).join('') + '</select>' + dica + '</div>';
    }
    var sufixo = c.sufixo ? '<span class="sufixo">' + esc(c.sufixo) + '</span>' : '';
    return '<div class="campo"><label for="' + id + '">' + esc(c.rotulo) + '</label>' +
      '<div class="' + (c.sufixo ? 'campo-unidade' : '') + '">' +
      '<input id="' + id + '" name="' + esc(c.chave) + '" type="' + (c.tipo || 'text') + '" value="' + esc(c.valor === undefined || c.valor === null ? '' : c.valor) + '"' +
      (c.obrigatorio ? ' required' : '') + (c.passo ? ' step="any"' : '') +
      (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : '') + '>' + sufixo + '</div>' + dica + '</div>';
  }

  function fecharModal() { $('#modal-fundo').hidden = true; modalOk = null; }

  function confirmar(msg) { return window.confirm(msg); }

  /* ------------------------------------------------------------- roteador */
  var TELAS = ['projetos', 'campanhas', 'unidades', 'registros', 'taxons', 'resultados', 'laudo', 'ajuda'];

  function telaAtual() {
    var h = (location.hash || '#projetos').replace('#', '');
    return TELAS.indexOf(h) === -1 ? 'projetos' : h;
  }

  function rota() {
    var h = telaAtual();
    $$('.tela').forEach(function (s) { s.classList.remove('ativa'); });
    $('#tela-' + h).classList.add('ativa');
    $$('#nav a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + h) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    renderizar(h);
    window.scrollTo(0, 0);
  }

  function renderizar(tela) {
    if (tela === 'projetos') renderProjetos();
    else if (tela === 'campanhas') renderCampanhas();
    else if (tela === 'unidades') renderUnidades();
    else if (tela === 'registros') renderRegistros();
    else if (tela === 'taxons') renderTaxons();
    else if (tela === 'resultados') renderResultados();
    else if (tela === 'laudo') renderLaudo();
  }

  /** Trilha de contexto: projeto › campanha › unidade */
  function trilha(nivel) {
    var at = A.ativos();
    if (!at.projeto) return '';
    var p = ['<b>' + esc(at.projeto.nome || 'Projeto') + '</b>'];
    if (nivel >= 2 && at.campanha) p.push('<b>' + esc(at.campanha.rotulo) + '</b>');
    if (nivel >= 3 && at.unidade) p.push('<b>' + esc(at.unidade.codigo) + '</b>');
    return '<div class="trilha">' + p.join(' <span class="sep">›</span> ') + '</div>';
  }

  function vazioHtml(titulo, texto, botao) {
    return '<div class="vazio">' + icone('ico-fauna') +
      '<h3>' + esc(titulo) + '</h3><p>' + texto + '</p>' + (botao || '') + '</div>';
  }

  /* =======================================================================
     TELA 1 — PROJETOS
     ==================================================================== */
  function renderProjetos() {
    mostrarAvisosImport();
    var pi = $('#painel-import');
    if (pi) { pi.innerHTML = painelImportHtml(); ligarPainelImport(); }
    var alvo = $('#lista-projetos');
    if (!estado.projetos.length) {
      alvo.innerHTML = vazioHtml('Nenhum projeto cadastrado',
        'Comece cadastrando o empreendimento. Depois crie as campanhas, as unidades amostrais e comece a lançar registros. ' +
        'Ou abra um dos <strong>exemplos</strong> — há um de avifauna em transecto e um de mastofauna por armadilha fotográfica.',
        '<button class="btn" data-acao="novo-projeto" type="button">' + icone('ico-mais') + ' Cadastrar o primeiro projeto</button> ' +
        '<button class="btn btn-sec" data-acao="ver-exemplos" type="button">' + icone('ico-fauna') + ' Ver os exemplos</button>');
      return;
    }

    alvo.innerHTML = '<div class="lista">' + estado.projetos.map(function (p) {
      var aberto = estado.projetoAtivo === p.id;
      var iniciais = (p.nome || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase();
      var nUn = p.campanhas.reduce(function (a, c) { return a + c.unidades.length; }, 0);
      var nReg = p.campanhas.reduce(function (a, c) {
        return a + c.unidades.reduce(function (b, u) { return b + (u.registros || []).length; }, 0);
      }, 0);

      var h = '<div><div class="item' + (aberto ? ' ativo' : '') + '" data-projeto="' + p.id + '">' +
        '<div class="avatar">' + esc(iniciais) + '</div>' +
        '<div class="item-corpo">' +
        '<h3>' + esc(p.nome || 'Sem nome') + '</h3>' +
        '<div class="item-meta">' +
        (p.cliente ? '<span>' + esc(p.cliente) + '</span>' : '') +
        '<span>' + icone('ico-pin') + esc(p.municipio || '—') + (p.uf ? ' – ' + esc(p.uf) : '') + '</span>' +
        (p.processo ? '<span>proc. ' + esc(p.processo) + '</span>' : '') +
        '<span class="tag tag-verde">' + p.campanhas.length + ' campanha' + (p.campanhas.length === 1 ? '' : 's') + '</span>' +
        '<span class="tag">' + nUn + ' unidade' + (nUn === 1 ? '' : 's') + '</span>' +
        '<span class="tag">' + nReg + ' registro' + (nReg === 1 ? '' : 's') + '</span>' +
        '</div></div>' +
        '<div class="item-acoes">' +
        '<button class="btn btn-sec btn-pq" data-acao="abrir-projeto" data-projeto="' + p.id + '" type="button">Abrir</button>' +
        '<button class="btn btn-fantasma btn-pq" data-acao="editar-projeto" data-projeto="' + p.id + '" type="button" title="Editar">' + icone('ico-lapis') + '</button>' +
        '<button class="btn btn-perigo btn-pq" data-acao="excluir-projeto" data-projeto="' + p.id + '" type="button" title="Excluir">' + icone('ico-lixo') + '</button>' +
        '</div></div>';

      if (aberto) {
        h += '<div class="sub-lista">' + (p.campanhas.length ? p.campanhas.map(function (c) {
          var reg = c.unidades.reduce(function (b, u) { return b + (u.registros || []).length; }, 0);
          return '<div class="sub-item' + (estado.campanhaAtiva === c.id ? ' ativo' : '') + '">' +
            '<div style="flex:1;min-width:0">' +
            '<div class="titulo">' + esc(c.rotulo) + saz(c.sazonalidade) + '</div>' +
            '<div class="meta">' + dataBR(c.dataInicio) + ' a ' + dataBR(c.dataFim) + ' · ' +
            c.unidades.length + ' unidade' + (c.unidades.length === 1 ? '' : 's') + ' · ' +
            reg + ' registro' + (reg === 1 ? '' : 's') + '</div></div>' +
            '<button class="btn btn-sec btn-pq" data-acao="abrir-campanha" data-projeto="' + p.id + '" data-campanha="' + c.id + '" type="button">Abrir</button>' +
            '</div>';
        }).join('') : '<p class="card-nota" style="padding:6px 0">Nenhuma campanha ainda. Vá em <strong>Campanhas</strong> para criar a primeira.</p>') + '</div>';
      }
      return h + '</div>';
    }).join('') + '</div>';
  }

  function saz(s) {
    if (!s) return '';
    return ' <span class="tag ' + (s === 'chuva' ? 'tag-verde' : 'tag-terra') + '">' +
      (s === 'chuva' ? 'chuva' : 'seca') + '</span>';
  }

  function mostrarAvisosImport() {
    var alvo = $('#avisos-import');
    var imp = estado.importacao;
    if (!imp || !imp.avisos || !imp.avisos.length) { alvo.innerHTML = ''; return; }
    alvo.innerHTML = '<div class="card"><div class="card-titulo">' +
      '<h3>O que a importação encontrou em <span class="taxon-sup">' + esc(imp.origem || 'planilha') + '</span></h3>' +
      '<button class="btn btn-fantasma btn-pq" data-acao="limpar-avisos" type="button">Dispensar</button></div>' +
      '<div class="avisos-pilha">' + imp.avisos.map(function (a) { return avisoHtml(esc(a)); }).join('') + '</div></div>';
  }

  /* =======================================================================
     EXEMPLOS — dois projetos de demonstração, de grupos e métodos
     diferentes. Coexistem: abrir um não apaga o outro.
     ==================================================================== */
  function escolherExemplo() {
    var E = window.EXEMPLOS;
    if (!E) { toast('Os exemplos não carregaram.'); return; }
    abrirModal('Abrir um projeto de exemplo',
      [{ tipo: 'html', html:
        '<p class="card-nota" style="margin-bottom:var(--e3)">Os dois são levantamentos completos, ' +
        'de <strong>grupos e métodos diferentes</strong>. Servem para conferir que o app não é de ave ' +
        'nem de transecto. Abrir um exemplo <strong>não apaga</strong> o que já existe.</p>' +
        '<div class="lista">' + E.LISTA.map(function (ex) {
          return '<button class="item" type="button" data-acao="abrir-exemplo" data-exemplo="' + esc(ex.chave) + '" ' +
            'style="width:100%;text-align:left;cursor:pointer">' +
            '<div class="avatar">' + esc(D.grupo(ex.grupo).rotulo.slice(0, 2)) + '</div>' +
            '<div class="item-corpo"><h3>' + esc(ex.rotulo) + '</h3>' +
            '<div class="item-meta"><span>' + esc(ex.resumo) + '</span></div></div></button>';
        }).join('') + '</div>' }],
      null, { semSalvar: true });
  }

  function abrirExemplo(chave) {
    fecharModal();
    var p = A.abrirExemplo(chave);
    if (!p) { toast('Não consegui montar esse exemplo.'); return; }
    estado = A.obter();
    indiceBusca = null;
    filtroTaxon.grupo = null;
    escopo = 'projeto';
    renderProjetos();
    location.hash = '#projetos';
    toast('Exemplo aberto: ' + p.nome + '.');
  }

  /* =======================================================================
     IMPORTAÇÃO — backup JSON do app, ou tabela genérica (CSV / Darwin Core)
     ==================================================================== */
  var importPendente = null;

  function escolherImportacao() {
    abrirModal('Importar dados',
      [{ tipo: 'html', html:
        '<div class="lista">' +
        '<button class="item" type="button" data-acao="import-json" style="width:100%;text-align:left;cursor:pointer">' +
        '<div class="avatar">JS</div><div class="item-corpo"><h3>Backup JSON do app</h3>' +
        '<div class="item-meta"><span>O arquivo exportado por este app, ou a saída do <code>importar.py</code></span></div></div></button>' +
        '<button class="item" type="button" data-acao="import-tabela" style="width:100%;text-align:left;cursor:pointer">' +
        '<div class="avatar">CSV</div><div class="item-corpo"><h3>Tabela CSV ou TSV</h3>' +
        '<div class="item-meta"><span>Você diz qual coluna é o quê, na tela, e o mapeamento fica guardado</span></div></div></button>' +
        '<button class="item" type="button" data-acao="import-tabela" style="width:100%;text-align:left;cursor:pointer">' +
        '<div class="avatar">DwC</div><div class="item-corpo"><h3>Darwin Core</h3>' +
        '<div class="item-meta"><span><code>scientificName</code>, <code>individualCount</code>, <code>eventDate</code>… ' +
        'reconhecido sozinho. É o que sai de GBIF, eBird e iNaturalist</span></div></div></button>' +
        '</div>' }],
      null, { semSalvar: true });
  }

  function abrirMapeamento(texto, nomeArquivo) {
    var I = window.IMPORTADOR;
    var tabela = I.ler(texto);
    if (!tabela.colunas.length) { toast('Não achei cabeçalho nesse arquivo.'); return; }

    var ass = I.assinatura(tabela.colunas);
    var guardado = (estado.mapeamentos || {})[ass];
    var det = I.detectar(tabela.colunas);

    importPendente = {
      tabela: tabela,
      arquivo: nomeArquivo,
      assinatura: ass,
      mapa: guardado ? A.clonar(guardado) : det.mapa,
      darwinCore: det.darwinCore,
      lembrado: !!guardado,
      opcoes: {
        metodo: 'buscaAtiva',
        grupo: grupoDoProjeto(),
        nomeProjeto: String(nomeArquivo || 'Importado').replace(/\.[^.]+$/, ''),
        campanhaPadrao: '1ª campanha',
        unidadePadrao: 'UA 01',
        lembrar: true
      }
    };
    location.hash = '#projetos';
    renderProjetos();
    var el = $('#painel-import');
    if (el) el.scrollIntoView({ block: 'start' });
  }

  function painelImportHtml() {
    if (!importPendente) return '';
    var I = window.IMPORTADOR, imp = importPendente, tb = imp.tabela;
    var plano = I.preparar(tb, imp.mapa, imp.opcoes);
    imp.plano = plano;
    var r = plano.resumo;
    var nomeDelim = { ';': 'ponto e vírgula', ',': 'vírgula', '\t': 'tabulação', '|': 'barra vertical' }[tb.delimitador] || tb.delimitador;

    var h = '<div class="card" id="cx-import"><div class="card-titulo">' +
      '<h2>Importar <span class="taxon-sup">' + esc(imp.arquivo) + '</span></h2>' +
      '<button class="btn btn-fantasma btn-pq" data-acao="import-cancelar" type="button">Cancelar</button></div>' +
      '<p class="card-nota">' + tb.colunas.length + ' colunas · ' + tb.total + ' linhas · separador: ' + esc(nomeDelim) +
      (imp.darwinCore ? ' · <strong>Darwin Core reconhecido</strong>' : '') +
      (imp.lembrado ? ' · <strong>mapeamento lembrado de uma importação anterior</strong>' : '') + '</p>' +
      (tb.aviso ? '<div style="margin-top:var(--e3)">' + avisoHtml(esc(tb.aviso)) + '</div>' : '') +

      /* de-para de colunas */
      '<h3 style="margin-top:var(--e4);margin-bottom:var(--e2)">O que é cada coluna</h3>' +
      '<div class="grade grade-3">' + I.DESTINOS.map(function (d) {
        return '<div class="campo"><label for="mp-' + d.chave + '">' + esc(d.rotulo) +
          (d.obrigatorio ? ' <span style="color:var(--terra)">*</span>' : '') + '</label>' +
          '<select id="mp-' + d.chave + '" data-mapa="' + d.chave + '">' +
          '<option value="">— não importar</option>' +
          tb.colunas.map(function (c, i) {
            return '<option value="' + i + '"' + (imp.mapa[d.chave] === i ? ' selected' : '') + '>' + esc(c) + '</option>';
          }).join('') + '</select></div>';
      }).join('') + '</div>' +

      /* opções do destino */
      '<h3 style="margin-top:var(--e4);margin-bottom:var(--e2)">Para onde vai</h3>' +
      '<div class="grade grade-3">' +
      '<div class="campo"><label for="op-nome">Nome do projeto</label>' +
      '<input id="op-nome" data-opcao="nomeProjeto" type="text" value="' + esc(imp.opcoes.nomeProjeto) + '"></div>' +
      '<div class="campo"><label for="op-grupo">Grupo faunístico</label><select id="op-grupo" data-opcao="grupo">' +
      D.GRUPOS.map(function (g) {
        return '<option value="' + g.chave + '"' + (imp.opcoes.grupo === g.chave ? ' selected' : '') + '>' + esc(g.rotulo) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="campo"><label for="op-metodo">Método (quando a tabela não disser)</label><select id="op-metodo" data-opcao="metodo">' +
      D.METODOS.map(function (m) {
        return '<option value="' + m.chave + '"' + (imp.opcoes.metodo === m.chave ? ' selected' : '') + '>' + esc(m.rotulo) + ' — ' + esc(m.unidade) + '</option>';
      }).join('') + '</select></div>' +
      '</div>' +
      '<div style="margin-top:var(--e3)">' + avisoHtml(
        'A tabela traz <strong>quem</strong> foi visto e <strong>onde</strong>, mas não o <strong>esforço</strong>. ' +
        'Depois de importar, abra <strong>Unidades amostrais</strong> e preencha o esforço de cada uma — sem ele ' +
        'não há densidade nem comparação entre métodos.') + '</div>';

    /* pré-visualização */
    h += '<h3 style="margin-top:var(--e5);margin-bottom:var(--e2)">Pré-visualização</h3>' +
      '<div class="painel-num" style="margin-bottom:var(--e3)">' +
      numCx(fmt(r.aceitas, 0), 'linhas aceitas') +
      numCx(fmt(r.rejeitadas, 0), 'rejeitadas', '', r.rejeitadas > 0) +
      numCx(fmt(r.especies, 0), 'espécies') +
      numCx(fmt(r.individuos, 0), 'indivíduos') +
      numCx(fmt(r.campanhas, 0), 'campanhas') +
      numCx(fmt(r.unidades, 0), 'unidades amostrais') +
      '</div>';

    if (!imp.mapa.especie && imp.mapa.especie !== 0) {
      h += avisoHtml('Escolha a coluna do <strong>nome científico</strong>. Sem ela não há o que importar.');
    }

    var amostra = [];
    plano.campanhas.forEach(function (c) {
      c.unidades.forEach(function (u) {
        u.registros.forEach(function (reg) {
          if (amostra.length < 10) amostra.push({ c: c, u: u, r: reg });
        });
      });
    });
    if (amostra.length) {
      h += '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
        '<th class="esq">Campanha</th><th class="esq">Unidade</th><th class="esq">Método</th>' +
        '<th class="esq">Espécie</th><th>Quant.</th><th class="esq">Tipo</th><th class="esq">Data</th>' +
        '</tr></thead><tbody>' + amostra.map(function (a) {
          var e = plano.especies[a.r.especie];
          return '<tr><td class="esq">' + esc(a.c.rotulo) + '</td>' +
            '<td class="esq">' + esc(a.u.codigo) + '</td>' +
            '<td class="esq">' + esc(D.metodo(a.u.metodo).rotulo) + '</td>' +
            '<td class="esq"><i class="cientifico">' + esc(e.nome) + '</i></td>' +
            '<td>' + fmt(a.r.quantidade, 0) + '</td>' +
            '<td class="esq">' + esc(a.r.tipo) + '</td>' +
            '<td class="esq">' + dataBR(a.r.data) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (r.aceitas > amostra.length ? '<p class="card-nota" style="margin-top:6px">Mostrando ' + amostra.length +
          ' de ' + r.aceitas + ' linhas aceitas.</p>' : '');
    }

    if (r.semQuantidade) {
      h += '<div style="margin-top:var(--e3)">' + avisoHtml(r.semQuantidade +
        ' linha(s) sem quantidade — entraram como <strong>1 indivíduo</strong>.', 'info') + '</div>';
    }
    if (r.semData) {
      h += '<div style="margin-top:var(--e3)">' + avisoHtml(r.semData +
        ' linha(s) sem data legível — a data fica em branco no registro.', 'info') + '</div>';
    }

    if (plano.rejeitados.length) {
      h += '<h3 style="margin-top:var(--e4);margin-bottom:var(--e2)">Rejeitadas (' + plano.rejeitados.length + ')</h3>' +
        '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
        '<th>Linha</th><th class="esq">Valor</th><th class="esq">Motivo</th></tr></thead><tbody>' +
        plano.rejeitados.slice(0, 30).map(function (x) {
          return '<tr><td>' + x.linha + '</td><td class="esq">' + esc(x.valor) + '</td>' +
            '<td class="esq">' + esc(x.motivo) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (plano.rejeitados.length > 30 ? '<p class="card-nota" style="margin-top:6px">Mostrando 30 de ' +
          plano.rejeitados.length + '.</p>' : '');
    }

    h += '<div class="modal-acoes" style="margin-top:var(--e5)">' +
      '<label style="display:flex;align-items:center;gap:8px;margin-right:auto;font-size:.86rem">' +
      '<input type="checkbox" id="op-lembrar" data-opcao="lembrar"' + (imp.opcoes.lembrar ? ' checked' : '') + '> ' +
      'Lembrar este mapeamento para arquivos com o mesmo cabeçalho</label>' +
      '<button class="btn btn-fantasma" data-acao="import-cancelar" type="button">Cancelar</button>' +
      '<button class="btn" data-acao="import-confirmar" type="button"' + (r.aceitas ? '' : ' disabled') + '>' +
      icone('ico-check') + ' Importar ' + fmt(r.aceitas, 0) + ' linha' + (r.aceitas === 1 ? '' : 's') + '</button>' +
      '</div></div>';
    return h;
  }

  function ligarPainelImport() {
    if (!importPendente) return;
    $$('#cx-import [data-mapa]').forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-mapa');
        if (el.value === '') delete importPendente.mapa[k];
        else importPendente.mapa[k] = Number(el.value);
        renderProjetos();
      });
    });
    $$('#cx-import [data-opcao]').forEach(function (el) {
      var ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, function () {
        importPendente.opcoes[el.getAttribute('data-opcao')] =
          el.type === 'checkbox' ? el.checked : el.value;
        if (ev === 'change') renderProjetos();
      });
    });
  }

  function confirmarImportacao() {
    var imp = importPendente;
    if (!imp || !imp.plano || !imp.plano.resumo.aceitas) return;
    var plano = imp.plano, o = imp.opcoes;

    if (o.lembrar) {
      if (!estado.mapeamentos) estado.mapeamentos = {};
      estado.mapeamentos[imp.assinatura] = A.clonar(imp.mapa);
    }

    /* táxons primeiro: reaproveita o que já existe, por nome normalizado */
    var ids = {};
    Object.keys(plano.especies).forEach(function (k) {
      var e = plano.especies[k];
      var achado = A.acharTaxonPorNome(e.nome);
      if (achado) { ids[k] = achado.id; return; }
      var pn = M.partirNome(e.nome);
      ids[k] = A.novoTaxon({
        grupo: o.grupo, classe: e.classe || D.grupo(o.grupo).classe,
        ordem: e.ordem, familia: e.familia,
        genero: pn.genero, epiteto: pn.epiteto, nomeComum: e.nomeComum
      }).id;
    });

    var p = A.novoProjeto({ nome: o.nomeProjeto || 'Importado', grupo: o.grupo });
    plano.campanhas.forEach(function (c) {
      var camp = A.novaCampanha(p.id, { rotulo: c.rotulo });
      c.unidades.forEach(function (u) {
        var un = A.novaUnidade(p.id, camp.id, {
          metodo: u.metodo, codigo: u.codigo, data: u.data || A.hoje(),
          latitude: u.latitude || '', longitude: u.longitude || '', esforco: {}
        });
        u.registros.forEach(function (reg) {
          A.novoRegistro(un, {
            taxonId: ids[reg.especie], quantidade: reg.quantidade, tipo: reg.tipo,
            data: reg.data || un.data, hora: reg.hora, observador: reg.observador,
            observacao: reg.observacao
          });
        });
      });
    });

    var r = plano.resumo;
    estado.importacao = {
      origem: imp.arquivo,
      avisos: [
        'Importadas ' + r.aceitas + ' linha(s): ' + r.especies + ' espécies, ' + r.individuos +
        ' indivíduos, ' + r.unidades + ' unidade(s) amostral(is) em ' + r.campanhas + ' campanha(s).' +
        (r.rejeitadas ? ' ' + r.rejeitadas + ' linha(s) foram rejeitadas.' : ''),
        'Nenhuma unidade amostral veio com esforço — a tabela não traz isso. Preencha em ' +
        'Unidades amostrais antes de olhar densidade.'
      ].concat(plano.rejeitados.slice(0, 8).map(function (x) {
        return 'Linha ' + x.linha + ' rejeitada — ' + x.motivo + (x.valor ? ' (' + x.valor + ')' : '') + '.';
      }))
    };

    var c0 = p.campanhas[0];
    A.definirAtivos(p.id, c0 ? c0.id : null, (c0 && c0.unidades[0]) ? c0.unidades[0].id : null);
    A.salvar();
    importPendente = null;
    estado = A.obter();
    indiceBusca = null;
    filtroTaxon.grupo = null;
    escopo = 'projeto';
    renderProjetos();
    toast('Importadas ' + r.aceitas + ' linha(s) em "' + p.nome + '".');
  }

  function formProjeto(p) {
    return [
      { chave: 'nome', rotulo: 'Nome do empreendimento', valor: p ? p.nome : '', obrigatorio: true, placeholder: 'Ex.: Mineração Planalto' },
      { chave: 'cliente', rotulo: 'Cliente', valor: p ? p.cliente : '' },
      { chave: 'municipio', rotulo: 'Município', valor: p ? p.municipio : '', placeholder: 'Ex.: Mariana' },
      { chave: 'uf', rotulo: 'UF', tipo: 'select', opcoes: D.UFS, valor: p ? p.uf : 'MG' },
      { chave: 'orgao', rotulo: 'Órgão licenciador', valor: p ? p.orgao : '', placeholder: 'Ex.: SEMAD/MG' },
      { chave: 'processo', rotulo: 'Nº do processo', valor: p ? p.processo : '' },
      { chave: 'grupo', rotulo: 'Grupo faunístico', tipo: 'select', opcoes: D.GRUPOS, valor: p ? p.grupo : 'aves' },
      { chave: 'responsavel', rotulo: 'Responsável técnico', valor: p ? p.responsavel : '' },
      { chave: 'registroProfissional', rotulo: 'Registro profissional', valor: p ? p.registroProfissional : '', placeholder: 'Ex.: CRBio 00000/04-D' },
      { chave: 'observacao', rotulo: 'Observações', tipo: 'textarea', valor: p ? p.observacao : '' }
    ];
  }

  /* =======================================================================
     TELA 2 — CAMPANHAS
     ==================================================================== */
  function renderCampanhas() {
    var at = A.ativos();
    var alvo = $('#campanhas-conteudo');
    $('#btn-nova-campanha').disabled = !at.projeto;

    if (!at.projeto) {
      alvo.innerHTML = vazioHtml('Nenhum projeto aberto',
        'Escolha um projeto para ver e criar campanhas.',
        '<a class="btn" href="#projetos">Ir para Projetos</a>');
      $('#sub-campanhas').textContent = 'Sem limite e sem duplicar estrutura — cada campanha carrega as próprias unidades.';
      return;
    }

    var p = at.projeto;
    $('#sub-campanhas').textContent = p.nome + ' · ' + (p.municipio || '—') + (p.uf ? '/' + p.uf : '');

    if (!p.campanhas.length) {
      alvo.innerHTML = trilha(1) + vazioHtml('Nenhuma campanha ainda',
        'Cada ida a campo é uma campanha, com a própria sazonalidade e as próprias unidades amostrais. ' +
        'São quantas o licenciamento pedir — sem duplicar planilha.',
        '<button class="btn" data-acao="nova-campanha" type="button">' + icone('ico-mais') + ' Criar a primeira campanha</button>');
      return;
    }

    alvo.innerHTML = trilha(1) + '<div class="lista">' + p.campanhas.map(function (c) {
      var ativo = estado.campanhaAtiva === c.id;
      var mapas = c.unidades.map(function (u) { return M.abundanciaPorTaxon(u.registros); });
      var ix = M.indices(M.vetor(M.somarMapas(mapas)));
      return '<div class="item' + (ativo ? ' ativo' : '') + '">' +
        '<div class="avatar">' + esc(String(p.campanhas.indexOf(c) + 1)) + 'ª</div>' +
        '<div class="item-corpo">' +
        '<h3>' + esc(c.rotulo) + saz(c.sazonalidade) + '</h3>' +
        '<div class="item-meta">' +
        '<span>' + dataBR(c.dataInicio) + ' a ' + dataBR(c.dataFim) + '</span>' +
        (c.equipe ? '<span>' + esc(c.equipe) + '</span>' : '') +
        '<span class="tag">' + c.unidades.length + ' unidade' + (c.unidades.length === 1 ? '' : 's') + '</span>' +
        '<span class="tag tag-verde">S = ' + fmt(ix.S, 0) + '</span>' +
        '<span class="tag">N = ' + fmt(ix.N, 0) + '</span>' +
        '</div></div>' +
        '<div class="item-acoes">' +
        '<button class="btn btn-sec btn-pq" data-acao="abrir-campanha" data-projeto="' + p.id + '" data-campanha="' + c.id + '" type="button">Abrir</button>' +
        '<button class="btn btn-fantasma btn-pq" data-acao="editar-campanha" data-campanha="' + c.id + '" type="button" title="Editar">' + icone('ico-lapis') + '</button>' +
        '<button class="btn btn-perigo btn-pq" data-acao="excluir-campanha" data-campanha="' + c.id + '" type="button" title="Excluir">' + icone('ico-lixo') + '</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  function formCampanha(c) {
    return [
      { chave: 'rotulo', rotulo: 'Rótulo da campanha', valor: c ? c.rotulo : '', obrigatorio: true, placeholder: 'Ex.: 1ª campanha' },
      { chave: 'sazonalidade', rotulo: 'Sazonalidade', tipo: 'select', opcoes: D.SAZONALIDADES, valor: c ? c.sazonalidade : 'chuva' },
      { chave: 'dataInicio', rotulo: 'Data de início', tipo: 'date', valor: c ? c.dataInicio : A.hoje() },
      { chave: 'dataFim', rotulo: 'Data de término', tipo: 'date', valor: c ? c.dataFim : A.hoje() },
      { chave: 'equipe', rotulo: 'Equipe', valor: c ? c.equipe : '' },
      { chave: 'observacao', rotulo: 'Observações', tipo: 'textarea', valor: c ? c.observacao : '' }
    ];
  }

  /* =======================================================================
     TELA 3 — UNIDADES AMOSTRAIS
     ==================================================================== */
  function renderUnidades() {
    var at = A.ativos();
    var alvo = $('#unidades-conteudo');
    $('#btn-nova-unidade').disabled = !at.campanha;

    if (!at.campanha) {
      alvo.innerHTML = vazioHtml('Nenhuma campanha aberta',
        'Escolha uma campanha para cadastrar as unidades amostrais.',
        '<a class="btn" href="#campanhas">Ir para Campanhas</a>');
      $('#sub-unidades').textContent = 'Método, geo, ambiente, condições e esforço. O formulário muda conforme o método.';
      return;
    }

    var c = at.campanha;
    $('#sub-unidades').textContent = at.projeto.nome + ' · ' + c.rotulo;

    if (!c.unidades.length) {
      alvo.innerHTML = trilha(2) + vazioHtml('Nenhuma unidade amostral',
        'Cada unidade declara o próprio <strong>esforço</strong> — km no transecto, armadilha-noite na câmera, ' +
        'm²·h na rede. É isso que permite comparar métodos diferentes no mesmo levantamento.',
        '<button class="btn" data-acao="nova-unidade" type="button">' + icone('ico-mais') + ' Criar a primeira unidade</button>');
      return;
    }

    var semEsforco = c.unidades.filter(function (u) { return esforcoDe(u) === null; });

    alvo.innerHTML = trilha(2) +
      (semEsforco.length ? '<div style="margin-bottom:var(--e4)">' + avisoHtml(
        '<strong>' + semEsforco.length + ' unidade' + (semEsforco.length === 1 ? '' : 's') +
        ' sem esforço preenchido</strong> (' + semEsforco.map(function (u) { return esc(u.codigo); }).join(', ') +
        '). Sem esforço não há densidade nem comparação entre métodos — abra e complete.') + '</div>' : '') +
      '<div class="lista">' + c.unidades.map(function (u) {
        var met = metodoDe(u);
        var res = M.resumoUnidade(u, met);
        var e = res.esforco;
        return '<div class="item' + (estado.unidadeAtiva === u.id ? ' ativo' : '') + '">' +
          '<div class="avatar">' + esc(u.codigo.split(/\s+/)[0] || 'UA') + '</div>' +
          '<div class="item-corpo">' +
          '<h3>' + esc(u.codigo) + ' <span class="tag">' + esc(met.rotulo) + '</span>' +
          (u.areaInfluencia ? ' <span class="tag tag-verde">' + esc(u.areaInfluencia) + '</span>' : '') + '</h3>' +
          '<div class="item-meta">' +
          '<span>' + dataBR(u.data) + '</span>' +
          (u.fitofisionomia ? '<span>' + esc(u.fitofisionomia) + '</span>' : '') +
          (u.latitude || u.longitude ? '<span>' + icone('ico-pin') + esc(u.latitude || '—') + ', ' + esc(u.longitude || '—') + '</span>' : '') +
          '<span class="tag' + (e === null ? ' tag-terra' : '') + '">esforço ' + (e === null ? 'não informado' : fmt(e, casasAuto(e)) + ' ' + esc(met.unidade)) + '</span>' +
          (res.areaHa !== null ? '<span class="tag">' + fmt(res.areaHa, 2) + ' ha</span>' : '') +
          '<span class="tag tag-verde">S = ' + fmt(res.indices.S, 0) + '</span>' +
          '<span class="tag">N = ' + fmt(res.indices.N, 0) + '</span>' +
          '</div></div>' +
          '<div class="item-acoes">' +
          '<button class="btn btn-sec btn-pq" data-acao="abrir-unidade" data-unidade="' + u.id + '" type="button">Registros</button>' +
          '<button class="btn btn-fantasma btn-pq" data-acao="editar-unidade" data-unidade="' + u.id + '" type="button" title="Editar">' + icone('ico-lapis') + '</button>' +
          '<button class="btn btn-perigo btn-pq" data-acao="excluir-unidade" data-unidade="' + u.id + '" type="button" title="Excluir">' + icone('ico-lixo') + '</button>' +
          '</div></div>';
      }).join('') + '</div>';
  }

  /** O formulário da unidade muda conforme o método — é a peça central. */
  function formUnidade(u, metodoChave) {
    var met = D.metodo(metodoChave || (u && u.metodo) || 'transecto');
    var esf = (u && u.esforco) || {};
    var campos = [
      { chave: 'metodo', rotulo: 'Método', tipo: 'select', opcoes: D.METODOS.map(function (m) { return { valor: m.chave, rotulo: m.rotulo }; }), valor: met.chave,
        dica: met.descricao + ' Unidade de esforço: ' + met.unidadeLonga + '.' },
      { chave: 'codigo', rotulo: 'Código', valor: u ? u.codigo : '', obrigatorio: true, placeholder: A.prefixo(met.chave) + ' 01' },
      { chave: 'data', rotulo: 'Data', tipo: 'date', valor: u ? u.data : A.hoje() },
      { chave: 'horaInicio', rotulo: 'Hora de início', tipo: 'time', valor: u ? u.horaInicio : '' },
      { chave: 'horaFim', rotulo: 'Hora de término', tipo: 'time', valor: u ? u.horaFim : '' },
      { tipo: 'titulo', rotulo: 'Esforço amostral — ' + met.unidadeLonga }
    ];

    met.campos.forEach(function (cp) {
      campos.push({
        chave: 'esf_' + cp.chave,
        rotulo: cp.rotulo,
        tipo: cp.tipo === 'texto' ? 'text' : 'number',
        passo: cp.passo,
        sufixo: cp.unidade || '',
        valor: esf[cp.chave] !== undefined ? esf[cp.chave] : (cp.padrao !== undefined ? cp.padrao : '')
      });
    });

    campos.push(
      { tipo: 'titulo', rotulo: 'Localização e ambiente' },
      { chave: 'latitude', rotulo: 'Latitude', valor: u ? u.latitude : '', placeholder: '-20,3778' },
      { chave: 'longitude', rotulo: 'Longitude', valor: u ? u.longitude : '', placeholder: '-43,4058' },
      { chave: 'altitude', rotulo: 'Altitude', tipo: 'number', passo: '1', sufixo: 'm', valor: u ? u.altitude : '' },
      { chave: 'fitofisionomia', rotulo: 'Fitofisionomia', tipo: 'select', opcoes: [''].concat(D.FITOFISIONOMIAS), valor: u ? u.fitofisionomia : '' },
      { chave: 'areaInfluencia', rotulo: 'Área de influência', tipo: 'select', opcoes: D.AREAS_INFLUENCIA.map(function (a) { return { valor: a.chave, rotulo: a.rotulo }; }), valor: u ? u.areaInfluencia : 'ADA' },
      { tipo: 'titulo', rotulo: 'Condições de campo' },
      { chave: 'nebulosidade', rotulo: 'Nebulosidade', valor: u ? u.nebulosidade : '', placeholder: 'Ex.: céu limpo' },
      { chave: 'vento', rotulo: 'Vento', valor: u ? u.vento : '', placeholder: 'Ex.: fraco' },
      { chave: 'temperatura', rotulo: 'Temperatura', tipo: 'number', passo: '0,1', sufixo: '°C', valor: u ? u.temperatura : '' },
      { chave: 'observacao', rotulo: 'Observações', tipo: 'textarea', valor: u ? u.observacao : '' }
    );
    return campos;
  }

  /** Separa os campos de esforço (prefixo esf_) do resto ao salvar. */
  function extrairUnidade(dados) {
    var saida = { esforco: {} };
    Object.keys(dados).forEach(function (k) {
      if (k.indexOf('esf_') === 0) saida.esforco[k.slice(4)] = dados[k];
      else saida[k] = dados[k];
    });
    return saida;
  }

  /* =======================================================================
     TELA 4 — REGISTROS  (rápido de digitar; o João usa isso em campo)
     ==================================================================== */
  function renderRegistros() {
    var at = A.ativos();
    var alvo = $('#registros-conteudo');
    $('#btn-csv-registros').disabled = !at.projeto;

    if (!at.campanha) {
      alvo.innerHTML = vazioHtml('Nenhuma campanha aberta',
        'Escolha uma campanha e uma unidade amostral para lançar registros.',
        '<a class="btn" href="#campanhas">Ir para Campanhas</a>');
      return;
    }
    if (!at.campanha.unidades.length) {
      alvo.innerHTML = trilha(2) + vazioHtml('Nenhuma unidade amostral',
        'Registro pertence a uma unidade amostral. Crie a primeira para começar a lançar.',
        '<a class="btn" href="#unidades">Ir para Unidades</a>');
      return;
    }

    var u = at.unidade || at.campanha.unidades[0];
    if (!at.unidade) A.definirAtivos(at.projeto.id, at.campanha.id, u.id);

    $('#sub-registros').textContent = at.projeto.nome + ' · ' + at.campanha.rotulo + ' · ' + u.codigo;

    var met = metodoDe(u);
    var res = M.resumoUnidade(u, met);
    var mapaTx = A.taxonsPorId();

    alvo.innerHTML = trilha(3) +
      /* seletor de unidade */
      '<div class="card"><div class="card-titulo"><h2>Unidade amostral</h2>' +
      '<span class="card-nota">' + esc(met.rotulo) + ' · esforço ' + esc(esforcoTexto(u)) + '</span></div>' +
      '<div class="segmentado" id="seg-unidade">' + at.campanha.unidades.map(function (x) {
        return '<button type="button" data-unidade="' + x.id + '" aria-pressed="' + (x.id === u.id) + '">' +
          esc(x.codigo) + ' <span style="opacity:.65">(' + (x.registros || []).length + ')</span></button>';
      }).join('') + '</div></div>' +

      /* lançador */
      '<div class="card"><div class="card-titulo"><h2>Lançar registro</h2>' +
      '<span class="card-nota" id="nota-lancador">S = ' + fmt(res.indices.S, 0) + ' · N = ' + fmt(res.indices.N, 0) + '</span></div>' +
      '<div class="lancador"><div class="lancador-grade">' +
      '<div class="campo auto-cx">' +
      '<label for="in-especie">Espécie</label>' +
      '<input id="in-especie" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
      'placeholder="Digite o nome científico ou o nome comum">' +
      '<input type="hidden" id="in-taxon-id">' +
      '<div class="auto-lista" id="auto-lista" hidden></div>' +
      '</div>' +
      '<div class="campo"><label for="in-quant">Quant.</label>' +
      '<input id="in-quant" type="number" inputmode="numeric" pattern="[0-9]*" step="1" min="1" value="1"></div>' +
      '<div class="campo"><label for="in-tipo">Tipo</label><select id="in-tipo">' +
      D.TIPOS_REGISTRO.map(function (t) {
        return '<option value="' + t.chave + '"' + (t.chave === tipoPadrao(u) ? ' selected' : '') + '>' + esc(t.rotulo) + '</option>';
      }).join('') +
      '</select></div>' +
      '<button class="btn" id="btn-lancar" type="button">' + icone('ico-mais') + ' Lançar</button>' +
      '</div>' +
      '<div id="atalhos-recentes">' + atalhosHtml(u, mapaTx) + '</div>' +
      '<div class="dica-teclado nao-imprime" style="margin-top:var(--e3)">' +
      '<span><kbd>Enter</kbd> lança e já volta pro nome</span>' +
      '<span>abreviação serve: <code>cerd tho</code></span>' +
      '<span>quantidade no fim: <code>cerd tho 3</code></span>' +
      '<span><kbd>↓</kbd><kbd>↑</kbd> trocar na lista · <kbd>Tab</kbd> vai pra quantidade</span>' +
      '</div></div></div>' +

      /* tabela de registros */
      '<div class="card"><div class="card-titulo"><h2>Registros de ' + esc(u.codigo) + '</h2>' +
      '<span class="card-nota" id="nota-registros">' + (u.registros || []).length + ' lançamento' + ((u.registros || []).length === 1 ? '' : 's') + '</span></div>' +
      '<div id="cx-registros">' + tabelaRegistros(u, mapaTx) + '</div></div>';

    ligarLancador(u);
  }

  /** Foto na armadilha fotográfica, captura na rede, visual no resto. */
  function tipoPadrao(u) {
    return { armadilhaFoto: 'foto', redeNeblina: 'captura', pitfall: 'captura', redePesca: 'captura' }[u.metodo] || 'visual';
  }

  /* ------------------------------------------------------------ atalhos
     As últimas espécies lançadas NESTA unidade, na ordem inversa. Em
     armadilha fotográfica a mesma espécie volta o tempo todo; um toque
     lança um indivíduo sem digitar nada. */
  function recentesDaUnidade(u, limite) {
    var vistos = {}, saida = [];
    var regs = (u.registros || []);
    for (var i = regs.length - 1; i >= 0 && saida.length < (limite || 8); i--) {
      var id = regs[i].taxonId;
      if (!id || vistos[id]) continue;
      vistos[id] = 1;
      saida.push(id);
    }
    return saida;
  }

  function atalhosHtml(u, mapaTx) {
    var ids = recentesDaUnidade(u, 8);
    if (!ids.length) return '';
    return '<div class="atalhos-cx nao-imprime"><span class="atalhos-rot">Últimas lançadas</span>' +
      '<div class="atalhos">' + ids.map(function (id) {
        var t = mapaTx[id];
        if (!t) return '';
        return '<button class="atalho" type="button" data-acao="atalho" data-taxon="' + esc(id) + '" ' +
          'title="Lançar 1 indivíduo de ' + esc(M.nomeCientifico(t)) + '">' +
          '<i class="cientifico">' + esc(M.nomeCientifico(t)) + '</i>' +
          (t.nomeComum ? '<span class="atalho-comum">' + esc(t.nomeComum) + '</span>' : '') + '</button>';
      }).join('') + '</div></div>';
  }

  function tabelaRegistros(u, mapaTx) {
    var regs = (u.registros || []).slice().reverse();
    if (!regs.length) {
      return '<div class="grafico-vazio">Nenhum registro nesta unidade ainda. Lance o primeiro acima.</div>';
    }
    return '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
      '<th class="esq">Espécie</th><th class="esq">Nome comum</th><th class="esq">Família</th>' +
      '<th>Quant.</th><th class="esq">Tipo</th><th></th></tr></thead><tbody id="corpo-registros">' +
      regs.map(function (r) { return linhaRegistro(r, mapaTx); }).join('') + '</tbody></table></div>';
  }

  function linhaRegistro(r, mapaTx) {
    var t = mapaTx[r.taxonId];
    var tipo = D.TIPOS_REGISTRO.filter(function (x) { return x.chave === r.tipo; })[0];
    return '<tr data-linha="' + esc(r.id) + '"><td class="esq">' + nomeHtml(t) +
      (t && t.foraDoCatalogo ? ' <span class="tag tag-terra">fora do catálogo</span>' : '') + '</td>' +
      '<td class="esq">' + esc((t && t.nomeComum) || '—') + '</td>' +
      '<td class="esq taxon-sup">' + esc((t && t.familia) || '—') + '</td>' +
      '<td>' + fmt(r.quantidade, 0) + '</td>' +
      '<td class="esq">' + esc(tipo ? tipo.rotulo : r.tipo) + '</td>' +
      '<td class="acoes-cel">' +
      '<button class="btn btn-fantasma btn-pq" data-acao="editar-registro" data-registro="' + r.id + '" type="button" title="Editar">' + icone('ico-lapis') + '</button>' +
      '<button class="btn btn-perigo btn-pq" data-acao="excluir-registro" data-registro="' + r.id + '" type="button" title="Excluir">' + icone('ico-lixo') + '</button>' +
      '</td></tr>';
  }

  /* ==========================================================================
     AUTOCOMPLETAR E LANÇAMENTO
     É onde o João passa o tempo. Três coisas encurtam o caminho, medidas e
     não achadas (ver README, "Velocidade de lançamento"):

     1. Busca por ABREVIAÇÃO. `cerd tho` acha Cerdocyon thous. Cada pedaço
        digitado precisa ser começo de alguma palavra do nome científico, do
        nome comum ou da família. Antes só valia o começo literal do nome
        inteiro, então era preciso digitar `cerdocyon t` até desempatar.
     2. QUANTIDADE NO FIM. `cerd tho 3` lança três. Antes exigia mudar de
        campo e voltar.
     3. UM Enter só. Antes eram dois: um para escolher na lista e outro para
        lançar.

     E a tabela não é redesenhada inteira a cada lançamento: entra a linha
     nova, sem o app perder o foco do campo (era ali que se perdia a primeira
     letra do próximo nome quando se digita rápido).
     ======================================================================== */
  var autoSel = -1, autoItens = [], indiceBusca = null;

  /** Índice de busca do catálogo, normalizado uma vez só. */
  function montarIndice() {
    indiceBusca = estado.taxons.map(function (t) {
      var sci = M.nomeCientifico(t);
      var palavras = M.normalizar(sci + ' ' + (t.nomeComum || '') + ' ' + (t.familia || ''))
        .split(/[^a-z0-9]+/).filter(Boolean);
      return {
        t: t,
        gen: M.normalizar(t.genero || ''),
        epi: M.normalizar(t.epiteto || ''),
        sci: M.normalizar(sci),
        comum: M.normalizar(t.nomeComum || ''),
        palavras: palavras
      };
    });
  }

  /**
   * Separa a quantidade do nome: "cerd tho 3" → { termo:'cerd tho', quant:3 }.
   * Só o último pedaço, só se for número inteiro e só se houver nome antes —
   * senão "3" sozinho viraria quantidade sem espécie.
   */
  function partirConsulta(texto) {
    var m = String(texto || '').trim().match(/^(.*\S)\s+(\d{1,4})$/);
    if (m) return { termo: m[1], quant: parseInt(m[2], 10) };
    return { termo: String(texto || '').trim(), quant: null };
  }

  /**
   * Pontuação de um táxon contra os pedaços digitados. -1 = não serve.
   * Todo pedaço precisa casar em algum lugar; a pontuação decide a ordem.
   */
  function pontuar(reg, pedacos, recentes) {
    var total = 0;
    for (var i = 0; i < pedacos.length; i++) {
      var p = pedacos[i], melhor = -1;
      if (reg.gen.indexOf(p) === 0) melhor = Math.max(melhor, i === 0 ? 100 : 70);
      if (reg.epi.indexOf(p) === 0) melhor = Math.max(melhor, i === 1 ? 100 : 70);
      for (var k = 0; k < reg.palavras.length; k++) {
        if (reg.palavras[k].indexOf(p) === 0) { melhor = Math.max(melhor, 60); break; }
      }
      if (melhor < 0 && (reg.sci.indexOf(p) >= 0 || reg.comum.indexOf(p) >= 0)) melhor = 25;
      if (melhor < 0) return -1;
      total += melhor;
    }
    /* nome mais curto primeiro no empate, e o que acabou de ser lançado sobe:
       em armadilha fotográfica a mesma espécie se repete o dia inteiro */
    var pos = recentes.indexOf(reg.t.id);
    if (pos >= 0) total += 30 - pos * 2;
    total -= reg.sci.length * 0.05;
    return total;
  }

  function buscarTaxons(termo, recentes) {
    if (!indiceBusca) montarIndice();
    var pedacos = M.normalizar(termo).split(/[^a-z0-9]+/).filter(Boolean);
    if (!pedacos.length) return [];
    var achados = [];
    for (var i = 0; i < indiceBusca.length; i++) {
      var s = pontuar(indiceBusca[i], pedacos, recentes);
      if (s >= 0) achados.push({ t: indiceBusca[i].t, s: s });
    }
    achados.sort(function (a, b) {
      return b.s - a.s || M.nomeCientifico(a.t).localeCompare(M.nomeCientifico(b.t), 'pt-BR');
    });
    return achados.slice(0, 30).map(function (x) { return x.t; });
  }

  function ligarLancador(u) {
    var inp = $('#in-especie'), lista = $('#auto-lista'), oculto = $('#in-taxon-id');
    if (!inp) return;
    montarIndice();
    var recentes = recentesDaUnidade(u, 8);

    function fechar() { lista.hidden = true; autoSel = -1; }

    function buscar() {
      var c = partirConsulta(inp.value);
      oculto.value = '';
      if (M.normalizar(c.termo).length < 2) { fechar(); autoItens = []; return; }
      autoItens = buscarTaxons(c.termo, recentes);
      autoSel = autoItens.length ? 0 : -1;
      desenhar(c.quant);
    }

    function desenhar(quant) {
      if (!autoItens.length) {
        lista.innerHTML = '<div class="auto-vazio">Nenhuma espécie no catálogo com esse nome. ' +
          '<strong>Enter</strong> cria um táxon novo com o que você digitou.</div>';
        lista.hidden = false;
        return;
      }
      lista.innerHTML = autoItens.map(function (t, i) {
        return '<div class="auto-item' + (i === autoSel ? ' selecionado' : '') + '" data-i="' + i + '">' +
          '<span class="sp">' + nomeHtml(t) + '</span>' +
          (t.nomeComum ? '<span class="comum">' + esc(t.nomeComum) + '</span>' : '') +
          (quant ? '<span class="comum">× ' + esc(quant) + '</span>' : '') +
          (t.familia ? '<span class="fam taxon-sup">' + esc(t.familia) + '</span>' : '') + '</div>';
      }).join('');
      lista.hidden = false;
    }

    /** Escolhe sem lançar — o caminho de quem quer mexer na quantidade. */
    function escolher(i) {
      var t = autoItens[i];
      if (!t) return;
      inp.value = M.nomeCientifico(t);
      oculto.value = t.id;
      fechar();
      $('#in-quant').focus();
      $('#in-quant').select();
    }

    inp.addEventListener('input', buscar);
    inp.addEventListener('focus', function () { if (inp.value.trim().length >= 2) buscar(); });
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') {
        if (lista.hidden) { buscar(); return; }
        ev.preventDefault(); autoSel = Math.min(autoSel + 1, autoItens.length - 1); desenhar(partirConsulta(inp.value).quant);
      } else if (ev.key === 'ArrowUp') {
        if (lista.hidden) return;
        ev.preventDefault(); autoSel = Math.max(autoSel - 1, 0); desenhar(partirConsulta(inp.value).quant);
      } else if (ev.key === 'Enter') {
        /* Um Enter só: escolhe o que está marcado E lança. */
        ev.preventDefault();
        lancar(u, (!lista.hidden && autoSel >= 0 && autoItens[autoSel]) ? autoItens[autoSel] : null);
      } else if (ev.key === 'Escape') fechar();
      else if (ev.key === 'Tab' && !lista.hidden && autoSel >= 0) {
        ev.preventDefault(); escolher(autoSel);
      }
    });

    lista.addEventListener('mousedown', function (ev) {
      var it = ev.target.closest('.auto-item');
      if (it) { ev.preventDefault(); lancar(u, autoItens[Number(it.getAttribute('data-i'))]); }
    });
    inp.addEventListener('blur', function () { setTimeout(fechar, 150); });

    ['in-quant', 'in-tipo'].forEach(function (id) {
      $('#' + id).addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); lancar(u, null); }
      });
    });
    $('#btn-lancar').addEventListener('click', function () { lancar(u, null); });
    inp.focus();
  }

  /**
   * @param {Object} u        unidade amostral
   * @param {Object} escolha  táxon marcado no autocompletar, ou null para
   *                          resolver pelo texto digitado
   */
  function lancar(u, escolha) {
    var inp = $('#in-especie');
    var c = partirConsulta(inp.value);
    var idTaxon = $('#in-taxon-id').value;
    var tipo = $('#in-tipo').value;

    var quant = c.quant;
    if (quant === null) {
      quant = parseFloat(String($('#in-quant').value).replace(',', '.'));
      if (!isFinite(quant) || quant <= 0) quant = 1;
    }

    var t = escolha || (idTaxon ? A.acharTaxon(idTaxon) : null);
    if (!t) {
      if (!c.termo) { toast('Digite a espécie.'); inp.focus(); return; }
      t = A.acharTaxonPorNome(c.termo);
    }
    if (!t) {
      /* Espécie nova: cria o táxon na hora, com o mínimo. A autoecologia
         entra depois, na tela de Táxons — em campo não dá para parar. */
      var pn = M.partirNome(c.termo);
      if (!pn.genero) { toast('Digite a espécie.'); inp.focus(); return; }
      t = A.novoTaxon({
        grupo: grupoDoProjeto(),
        classe: D.grupo(grupoDoProjeto()).classe,
        genero: pn.genero, epiteto: pn.epiteto
      });
      indiceBusca = null;
      toast('Táxon criado: ' + M.nomeCientifico(t) + '. Complete a autoecologia depois.');
    }

    var r = A.novoRegistro(u, { taxonId: t.id, quantidade: quant, tipo: tipo, data: u.data });
    aoLancar(u, r);
  }

  /**
   * Atualiza só o que mudou. Redesenhar a tela inteira custava um ciclo de
   * foco (setTimeout + refocus) em que a primeira letra do próximo nome se
   * perdia — e o custo cresce com o tamanho da tabela.
   */
  function aoLancar(u, r) {
    var mapaTx = A.taxonsPorId();
    var corpo = $('#corpo-registros');
    if (corpo) corpo.insertAdjacentHTML('afterbegin', linhaRegistro(r, mapaTx));
    else { var cx = $('#cx-registros'); if (cx) cx.innerHTML = tabelaRegistros(u, mapaTx); }

    var n = (u.registros || []).length;
    var nota = $('#nota-registros');
    if (nota) nota.textContent = n + ' lançamento' + (n === 1 ? '' : 's');

    var res = M.resumoUnidade(u, metodoDe(u));
    var cab = $('#nota-lancador');
    if (cab) cab.textContent = 'S = ' + fmt(res.indices.S, 0) + ' · N = ' + fmt(res.indices.N, 0);

    var seg = $('#seg-unidade button[data-unidade="' + u.id + '"] span');
    if (seg) seg.textContent = '(' + n + ')';

    var at = $('#atalhos-recentes');
    if (at) at.innerHTML = atalhosHtml(u, mapaTx);

    var inp = $('#in-especie');
    if (inp) { inp.value = ''; inp.focus(); }
    var q = $('#in-quant'); if (q) q.value = 1;
    var lista = $('#auto-lista'); if (lista) { lista.hidden = true; }
    autoSel = -1; autoItens = [];
  }

  /** Atalho das últimas lançadas: um toque = um indivíduo. */
  function lancarAtalho(taxonId) {
    var at = A.ativos();
    if (!at.unidade) return;
    var t = A.acharTaxon(taxonId);
    if (!t) return;
    var tipo = ($('#in-tipo') && $('#in-tipo').value) || tipoPadrao(at.unidade);
    var r = A.novoRegistro(at.unidade, { taxonId: t.id, quantidade: 1, tipo: tipo, data: at.unidade.data });
    aoLancar(at.unidade, r);
  }

  /* =======================================================================
     TELA 5 — TÁXONS E AUTOECOLOGIA
     ==================================================================== */
  /* `grupo` = null significa "ainda não escolhido": cai no grupo do projeto
     aberto. O catálogo é do app inteiro e pode misturar grupos; as colunas
     de autoecologia seguem o grupo escolhido aqui. */
  var filtroTaxon = { texto: '', so: '', grupo: null };

  function grupoDoCatalogo() {
    return filtroTaxon.grupo === null ? grupoDoProjeto() : filtroTaxon.grupo;
  }
  var gbifResultados = {};   // taxonId → { estado, divergencias, resumo }
  var gbifRodando = false, gbifCancelar = false;

  function renderTaxons() {
    var alvo = $('#taxons-conteudo');
    ['btn-csv-taxons', 'btn-gbif-lote'].forEach(function (id) { $('#' + id).disabled = !estado.taxons.length; });

    if (!estado.taxons.length) {
      alvo.innerHTML = vazioHtml('Catálogo vazio',
        'O catálogo se enche sozinho conforme você lança registros — ou de uma vez, importando a planilha. ' +
        'Também dá para cadastrar um táxon à mão.',
        '<button class="btn" data-acao="novo-taxon" type="button">' + icone('ico-mais') + ' Cadastrar táxon</button>');
      return;
    }

    var uso = A.usoDosTaxons();
    var lista = filtrarTaxons();

    var nVerificados = estado.taxons.filter(function (t) { return t.gbif; }).length;
    var nDiverg = estado.taxons.filter(function (t) {
      return t.gbif && t.gbif.estado && t.gbif.estado !== 'confere';
    }).length;

    alvo.innerHTML =
      /* barra da GBIF */
      '<div class="card"><div class="card-titulo"><h2>Conferência taxonômica</h2>' +
      '<span class="card-nota">' + nVerificados + ' de ' + estado.taxons.length + ' verificados na GBIF</span></div>' +
      '<div class="gbif-barra" id="gbif-barra">' +
      '<div class="progresso"><i id="gbif-progresso" style="width:' +
      (estado.taxons.length ? (nVerificados / estado.taxons.length * 100) : 0) + '%"></i></div>' +
      '<span class="progresso-txt" id="gbif-texto">' +
      (nDiverg ? nDiverg + ' divergência' + (nDiverg === 1 ? '' : 's') + ' aguardando decisão' : 'sem divergências pendentes') +
      '</span>' +
      '<button class="btn btn-sec btn-pq" data-acao="gbif-lote" type="button">' + icone('ico-globo') + ' Verificar todos</button>' +
      '</div>' +
      '<p class="card-nota" style="margin-top:var(--e3)">A GBIF <strong>sugere, nunca sobrescreve</strong>. ' +
      'Cada divergência vira um card que você aceita ou recusa — a assinatura do laudo é sua.</p>' +
      divergenciasHtml() +
      '</div>' +

      /* filtros */
      '<div class="card"><div class="card-titulo"><h2>Catálogo</h2>' +
      '<span class="card-nota">' + lista.length + ' de ' + estado.taxons.length + ' táxons</span></div>' +
      '<div class="filtros">' +
      '<div class="campo"><label for="f-texto">Buscar</label>' +
      '<input id="f-texto" type="search" placeholder="Nome científico, comum, família…" value="' + esc(filtroTaxon.texto) + '"></div>' +
      '<div class="campo"><label for="f-grupo">Grupo faunístico</label><select id="f-grupo">' +
      [{ chave: '', rotulo: 'Todos os grupos' }].concat(D.GRUPOS).map(function (g) {
        return '<option value="' + esc(g.chave) + '"' + (grupoDoCatalogo() === g.chave ? ' selected' : '') + '>' + esc(g.rotulo) + '</option>';
      }).join('') + '</select>' +
      '<span class="dica-campo">As colunas de autoecologia são as deste grupo.</span></div>' +
      '<div class="campo"><label for="f-so">Mostrar</label><select id="f-so">' +
      [['', 'Todos'], ['ameacadas', 'Só ameaçadas'], ['endemicas', 'Só endêmicas'],
       ['divergentes', 'Só com divergência na GBIF'], ['naoVerificados', 'Ainda não verificados'],
       ['semRegistro', 'Sem registro em campo'], ['foraCatalogo', 'Fora do catálogo']]
        .map(function (o) { return '<option value="' + o[0] + '"' + (filtroTaxon.so === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div></div>' +
      tabelaTaxons(lista, uso) + '</div>';

    var ft = $('#f-texto');
    if (ft) {
      ft.addEventListener('input', function () { filtroTaxon.texto = ft.value; renderTaxons(); setTimeout(function () { var e = $('#f-texto'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 0); });
    }
    var fs = $('#f-so');
    if (fs) fs.addEventListener('change', function () { filtroTaxon.so = fs.value; renderTaxons(); });
    var fg = $('#f-grupo');
    if (fg) fg.addEventListener('change', function () { filtroTaxon.grupo = fg.value; renderTaxons(); });
  }

  function filtrarTaxons() {
    var q = M.normalizar(filtroTaxon.texto);
    var uso = A.usoDosTaxons();
    var g = grupoDoCatalogo();
    return estado.taxons.filter(function (t) {
      /* Grupo vazio = todos. Táxon sem grupo aparece em qualquer recorte:
         quem foi criado no lançador antes de existir projeto não pode sumir. */
      if (g && t.grupo && t.grupo !== g) return false;
      if (q) {
        var alvo = M.normalizar(M.nomeCientifico(t) + ' ' + t.nomeComum + ' ' + t.familia + ' ' + t.ordem);
        if (alvo.indexOf(q) < 0) return false;
      }
      var a = t.atributos || {};
      switch (filtroTaxon.so) {
        case 'ameacadas': return M.ameacada(t);
        case 'endemicas': return !!a.endemismo;
        case 'divergentes': return !!(t.gbif && t.gbif.estado && t.gbif.estado !== 'confere');
        case 'naoVerificados': return !t.gbif;
        case 'semRegistro': return !uso[t.id];
        case 'foraCatalogo': return !!t.foraDoCatalogo;
        default: return true;
      }
    });
  }

  function tabelaTaxons(lista, uso) {
    if (!lista.length) return '<div class="grafico-vazio">Nenhum táxon com esse filtro.</div>';
    var grupo = grupoDoCatalogo();
    var attrs = D.atributosDoGrupo(grupo);
    return '<div class="tabela-envolve" style="margin-top:var(--e3)"><table class="tabela"><thead><tr>' +
      '<th class="esq">Espécie</th><th class="esq">Nome comum</th>' +
      '<th class="esq">Ordem</th><th class="esq">Família</th>' +
      attrs.map(function (a) { return '<th class="esq">' + esc(a.curto) + '</th>'; }).join('') +
      '<th>Reg.</th><th class="esq">GBIF</th><th></th></tr></thead><tbody>' +
      lista.map(function (t) {
        var a = t.atributos || {};
        var est = t.gbif && t.gbif.estado;
        return '<tr>' +
          '<td class="esq">' + nomeHtml(t, true) +
          (t.foraDoCatalogo ? ' <span class="tag tag-terra">fora do catálogo</span>' : '') + '</td>' +
          '<td class="esq">' + esc(t.nomeComum || '—') + '</td>' +
          '<td class="esq taxon-sup">' + esc(t.ordem || '—') + '</td>' +
          '<td class="esq taxon-sup">' + esc(t.familia || '—') + '</td>' +
          attrs.map(function (at) {
            var v = a[at.chave];
            if (!v) return '<td class="esq" style="color:var(--texto-3)">—</td>';
            var eLista = ['iucn', 'listaNacional', 'listaEstadual'].indexOf(at.chave) >= 0;
            var ameaca = eLista && D.ehAmeaca(v);
            /* sigla de lista vermelha se exibe em maiúscula (VU, EN, CR); os
               demais códigos ficam como o João digitou */
            return '<td class="esq"><span class="tag' + (ameaca ? ' tag-terra' : '') + '">' +
              esc(eLista ? D.siglaAmeaca(v) : v) + '</span></td>';
          }).join('') +
          '<td>' + fmt(uso[t.id] || 0, 0) + '</td>' +
          '<td class="esq">' + (est ? '<span class="estado-gbif ' + esc(est) + '">' + esc(rotuloEstado(est)) + '</span>' : '<span style="color:var(--texto-3)">—</span>') + '</td>' +
          '<td class="acoes-cel">' +
          '<button class="btn btn-fantasma btn-pq" data-acao="gbif-um" data-taxon="' + t.id + '" type="button" title="Verificar na GBIF">' + icone('ico-globo') + '</button>' +
          '<button class="btn btn-fantasma btn-pq" data-acao="editar-taxon" data-taxon="' + t.id + '" type="button" title="Editar">' + icone('ico-lapis') + '</button>' +
          '<button class="btn btn-perigo btn-pq" data-acao="excluir-taxon" data-taxon="' + t.id + '" type="button" title="Excluir">' + icone('ico-lixo') + '</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function rotuloEstado(e) {
    return { confere: 'confere', divergente: 'divergente', naoEncontrado: 'não encontrado', erro: 'sem resposta' }[e] || e;
  }

  /* ------------------------------------------------------- cards de divergência */
  function divergenciasHtml() {
    var pend = [];
    estado.taxons.forEach(function (t) {
      if (!t.gbif || !t.gbif.divergencias) return;
      t.gbif.divergencias.forEach(function (d, i) {
        if (d.decidido) return;
        pend.push({ taxon: t, div: d, i: i });
      });
    });
    if (!pend.length) {
      var algum = estado.taxons.some(function (t) { return t.gbif; });
      if (!algum) return '';
      return '<div style="margin-top:var(--e4)">' + avisoHtml(
        'Nenhuma divergência pendente. Tudo o que a GBIF apontou já foi decidido por você.', 'info') + '</div>';
    }

    return '<div class="grade" style="margin-top:var(--e4)">' + pend.slice(0, 60).map(function (p) {
      var d = p.div;
      return '<div class="div-card tipo-' + esc(d.tipo) + '">' +
        '<div class="div-topo">' + nomeHtml(p.taxon) +
        ' <span class="tag">' + esc(d.rotulo) + '</span>' +
        ' <span class="tag' + (d.tipo === 'digitacao' ? ' tag-terra' : '') + '">' + esc(rotuloTipo(d.tipo)) + '</span></div>' +
        '<div class="div-troca">' +
        '<span class="div-de' + (d.chave === 'nome' ? ' cientifico' : '') + '">' + esc(d.atual || '(em branco)') + '</span>' +
        '<span class="div-seta">→</span>' +
        '<span class="div-para' + (d.chave === 'nome' ? ' cientifico' : '') + '">' + esc(d.sugerido) + '</span>' +
        '</div>' +
        '<div class="div-texto">' + esc(d.texto) + '</div>' +
        '<div class="div-acoes">' +
        '<button class="btn btn-pq" data-acao="div-aceitar" data-taxon="' + p.taxon.id + '" data-i="' + p.i + '" type="button">' + icone('ico-check') + ' Aceitar</button>' +
        '<button class="btn btn-sec btn-pq" data-acao="div-recusar" data-taxon="' + p.taxon.id + '" data-i="' + p.i + '" type="button">' + icone('ico-x') + ' Recusar</button>' +
        '</div></div>';
    }).join('') + '</div>' +
      (pend.length > 60 ? '<p class="card-nota" style="margin-top:var(--e3)">Mostrando 60 de ' + pend.length + ' divergências.</p>' : '');
  }

  function rotuloTipo(t) {
    return {
      digitacao: 'provável erro de digitação', sinonimo: 'sinônimo',
      divergencia: 'divergência entre autores', grafia: 'grafia', rank: 'nível taxonômico',
      faltando: 'campo em branco'
    }[t] || t;
  }

  function aplicarDivergencia(taxonId, i, aceitar) {
    var t = A.acharTaxon(taxonId);
    if (!t || !t.gbif || !t.gbif.divergencias[i]) return;
    var d = t.gbif.divergencias[i];
    if (aceitar) {
      if (d.chave === 'nome') {
        var pn = M.partirNome(d.sugerido);
        /* o nome antigo não se perde: vira o sinônimo registrado */
        t.sinonimoDe = M.nomeCientifico(t);
        t.genero = pn.genero;
        t.epiteto = pn.epiteto;
        t.statusTaxonomico = 'nome aceito segundo a GBIF';
      } else if (d.chave === 'rank') {
        /* nada a aplicar: é informativo */
      } else {
        t[d.chave] = d.sugerido;
      }
    }
    d.decidido = aceitar ? 'aceita' : 'recusada';
    /* se sobrou divergência não decidida, o estado continua divergente */
    var restam = t.gbif.divergencias.filter(function (x) { return !x.decidido && x.tipo !== 'faltando'; });
    if (!restam.length && t.gbif.estado === 'divergente') t.gbif.estado = 'confere';
    A.salvar();
    renderTaxons();
    toast(aceitar ? 'Sugestão aceita.' : 'Sugestão recusada — o dado continua como estava.');
  }

  /* ------------------------------------------------------------ GBIF: chamadas */
  function guardarGbif(t, res, cmp) {
    t.gbif = {
      estado: cmp.estado,
      resumo: cmp.resumo,
      consultadoEm: res.consultadoEm,
      offline: !!res.offline,
      divergencias: cmp.divergencias
    };
    if (res.ok && res.dados && res.dados.usageKey && res.dados.matchType !== 'NONE') {
      if (!t.chaveGbif) t.chaveGbif = String(res.dados.usageKey);
    }
    A.salvar();
  }

  function verificarUm(taxonId) {
    var t = A.acharTaxon(taxonId);
    if (!t) return;
    toast('Consultando a GBIF…');
    B.consultar(M.nomeCientifico(t)).then(function (res) {
      if (!res.ok) {
        toast(res.offline
          ? 'Sem conexão com a GBIF. O app continua funcionando; a verificação fica para depois.'
          : res.erro);
        return;
      }
      guardarGbif(t, res, B.comparar(t, res));
      renderTaxons();
      toast(M.nomeCientifico(t) + ': ' + t.gbif.resumo);
    });
  }

  function verificarLote() {
    if (gbifRodando) { gbifCancelar = true; return; }
    var lista = estado.taxons.slice();
    if (!lista.length) return;
    gbifRodando = true; gbifCancelar = false;

    var barra = $('#gbif-progresso'), txt = $('#gbif-texto');
    var btn = $('[data-acao="gbif-lote"]');
    if (btn) btn.textContent = 'Parar';

    B.verificarLote(lista, function (feito, total, t, res, cmp) {
      guardarGbif(t, res, cmp);
      if (barra) barra.style.width = (feito / total * 100) + '%';
      if (txt) txt.textContent = feito + ' de ' + total + ' — ' + M.nomeCientifico(t);
    }, function () { return gbifCancelar; }).then(function (saida) {
      gbifRodando = false;
      var offline = saida.some(function (x) { return x.resposta.offline; });
      var div = saida.filter(function (x) { return x.comparacao.estado !== 'confere'; }).length;
      renderTaxons();
      if (offline) {
        toast('A rede caiu durante a verificação. O que já foi conferido está salvo; o resto fica para quando houver internet.');
      } else if (gbifCancelar) {
        toast('Verificação interrompida. O que já foi conferido está salvo.');
      } else {
        toast('Verificação concluída: ' + saida.length + ' táxons, ' + div + ' com divergência.');
      }
    }).catch(function (e) {
      gbifRodando = false;
      renderTaxons();
      toast('Falha na verificação: ' + e.message);
    });
  }

  /* --------------------------------------------------------- form de táxon */
  function formTaxon(t) {
    var grupo = (t && t.grupo) || grupoDoProjeto();
    var campos = [
      { chave: 'nomeCientifico', rotulo: 'Nome científico', valor: t ? M.nomeCientifico(t) : '', obrigatorio: true,
        placeholder: 'Tyrannus melancholicus', dica: 'Gênero com inicial maiúscula, epíteto em minúscula. A caixa faz parte da nomenclatura.' },
      { chave: 'nomeComum', rotulo: 'Nome comum', valor: t ? t.nomeComum : '' },
      { chave: 'autor', rotulo: 'Autor', valor: t ? t.autor : '', placeholder: '(Vieillot, 1819)' },
      { chave: 'classe', rotulo: 'Classe', valor: t ? t.classe : D.grupo(grupo).classe },
      { chave: 'ordem', rotulo: 'Ordem', valor: t ? t.ordem : '' },
      { chave: 'familia', rotulo: 'Família', valor: t ? t.familia : '' },
      { chave: 'grupo', rotulo: 'Grupo', tipo: 'select', opcoes: D.GRUPOS, valor: grupo,
        dica: 'O grupo decide quais atributos de autoecologia aparecem abaixo. Salve e reabra para trocar a lista.' },
      { tipo: 'titulo', rotulo: 'Autoecologia — ' + D.grupo(grupo).rotulo }
    ];
    D.atributosDoGrupo(grupo).forEach(function (a) {
      campos.push({
        chave: 'at_' + a.chave, rotulo: a.rotulo, tipo: 'select', opcoes: a.opcoes,
        valor: t ? ((t.atributos || {})[a.chave] || '') : '', dica: a.ajuda
      });
    });
    return campos;
  }

  function extrairTaxon(dados) {
    var saida = { atributos: {} };
    Object.keys(dados).forEach(function (k) {
      if (k.indexOf('at_') === 0) {
        if (dados[k]) saida.atributos[k.slice(3)] = dados[k];
      } else if (k === 'nomeCientifico') {
        var pn = M.partirNome(dados[k]);
        saida.genero = pn.genero;
        saida.epiteto = pn.epiteto;
      } else saida[k] = dados[k];
    });
    return saida;
  }

  /* =======================================================================
     TELA 6 — RESULTADOS
     ==================================================================== */
  var escopo = 'projeto';   // 'projeto' | id da campanha

  function coletar(projeto, escopoAtual) {
    var campanhas = (projeto.campanhas || []).filter(function (c) {
      return escopoAtual === 'projeto' || c.id === escopoAtual;
    });
    var unidades = [];
    campanhas.forEach(function (c) {
      (c.unidades || []).forEach(function (u) { unidades.push({ campanha: c, unidade: u }); });
    });
    var mapas = unidades.map(function (x) { return M.abundanciaPorTaxon(x.unidade.registros); });
    var total = M.somarMapas(mapas);
    return { campanhas: campanhas, unidades: unidades, mapas: mapas, total: total };
  }

  /**
   * Onde cada campanha termina, em indivíduos acumulados. Com N campanhas a
   * curva do coletor é a acumulação de todas em sequência; sem o marco não
   * dá para ver o degrau que cada ida a campo acrescentou.
   */
  function marcosCampanha(dados) {
    var marcos = [], acum = 0, atual = null, ultimo = 0;
    dados.unidades.forEach(function (x, i) {
      if (atual && x.campanha.id !== atual.id) {
        marcos.push({ rotulo: atual.rotulo, individuos: acum });
        ultimo = acum;
      }
      atual = x.campanha;
      acum += M.indices(M.vetor(dados.mapas[i])).N;
    });
    if (atual && marcos.length) marcos.push({ rotulo: atual.rotulo, individuos: acum });
    return marcos.length > 1 ? marcos : [];
  }

  function renderResultados() {
    var at = A.ativos();
    var alvo = $('#resultados-conteudo');
    $('#btn-ir-laudo').disabled = !at.projeto;

    if (!at.projeto) {
      alvo.innerHTML = vazioHtml('Nenhum projeto aberto',
        'Escolha um projeto para ver os índices, os estimadores e a curva do coletor.',
        '<a class="btn" href="#projetos">Ir para Projetos</a>');
      return;
    }

    var p = at.projeto;
    var dados = coletar(p, escopo);
    var mapaTx = A.taxonsPorId();

    if (!Object.keys(dados.total).length) {
      alvo.innerHTML = trilha(1) + seletorEscopo(p) + vazioHtml('Nenhum registro ainda',
        'Os índices são calculados a partir dos registros. Lance os primeiros e volte aqui — ' +
        'nada aqui é colado de fora.',
        '<a class="btn" href="#registros">Ir para Registros</a>');
      return;
    }

    var ni = M.vetor(dados.total);
    var ix = M.indices(ni);
    var est = M.estimadores(dados.mapas);
    var rar = M.rarefacao(ni, 60);
    var acum = M.acumulacao(dados.mapas, dados.unidades.map(function (x) { return x.unidade.codigo; }));
    var inc = M.incidencia(dados.mapas);
    var freq = M.frequenciaOcorrencia(inc, dados.mapas.length);
    var rel = M.abundanciaRelativa(dados.total);

    /* esforço total, só quando todas as unidades usam o mesmo método —
       somar km com armadilha-noite não significa nada. */
    var metodos = {};
    dados.unidades.forEach(function (x) { metodos[x.unidade.metodo] = 1; });
    var umMetodo = Object.keys(metodos).length === 1 ? D.metodo(Object.keys(metodos)[0]) : null;
    var esforcoTotal = null, areaTotal = 0, temArea = false;
    if (umMetodo) {
      esforcoTotal = 0;
      dados.unidades.forEach(function (x) {
        var e = esforcoDe(x.unidade);
        if (e === null) { esforcoTotal = null; return; }
        if (esforcoTotal !== null) esforcoTotal += e;
      });
    }
    dados.unidades.forEach(function (x) {
      var a = metodoDe(x.unidade).area(x.unidade.esforco || {});
      if (a !== null) { areaTotal += a; temArea = true; }
    });

    alvo.innerHTML = trilha(1) + seletorEscopo(p) +

      /* painel de números */
      '<div class="card"><div class="card-titulo"><h2>Números do levantamento</h2>' +
      '<span class="card-nota">' + dados.unidades.length + ' unidade' + (dados.unidades.length === 1 ? '' : 's') +
      ' · ' + dados.campanhas.length + ' campanha' + (dados.campanhas.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="painel-num">' +
      numCx(fmt(ix.S, 0), 'Riqueza (S)') +
      numCx(fmt(ix.N, 0), 'Indivíduos (N)') +
      numCx(fmt(ix.shannon, 3), 'Shannon (H′)') +
      numCx(fmt(ix.pielou, 3), 'Pielou (J′)') +
      numCx(fmt(ix.simpsonDiversidade, 3), 'Simpson (1−D)') +
      numCx(fmt(ix.equitSimpson, 3), 'Equit. Simpson') +
      (esforcoTotal !== null && umMetodo ? numCx(fmt(esforcoTotal, 2), 'Esforço (' + esc(umMetodo.unidade) + ')') : '') +
      (esforcoTotal ? numCx(fmt(M.densidade(ix.N, esforcoTotal), 2), 'ind/' + esc(umMetodo.unidade)) : '') +
      (temArea && areaTotal > 0 ? numCx(fmt(M.densidade(ix.N, areaTotal), 2), 'ind/ha') : '') +
      '</div>' +
      (esforcoTotal === null ? '<div style="margin-top:var(--e4)">' + avisoHtml(
        umMetodo
          ? 'Há unidade sem esforço preenchido — a densidade não pode ser calculada. Complete em <strong>Unidades amostrais</strong>.'
          : 'Este recorte mistura métodos com unidades de esforço diferentes; somar não faria sentido. A densidade aparece por unidade, na tabela abaixo.') + '</div>' : '') +
      '</div>' +

      /* índices por unidade */
      '<div class="card"><div class="card-titulo"><h2>Índices por unidade amostral</h2></div>' +
      tabelaUnidades(dados) + '</div>' +

      /* estimadores */
      '<div class="card"><div class="card-titulo"><h2>Estimadores de riqueza</h2>' +
      '<span class="card-nota">F1 = ' + est.F1 + ' · F2 = ' + est.F2 + ' · Q1 = ' + est.Q1 + ' · Q2 = ' + est.Q2 + ' · m = ' + est.m + '</span></div>' +
      G.graficoEstimadores(est) +
      tabelaEstimadores(est) +
      '<p class="card-nota fonte" style="margin-top:var(--e3)">' + FONTE_IC + '</p>' +
      (est.chao1UsouCorrecao ? '<div style="margin-top:var(--e3)">' + avisoHtml(
        'F2 = 0 (nenhuma espécie com exatamente 2 indivíduos): o Chao 1 clássico dividiria por zero, ' +
        'então foi usada a forma corrigida — e com ela a variância da eq. 7 do EstimateS.') + '</div>' : '') +
      (est.chao2UsouCorrecao ? '<div style="margin-top:var(--e3)">' + avisoHtml(
        'Q2 = 0 (nenhuma espécie em exatamente 2 unidades amostrais): o Chao 2 clássico dividiria por ' +
        'zero, então foi usada a forma corrigida.') + '</div>' : '') +
      '<div style="margin-top:var(--e3)">' + avisoHtml(
        '<strong>O Jackknife 2 sai sem intervalo de confiança.</strong> Não há variância analítica ' +
        'publicada para o jackknife de segunda ordem — a própria documentação do pacote R ' +
        '<code>vegan</code> registra a lacuna. Melhor faltar o intervalo do que inventar a variância.',
        'info') + '</div>' +
      '</div>' +

      /* curva do coletor */
      '<div class="card"><div class="card-titulo"><h2>Curva do coletor</h2>' +
      '<span class="card-nota">rarefação por indivíduos (Mao Tau)</span></div>' +
      G.curvaColetor(rar, acum, { marcos: marcosCampanha(dados), coleman: M.curvaColeman(ni, rar.map(function (x) { return x.n; })) }) +
      '<p class="card-nota" style="margin-top:var(--e3)">A curva estabilizando indica esforço suficiente. ' +
      'Se ela ainda sobe no fim, faltou amostragem — e os estimadores acima vão confirmar.</p>' +
      '<p class="card-nota fonte">Rarefação por indivíduos (Mao Tau), com IC 95 % por reamostragem ' +
      'bootstrap (200 repetições, semente fixa — o mesmo dado devolve sempre o mesmo intervalo). ' +
      'A tracejada cinza é a curva de Coleman, E(s*) = Σ [1 − (1 − n* ÷ N)^n<sub>i</sub>] — ' +
      'GOTELLI &amp; COLWELL 2011, <i>Biological Diversity: Frontiers in Measurement and Assessment</i>, ' +
      'cap. 4, eq. (4.1) — que aproxima a rarefação e fica sempre um pouco abaixo dela.</p></div>' +

      /* composição */
      '<div class="card"><div class="card-titulo"><h2>Composição por ordem</h2></div>' +
      G.barrasComposicao(M.composicao(dados.total, mapaTx, function (t) { return t.ordem; }), { campo: 'especies' }) + '</div>' +

      '<div class="card"><div class="card-titulo"><h2>Composição por família</h2></div>' +
      G.barrasComposicao(M.composicao(dados.total, mapaTx, function (t) { return t.familia; }), { campo: 'especies' }) + '</div>' +

      /* As roscas de autoecologia NÃO são uma lista fixa: são os atributos
         do grupo do projeto. Em avifauna saem guilda, hábitat, dependência
         de mata e sensibilidade; em mastofauna saem guilda, hábitat, hábito,
         período de atividade e porte. Nenhuma linha aqui sabe disso. */
      roscasAutoecologia(dados, mapaTx, p.grupo) +

      /* riqueza e abundância por unidade */
      '<div class="card"><div class="card-titulo"><h2>Riqueza e abundância por unidade</h2></div>' +
      G.barrasUnidades(dados.unidades.map(function (x, i) {
        var iu = M.indices(M.vetor(dados.mapas[i]));
        return { rotulo: x.unidade.codigo, riqueza: iu.S, individuos: iu.N };
      })) + '</div>' +

      /* espécies de interesse */
      cardInteresse(dados, mapaTx, p.grupo) +

      /* lista de espécies */
      '<div class="card"><div class="card-titulo"><h2>Espécies registradas</h2>' +
      '<span class="card-nota">abundância relativa e frequência de ocorrência</span></div>' +
      tabelaEspecies(dados.total, mapaTx, rel, freq, inc, p.grupo) + '</div>' +

      /* comparações */
      cardComparacoes(p, mapaTx);

    var sel = $('#sel-escopo');
    if (sel) sel.addEventListener('change', function () { escopo = sel.value; renderResultados(); });
  }

  /**
   * Roscas de composição por autoecologia, montadas a partir do catálogo do
   * grupo. Atributo sem nenhum valor preenchido é omitido — uma rosca com
   * 100 % em "—" não informa nada.
   */
  function roscasAutoecologia(dados, mapaTx, grupo) {
    var ids = Object.keys(dados.total);
    var cards = D.atributosGrafico(grupo).map(function (a) {
      var preenchidos = ids.filter(function (id) {
        var t = mapaTx[id];
        return t && (t.atributos || {})[a.chave];
      }).length;
      if (!preenchidos) return '';
      var comp = M.composicao(dados.total, mapaTx, function (t) {
        return D.rotuloAtributo(a.chave, (t.atributos || {})[a.chave], grupo);
      });
      return '<div class="card"><div class="card-titulo"><h2>' + esc(a.rotulo) + '</h2>' +
        '<span class="card-nota">' + preenchidos + ' de ' + ids.length + ' espécies preenchidas</span></div>' +
        G.rosca(comp, { campo: 'especies' }) + '</div>';
    }).filter(Boolean);
    if (!cards.length) {
      return '<div class="card"><div class="card-titulo"><h2>Composição por autoecologia</h2></div>' +
        '<div class="grafico-vazio">Nenhum atributo de autoecologia preenchido para as espécies deste recorte. ' +
        'Preencha em <strong>Táxons</strong> — os atributos oferecidos são os do grupo ' +
        esc(D.grupo(grupo).rotulo) + '.</div></div>';
    }
    return '<div class="grade grade-2">' + cards.join('') + '</div>';
  }

  function seletorEscopo(p) {
    if (p.campanhas.length < 2) return '';
    return '<div class="card"><div class="grade grade-2"><div class="campo">' +
      '<label for="sel-escopo">Recorte</label><select id="sel-escopo">' +
      '<option value="projeto"' + (escopo === 'projeto' ? ' selected' : '') + '>Projeto inteiro (todas as campanhas)</option>' +
      p.campanhas.map(function (c) {
        return '<option value="' + c.id + '"' + (escopo === c.id ? ' selected' : '') + '>' + esc(c.rotulo) +
          (c.sazonalidade ? ' — ' + esc(c.sazonalidade) : '') + '</option>';
      }).join('') + '</select></div></div></div>';
  }

  function numCx(valor, rotulo, ic, terra) {
    return '<div class="num-cx' + (terra ? ' terra' : '') + '"><b>' + valor + '</b><small>' + rotulo + '</small>' +
      (ic ? '<span class="ic">' + ic + '</span>' : '') + '</div>';
  }

  function tabelaUnidades(dados) {
    return '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
      '<th class="esq">Unidade</th><th class="esq">Método</th><th class="esq">Campanha</th>' +
      '<th>Esforço</th><th>S</th><th>N</th><th>D</th><th>1−D</th><th>1/D</th>' +
      '<th>Equit. Simpson</th><th>H′</th><th>J′</th><th>Densidade</th></tr></thead><tbody>' +
      dados.unidades.map(function (x, i) {
        var met = metodoDe(x.unidade);
        var iu = M.indices(M.vetor(dados.mapas[i]));
        var e = esforcoDe(x.unidade);
        var dens = M.densidade(iu.N, e);
        return '<tr>' +
          '<td class="esq">' + esc(x.unidade.codigo) + '</td>' +
          '<td class="esq">' + esc(met.rotulo) + '</td>' +
          '<td class="esq">' + esc(x.campanha.rotulo) + '</td>' +
          '<td>' + (e === null ? '<span class="tag tag-terra">—</span>' : fmt(e, 2) + ' ' + esc(met.unidade)) + '</td>' +
          '<td>' + fmt(iu.S, 0) + '</td><td>' + fmt(iu.N, 0) + '</td>' +
          '<td>' + fmt(iu.simpsonD, 4) + '</td>' +
          '<td>' + fmt(iu.simpsonDiversidade, 4) + '</td>' +
          '<td>' + fmt(iu.simpsonReciproco, 2) + '</td>' +
          '<td>' + fmt(iu.equitSimpson, 3) + '</td>' +
          '<td>' + fmt(iu.shannon, 4) + '</td>' +
          '<td>' + fmt(iu.pielou, 4) + '</td>' +
          '<td>' + (dens === null ? '—' : fmt(dens, 2) + ' ind/' + esc(met.unidade)) + '</td></tr>';
      }).join('') +
      (function () {
        var ixt = M.indices(M.vetor(dados.total));
        return '<tr class="linha-total"><td class="esq">Total</td><td class="esq">—</td><td class="esq">—</td><td>—</td>' +
          '<td>' + fmt(ixt.S, 0) + '</td><td>' + fmt(ixt.N, 0) + '</td>' +
          '<td>' + fmt(ixt.simpsonD, 4) + '</td><td>' + fmt(ixt.simpsonDiversidade, 4) + '</td>' +
          '<td>' + fmt(ixt.simpsonReciproco, 2) + '</td><td>' + fmt(ixt.equitSimpson, 3) + '</td>' +
          '<td>' + fmt(ixt.shannon, 4) + '</td><td>' + fmt(ixt.pielou, 4) + '</td><td>—</td></tr>';
      })() +
      '</tbody></table></div>';
  }

  /* A FONTE de cada fórmula. É isto que torna o número defensável perante o
     órgão ambiental — mais do que coincidir com o EstimateS. Aparece na tela
     de Resultados e nas notas metodológicas do laudo. */
  var FONTE_IC =
    'IC 95 % pelo <strong>intervalo log-normal de Chao</strong>: ' +
    'K = exp(1,96 · √(ln(1 + V̂ ÷ (Ŝ − S<sub>obs</sub>)²))), ' +
    'IC = [S<sub>obs</sub> + (Ŝ − S<sub>obs</sub>) ÷ K ; S<sub>obs</sub> + (Ŝ − S<sub>obs</sub>) · K] — ' +
    'CHAO, A. 1987, <i>Biometrics</i> 43:783–791, eqs. (11)–(12). É o intervalo do EstimateS, ' +
    'e por construção nunca exclui a estimativa pontual. ' +
    'Variâncias analíticas: <strong>Chao 1</strong>, Chao (1987), p. 786; ' +
    '<strong>Chao 1 e Chao 2 corrigidos</strong>, EstimateS 9.1.0 User’s Guide, Appendix B, eqs. 6 e 7; ' +
    '<strong>Chao 2</strong>, CHAO &amp; COLWELL 2017, <i>SORT</i> 41(1):3–54, eq. (3a); ' +
    '<strong>Jackknife 1</strong>, HELTSHE &amp; FORRESTER 1983, <i>Biometrics</i> 39:1–11 ' +
    '(eq. 12 de COLWELL &amp; CODDINGTON 1994); ' +
    '<strong>Bootstrap</strong>, SMITH &amp; VAN BELLE 1984, <i>Biometrics</i> 40:119–129.';

  var FONTE_IC_TEXTO =
    'Intervalos de confiança de 95 % pelo intervalo log-normal de Chao (CHAO, A. 1987, ' +
    'Biometrics 43:783–791, eqs. 11–12), com as variâncias analíticas de cada estimador: ' +
    'Chao 1 de Chao (1987, p. 786); Chao 1 e Chao 2 corrigidos do EstimateS 9.1.0 User’s Guide, ' +
    'Appendix B, eqs. 6 e 7; Chao 2 de Chao & Colwell (2017, SORT 41(1):3–54, eq. 3a); ' +
    'Jackknife 1 de Heltshe & Forrester (1983, Biometrics 39:1–11), na forma reimpressa por ' +
    'Colwell & Coddington (1994, eq. 12); Bootstrap de Smith & van Belle (1984, Biometrics ' +
    '40:119–129). O Jackknife 2 é apresentado sem intervalo de confiança, por não haver ' +
    'variância analítica publicada para o jackknife de segunda ordem. A curva de rarefação ' +
    'acompanha intervalo por reamostragem bootstrap (200 repetições, semente fixa).';

  function tabelaEstimadores(est) {
    var linhas = [
      ['Riqueza observada (S)', est.S, null, 'o que foi realmente registrado', est.semIC.S],
      ['Chao 1', est.chao1, est.ic.chao1,
        est.chao1UsouCorrecao ? 'forma corrigida (F2 = 0)' : 'S + F1² ÷ (2·F2)', est.semIC.chao1],
      ['Chao 1 corrigido', est.chao1Corrigido, est.ic.chao1Corrigido, 'S + F1(F1−1) ÷ (2(F2+1))', null],
      ['Chao 2', est.chao2, est.ic.chao2,
        est.chao2UsouCorrecao ? 'forma corrigida (Q2 = 0)' : 'S + Q1² ÷ (2·Q2)', est.semIC.chao2],
      ['Chao 2 corrigido', est.chao2Corrigido, est.ic.chao2Corrigido, 'S + ((m−1)÷m)·Q1(Q1−1) ÷ (2(Q2+1))', null],
      ['Jackknife 1', est.jack1, est.ic.jack1, 'S + Q1·(m−1)÷m', est.semIC.jack1],
      ['Jackknife 2', est.jack2, null, 'S + Q1(2m−3)÷m − Q2(m−2)² ÷ (m(m−1))', est.semIC.jack2],
      ['Bootstrap', est.bootstrap, est.ic.bootstrap, 'S + Σ (1 − pk)^m', est.semIC.bootstrap]
    ];
    return '<div class="tabela-envolve" style="margin-top:var(--e4)"><table class="tabela"><thead><tr>' +
      '<th class="esq">Estimador</th><th>Estimativa</th><th>IC 95 % inferior</th><th>IC 95 % superior</th>' +
      '<th>% registrado</th><th class="esq">Observação</th></tr></thead><tbody>' +
      linhas.map(function (l) {
        var razao = (l[1] && est.S) ? est.S / l[1] : null;
        /* Sem IC a célula diz "sem IC", e o motivo inteiro vai para a coluna
           de observação, que já é a coluna de texto. Escrever o motivo
           dentro da célula do intervalo esticava a tabela e empurrava a
           coluna do limite superior para fora do quadro. */
        var obs = l[3] + (!l[2] && l[4] ? ' · sem IC: ' + l[4] : '');
        return '<tr><td class="esq">' + esc(l[0]) + '</td>' +
          '<td>' + fmt(l[1], 1) + '</td>' +
          (l[2]
            ? '<td>' + fmt(l[2][0], 1) + '</td><td>' + fmt(l[2][1], 1) + '</td>'
            : '<td colspan="2" class="sem-ic">' + (l[4] ? 'sem IC' : '—') + '</td>') +
          '<td>' + (razao === null ? '—' : pct(razao, 1)) + '</td>' +
          '<td class="esq quebra" style="color:var(--texto-2)">' + esc(obs) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function tabelaEspecies(mapa, mapaTx, rel, freq, inc, grupo) {
    var ids = Object.keys(mapa).sort(function (a, b) {
      return mapa[b] - mapa[a] ||
        String(M.nomeCientifico(mapaTx[a] || {})).localeCompare(String(M.nomeCientifico(mapaTx[b] || {})), 'pt-BR');
    });
    if (!ids.length) return '<div class="grafico-vazio">Nenhuma espécie registrada.</div>';
    return '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
      '<th class="esq">Espécie</th><th class="esq">Nome comum</th><th class="esq">Ordem</th><th class="esq">Família</th>' +
      '<th>ni</th><th>Abund. relativa</th><th>Unidades</th><th>Freq. ocorrência</th>' +
      '<th class="esq">Guilda</th><th class="esq">Status</th></tr></thead><tbody>' +
      ids.map(function (id) {
        var t = mapaTx[id] || {};
        var a = t.atributos || {};
        var status = ['iucn', 'listaNacional', 'listaEstadual'].map(function (k) {
          if (!D.ehAmeaca(a[k])) return '';
          return '<span class="tag tag-terra">' + esc(D.atributo(k).curto + ' ' + D.siglaAmeaca(a[k])) + '</span>';
        }).filter(Boolean).join(' ');
        return '<tr><td class="esq">' + nomeHtml(t) + '</td>' +
          '<td class="esq">' + esc(t.nomeComum || '—') + '</td>' +
          '<td class="esq taxon-sup">' + esc(t.ordem || '—') + '</td>' +
          '<td class="esq taxon-sup">' + esc(t.familia || '—') + '</td>' +
          '<td>' + fmt(mapa[id], 0) + '</td>' +
          '<td>' + pct(rel[id], 2) + '</td>' +
          '<td>' + fmt(inc[id] || 0, 0) + '</td>' +
          '<td>' + pct(freq[id], 1) + '</td>' +
          '<td class="esq">' + esc(D.rotuloAtributo('dieta', a.dieta, grupo)) + '</td>' +
          '<td class="esq">' + (status || '<span style="color:var(--texto-3)">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /** Os atributos que são PRÓPRIOS deste grupo (não os de 'todos'). */
  function attrsProprios(grupo) {
    return D.atributosDoGrupo(grupo).filter(function (a) { return a.grupo === grupo; });
  }

  function cardInteresse(dados, mapaTx, grupo) {
    var registrados = Object.keys(dados.total).map(function (id) { return mapaTx[id]; }).filter(Boolean);
    var i = M.especiesDeInteresse(registrados);
    var proprios = attrsProprios(grupo);
    var blocos = [
      ['Ameaçadas', i.ameacadas, true],
      ['Endêmicas', i.endemicas, false],
      ['Migratórias', i.migratorias, false],
      ['Cinegéticas', i.cinegeticas, false],
      ['Exóticas', i.exoticas, true]
    ];
    var total = blocos.reduce(function (a, b) { return a + b[1].length; }, 0);

    return '<div class="card"><div class="card-titulo"><h2>Espécies de interesse</h2>' +
      '<span class="card-nota">' + total + ' ocorrência' + (total === 1 ? '' : 's') + ' entre as ' + registrados.length + ' registradas</span></div>' +
      '<div class="painel-num" style="margin-bottom:var(--e4)">' +
      numCx(fmt(i.ameacadasNacional.length, 0), 'Portaria MMA', '', i.ameacadasNacional.length > 0) +
      numCx(fmt(i.ameacadasEstadual.length, 0), 'Lista estadual', '', i.ameacadasEstadual.length > 0) +
      numCx(fmt(i.ameacadasIucn.length, 0), 'IUCN (referência)') +
      numCx(fmt(i.endemicas.length, 0), 'Endêmicas') +
      numCx(fmt(i.migratorias.length, 0), 'Migratórias') +
      numCx(fmt(i.cinegeticas.length, 0), 'Cinegéticas') +
      numCx(fmt(i.exoticas.length, 0), 'Exóticas', '', i.exoticas.length > 0) +
      '</div>' +
      (total ? blocos.filter(function (b) { return b[1].length; }).map(function (b) {
        return '<h3 style="margin-top:var(--e4);margin-bottom:var(--e2)">' + esc(b[0]) + '</h3>' +
          '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
          '<th class="esq">Espécie</th><th class="esq">Nome comum</th><th class="esq">Família</th>' +
          '<th class="esq">IUCN</th><th class="esq">MMA</th><th class="esq">Estadual</th>' +
          '<th class="esq">Endemismo</th>' +
          proprios.map(function (a) { return '<th class="esq">' + esc(a.rotulo) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          b[1].map(function (t) {
            var a = t.atributos || {};
            return '<tr><td class="esq">' + nomeHtml(t) + '</td>' +
              '<td class="esq">' + esc(t.nomeComum || '—') + '</td>' +
              '<td class="esq taxon-sup">' + esc(t.familia || '—') + '</td>' +
              '<td class="esq">' + esc(D.siglaAmeaca(a.iucn) || '—') + '</td>' +
              '<td class="esq">' + esc(D.siglaAmeaca(a.listaNacional) || '—') + '</td>' +
              '<td class="esq">' + esc(D.siglaAmeaca(a.listaEstadual) || '—') + '</td>' +
              '<td class="esq">' + esc(a.endemismo || '—') + '</td>' +
              proprios.map(function (at) {
                return '<td class="esq">' + esc(D.rotuloAtributo(at.chave, a[at.chave], grupo)) + '</td>';
              }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>';
      }).join('') : '<div class="grafico-vazio">Nenhuma espécie ameaçada, endêmica, migratória, cinegética ou exótica entre as registradas.</div>') +
      '<div style="margin-top:var(--e4)" class="avisos-pilha">' +
      D.AVISOS_LEGAIS.map(function (a) { return avisoHtml(esc(a)); }).join('') + '</div>' +
      '</div>';
  }

  function cardComparacoes(p, mapaTx) {
    var h = '';

    /* Entre campanhas — TODAS, não as duas primeiras. A planilha do João tem
       30 abas justamente porque assume duas; era o que este trecho repetia. */
    var comReg = p.campanhas.filter(function (c) {
      return c.unidades.some(function (u) { return (u.registros || []).length; });
    });
    if (comReg.length >= 2) h += cardCampanhas(comReg, mapaTx);

    /* primários × secundários */
    var sec = (p.secundarios && p.secundarios.especies) || [];
    var prim = [];
    p.campanhas.forEach(function (c) {
      c.unidades.forEach(function (u) {
        (u.registros || []).forEach(function (r) {
          var t = mapaTx[r.taxonId];
          if (t) prim.push(M.nomeCientifico(t));
        });
      });
    });
    var titulo = (p.secundarios && p.secundarios.titulo) || '';
    h += '<div class="card"><div class="card-titulo"><h2>Dados primários × secundários</h2>' +
      '<button class="btn btn-sec btn-pq" data-acao="editar-secundarios" type="button">' + icone('ico-lapis') + ' Editar lista</button></div>' +
      (titulo ? '<p class="card-nota" style="margin-bottom:var(--e3)">Fonte secundária: <strong>' + esc(titulo) + '</strong>' +
        ((p.secundarios.autores) ? ' — ' + esc(p.secundarios.autores) : '') + '</p>' : '') +
      (sec.length
        ? (function () {
            var cmp2 = M.comparar(prim, sec);
            return G.barraComparacao(cmp2, 'primários', 'secundários') + listaExclusivas(cmp2, 'primários', 'secundários');
          })()
        : '<div class="grafico-vazio">Nenhuma lista de dados secundários cadastrada. ' +
          'Clique em <strong>Editar lista</strong> e cole os nomes científicos do levantamento de literatura, um por linha.</div>') +
      '</div>';

    return h;
  }

  /**
   * Comparação entre N campanhas: tabela com uma coluna por campanha,
   * barras com o que é exclusivo de cada uma, matriz de presença, Jaccard
   * par a par, e as espécies presentes em todas.
   */
  function cardCampanhas(camps, mapaTx) {
    var listas = camps.map(function (c) {
      return { rotulo: c.rotulo, nomes: nomesDaCampanha(c, mapaTx) };
    });
    var cmp = M.compararN(listas);

    /* números por campanha, incluindo esforço na unidade do próprio método */
    var linhas = camps.map(function (c, i) {
      var mapas = c.unidades.map(function (u) { return M.abundanciaPorTaxon(u.registros); });
      var ix = M.indices(M.vetor(M.somarMapas(mapas)));
      var porMet = {};
      c.unidades.forEach(function (u) {
        var met = metodoDe(u), e = esforcoDe(u);
        if (e === null) return;
        porMet[met.unidade] = (porMet[met.unidade] || 0) + e;
      });
      var esf = Object.keys(porMet).map(function (k) { return fmt(porMet[k], 2) + ' ' + k; }).join(' · ') || '—';
      return { c: c, ix: ix, esforco: esf, pl: cmp.porLista[i], nUnid: c.unidades.length };
    });

    var h = '<div class="card"><div class="card-titulo"><h2>Comparação entre campanhas</h2>' +
      '<span class="card-nota">' + camps.length + ' campanhas com registro</span></div>' +

      '<div class="tabela-envolve"><table class="tabela"><thead><tr><th class="esq">&nbsp;</th>' +
      linhas.map(function (l) {
        return '<th>' + esc(l.c.rotulo) + (l.c.sazonalidade ? '<br><span style="font-weight:500;opacity:.75">' +
          esc(l.c.sazonalidade) + '</span>' : '') + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      [['Período', function (l) { return dataBR(l.c.dataInicio) + ' a ' + dataBR(l.c.dataFim); }],
       ['Unidades amostrais', function (l) { return fmt(l.nUnid, 0); }],
       ['Esforço', function (l) { return l.esforco; }],
       ['Riqueza (S)', function (l) { return fmt(l.ix.S, 0); }],
       ['Indivíduos (N)', function (l) { return fmt(l.ix.N, 0); }],
       ['Shannon (H′)', function (l) { return fmt(l.ix.shannon, 3); }],
       ['Pielou (J′)', function (l) { return fmt(l.ix.pielou, 3); }],
       ['Simpson (1−D)', function (l) { return fmt(l.ix.simpsonDiversidade, 3); }],
       ['Exclusivas da campanha', function (l) { return fmt(l.pl.exclusivas.length, 0); }]
      ].map(function (par) {
        return '<tr><td class="esq">' + esc(par[0]) + '</td>' +
          linhas.map(function (l) { return '<td>' + par[1](l) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +

      '<div style="margin-top:var(--e4)">' + G.barrasComparacaoN(cmp) + '</div>';

    /* Jaccard par a par */
    if (camps.length >= 2) {
      h += '<h3 style="margin-top:var(--e4);margin-bottom:var(--e2)">Similaridade de Jaccard entre campanhas</h3>' +
        '<div class="tabela-envolve"><table class="tabela"><thead><tr><th class="esq">&nbsp;</th>' +
        cmp.rotulos.map(function (r) { return '<th>' + esc(r) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        cmp.rotulos.map(function (r, i) {
          return '<tr><td class="esq">' + esc(r) + '</td>' +
            cmp.jaccard[i].map(function (v) {
              return '<td>' + (v === null ? '<span style="color:var(--texto-3)">—</span>' : pct(v, 1)) + '</td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    /* exclusivas de cada campanha + comuns a todas */
    h += '<div class="grade grade-2" style="margin-top:var(--e4)">' +
      cmp.porLista.map(function (pl) {
        return blocoEspecies('Só em ' + pl.rotulo, pl.exclusivas);
      }).join('') +
      blocoEspecies('Em todas as ' + camps.length + ' campanhas', cmp.comunsTodas) +
      '</div>';

    /* matriz de presença — quem apareceu em quais campanhas */
    h += '<h3 style="margin-top:var(--e4);margin-bottom:var(--e2)">Presença por campanha</h3>' +
      '<div class="tabela-envolve"><table class="tabela"><thead><tr><th class="esq">Espécie</th>' +
      cmp.rotulos.map(function (r) { return '<th>' + esc(r) + '</th>'; }).join('') +
      '<th>Campanhas</th></tr></thead><tbody>' +
      cmp.matriz.slice().sort(function (a, b) {
        return b.quantas - a.quantas || a.nome.localeCompare(b.nome, 'pt-BR');
      }).map(function (m) {
        return '<tr><td class="esq"><i class="cientifico">' + esc(m.nome) + '</i></td>' +
          m.presenca.map(function (v) {
            return '<td>' + (v ? '<span class="tag tag-verde">•</span>' : '<span style="color:var(--texto-3)">—</span>') + '</td>';
          }).join('') + '<td>' + m.quantas + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    return h;
  }

  function blocoEspecies(titulo, lista) {
    if (!lista || !lista.length) return '';
    return '<div><h3 style="margin-top:var(--e3);margin-bottom:var(--e2)">' + esc(titulo) + ' (' + lista.length + ')</h3>' +
      '<p style="line-height:1.9">' + lista.map(function (n) {
        return '<i class="cientifico">' + esc(n) + '</i>';
      }).join(' <span style="color:var(--texto-3)">·</span> ') + '</p></div>';
  }

  function nomesDaCampanha(c, mapaTx) {
    var out = [];
    (c.unidades || []).forEach(function (u) {
      (u.registros || []).forEach(function (r) {
        var t = mapaTx[r.taxonId];
        if (t) out.push(M.nomeCientifico(t));
      });
    });
    return out;
  }

  function listaExclusivas(cmp, ra, rb) {
    function bloco(titulo, lista) {
      if (!lista.length) return '';
      return '<div><h3 style="margin-top:var(--e4);margin-bottom:var(--e2)">' + esc(titulo) + ' (' + lista.length + ')</h3>' +
        '<p style="line-height:1.9">' + lista.map(function (n) {
          return '<i class="cientifico">' + esc(n) + '</i>';
        }).join(' <span style="color:var(--texto-3)">·</span> ') + '</p></div>';
    }
    return '<div class="grade grade-2" style="margin-top:var(--e3)">' +
      bloco('Só em ' + ra, cmp.exclusivasA) +
      bloco('Só em ' + rb, cmp.exclusivasB) +
      bloco('Em comum', cmp.comuns) + '</div>';
  }

  /* =======================================================================
     TELA 7 — LAUDO
     ==================================================================== */
  function renderLaudo() {
    var at = A.ativos();
    var alvo = $('#laudo-conteudo');
    if (!at.projeto) {
      alvo.innerHTML = vazioHtml('Nenhum projeto aberto',
        'Escolha um projeto para gerar o laudo.',
        '<a class="btn" href="#projetos">Ir para Projetos</a>');
      return;
    }

    var p = at.projeto;
    var dados = coletar(p, 'projeto');
    var mapaTx = A.taxonsPorId();
    var ni = M.vetor(dados.total);
    var ix = M.indices(ni);

    if (!ni.length) {
      alvo.innerHTML = vazioHtml('Nenhum registro para relatar',
        'O laudo é montado a partir dos registros. Lance os primeiros e volte aqui.',
        '<a class="btn" href="#registros">Ir para Registros</a>');
      return;
    }

    var est = M.estimadores(dados.mapas);
    var rar = M.rarefacao(ni, 40);
    var acum = M.acumulacao(dados.mapas, dados.unidades.map(function (x) { return x.unidade.codigo; }));
    var inc = M.incidencia(dados.mapas);
    var freq = M.frequenciaOcorrencia(inc, dados.mapas.length);
    var rel = M.abundanciaRelativa(dados.total);
    var registrados = Object.keys(dados.total).map(function (id) { return mapaTx[id]; }).filter(Boolean);
    var interesse = M.especiesDeInteresse(registrados);
    var hoje = new Date().toLocaleDateString('pt-BR');

    var nFam = {}, nOrd = {};
    registrados.forEach(function (t) { if (t.familia) nFam[t.familia] = 1; if (t.ordem) nOrd[t.ordem] = 1; });

    alvo.innerHTML = '<div class="folha">' +
      '<div class="folha-topo">' +
      '<svg><use href="#ico-logo"></use></svg>' +
      '<div class="folha-marca"><h1>Seara Biologia</h1><p>Levantamento de fauna</p></div>' +
      '<div class="folha-data">Emitido em<br><strong>' + esc(hoje) + '</strong></div>' +
      '</div>' +

      '<section><h2>Identificação</h2><div class="ficha">' +
      ficha('Empreendimento', p.nome) + ficha('Cliente', p.cliente) +
      ficha('Município', (p.municipio || '—') + (p.uf ? ' / ' + p.uf : '')) +
      ficha('Órgão licenciador', p.orgao) + ficha('Processo', p.processo) +
      ficha('Grupo faunístico', (D.GRUPOS.filter(function (g) { return g.chave === p.grupo; })[0] || {}).rotulo) +
      ficha('Responsável técnico', p.responsavel) + ficha('Registro profissional', p.registroProfissional) +
      '</div></section>' +

      '<section><h2>Esforço amostral</h2>' +
      '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
      '<th class="esq">Campanha</th><th class="esq">Sazonalidade</th><th class="esq">Período</th>' +
      '<th>Unidades</th><th class="esq">Métodos</th><th>Esforço</th></tr></thead><tbody>' +
      p.campanhas.map(function (c) {
        var mets = {};
        c.unidades.forEach(function (u) { mets[metodoDe(u).rotulo] = 1; });
        var porMet = {};
        c.unidades.forEach(function (u) {
          var met = metodoDe(u), e = esforcoDe(u);
          if (e === null) return;
          porMet[met.unidade] = (porMet[met.unidade] || 0) + e;
        });
        var txt = Object.keys(porMet).map(function (k) { return fmt(porMet[k], 2) + ' ' + k; }).join(' · ') || '—';
        return '<tr><td class="esq">' + esc(c.rotulo) + '</td>' +
          '<td class="esq">' + esc(c.sazonalidade || '—') + '</td>' +
          '<td class="esq">' + dataBR(c.dataInicio) + ' a ' + dataBR(c.dataFim) + '</td>' +
          '<td>' + c.unidades.length + '</td>' +
          '<td class="esq">' + esc(Object.keys(mets).join(', ') || '—') + '</td>' +
          '<td>' + txt + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="tabela-envolve" style="margin-top:var(--e3)"><table class="tabela"><thead><tr>' +
      '<th class="esq">Unidade</th><th class="esq">Método</th><th class="esq">Área de infl.</th>' +
      '<th class="esq">Fitofisionomia</th><th class="esq">Coordenadas</th><th class="esq">Data</th><th>Esforço</th>' +
      '<th>S</th><th>N</th></tr></thead><tbody>' +
      dados.unidades.map(function (x, i) {
        var u = x.unidade, met = metodoDe(u);
        var iu = M.indices(M.vetor(dados.mapas[i]));
        return '<tr><td class="esq">' + esc(u.codigo) + '</td>' +
          '<td class="esq">' + esc(met.rotulo) + '</td>' +
          '<td class="esq">' + esc(u.areaInfluencia || '—') + '</td>' +
          '<td class="esq">' + esc(u.fitofisionomia || '—') + '</td>' +
          '<td class="esq">' + esc((u.latitude || '—') + ', ' + (u.longitude || '—')) + '</td>' +
          '<td class="esq">' + dataBR(u.data) + '</td>' +
          '<td>' + esc(esforcoTexto(u)) + '</td>' +
          '<td>' + fmt(iu.S, 0) + '</td><td>' + fmt(iu.N, 0) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +

      '<section><h2>Resultados gerais</h2>' +
      '<div class="painel-num">' +
      numCx(fmt(ix.S, 0), 'Espécies (S)') +
      numCx(fmt(ix.N, 0), 'Indivíduos (N)') +
      numCx(fmt(Object.keys(nFam).length, 0), 'Famílias') +
      numCx(fmt(Object.keys(nOrd).length, 0), 'Ordens') +
      numCx(fmt(ix.shannon, 3), 'Shannon (H′)') +
      numCx(fmt(ix.pielou, 3), 'Pielou (J′)') +
      numCx(fmt(ix.simpsonDiversidade, 3), 'Simpson (1−D)') +
      numCx(fmt(ix.equitSimpson, 3), 'Equit. Simpson') +
      '</div></section>' +

      '<section><h2>Estimadores de riqueza</h2>' +
      tabelaEstimadores(est) +
      '<p class="card-nota fonte" style="margin-top:8px;font-size:.72rem">' + FONTE_IC + '</p></section>' +

      '<section><h2>Curva do coletor</h2>' + G.curvaColetor(rar, acum, { marcos: marcosCampanha(dados), coleman: M.curvaColeman(ni, rar.map(function (x) { return x.n; })) }) + '</section>' +

      '<section><h2>Composição por família</h2>' +
      G.barrasComposicao(M.composicao(dados.total, mapaTx, function (t) { return t.familia; }), { campo: 'especies', limite: 12 }) +
      '</section>' +

      '<section><h2>Guilda trófica</h2>' +
      G.rosca(M.composicao(dados.total, mapaTx, function (t) { return D.rotuloAtributo('dieta', (t.atributos || {}).dieta); }), { campo: 'especies' }) +
      '</section>' +

      '<section><h2>Espécies de interesse</h2>' +
      (interesse.ameacadas.length || interesse.endemicas.length || interesse.migratorias.length ||
       interesse.cinegeticas.length || interesse.exoticas.length
        ? '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
          '<th class="esq">Espécie</th><th class="esq">Nome comum</th><th class="esq">Categoria</th>' +
          '<th class="esq">IUCN</th><th class="esq">MMA</th><th class="esq">Estadual</th></tr></thead><tbody>' +
          [['ameaçada', interesse.ameacadas], ['endêmica', interesse.endemicas],
           ['migratória', interesse.migratorias], ['cinegética', interesse.cinegeticas],
           ['exótica', interesse.exoticas]].map(function (par) {
            return par[1].map(function (t) {
              var a = t.atributos || {};
              return '<tr><td class="esq">' + nomeHtml(t) + '</td>' +
                '<td class="esq">' + esc(t.nomeComum || '—') + '</td>' +
                '<td class="esq">' + esc(par[0]) + '</td>' +
                '<td class="esq">' + esc(D.siglaAmeaca(a.iucn) || '—') + '</td>' +
                '<td class="esq">' + esc(D.siglaAmeaca(a.listaNacional) || '—') + '</td>' +
                '<td class="esq">' + esc(D.siglaAmeaca(a.listaEstadual) || '—') + '</td></tr>';
            }).join('');
          }).join('') + '</tbody></table></div>'
        : '<p>Não foram registradas espécies ameaçadas, endêmicas, migratórias, cinegéticas ou exóticas.</p>') +
      '</section>' +

      '<section><h2>Tabela de espécies</h2>' +
      tabelaLaudoEspecies(dados.total, mapaTx, rel, freq, inc, p.grupo) + '</section>' +

      '<section><h2>Notas metodológicas</h2>' +
      '<p style="font-size:.82rem;line-height:1.6;color:var(--texto-2)">' +
      'Índices de diversidade calculados sobre os registros primários deste levantamento. ' +
      'Simpson (D) = Σ ni(ni−1) ÷ N(N−1); Shannon (H′) = − Σ pi ln pi; equitabilidade de Pielou (J′) = H′ ÷ ln(S). ' +
      'Estimadores de riqueza: Chao 1 e Chao 2 (com as formas corrigidas quando F2 = 0 ou Q2 = 0), ' +
      'Jackknife 1 e 2 e Bootstrap. Curva do coletor por rarefação de indivíduos (Mao Tau), ' +
      'com a curva de Coleman (Gotelli & Colwell, 2011, eq. 4.1) como referência. ' +
      esc(FONTE_IC_TEXTO) + ' ' +
      'Nomenclatura conferida contra a base GBIF; toda divergência foi decidida pelo responsável técnico. ' +
      'As listas com força legal consideradas são a Portaria do MMA e a lista estadual; ' +
      'a categoria IUCN consta apenas como referência.' +
      '</p></section>' +

      '<div class="assinatura">' +
      '<div>' + esc(p.responsavel || ' ') + '<br><span style="font-size:.9em">' + esc(p.registroProfissional || 'Responsável técnico') + '</span></div>' +
      '<svg class="selo-folha"><use href="#ico-selo"></use></svg>' +
      '<div>' + esc(p.cliente || ' ') + '<br><span style="font-size:.9em">Cliente</span></div>' +
      '</div>' +
      '<div class="rodape-folha">Seara Biologia · ' + esc(p.nome) + ' · emitido em ' + esc(hoje) + '</div>' +
      '</div>';
  }

  function ficha(rotulo, valor) {
    return '<div><dt>' + esc(rotulo) + '</dt><dd>' + esc(valor || '—') + '</dd></div>';
  }

  function tabelaLaudoEspecies(mapa, mapaTx, rel, freq, inc, grupo) {
    var ids = Object.keys(mapa).sort(function (a, b) {
      var ta = mapaTx[a] || {}, tb = mapaTx[b] || {};
      return String(ta.ordem || '').localeCompare(String(tb.ordem || ''), 'pt-BR') ||
        String(ta.familia || '').localeCompare(String(tb.familia || ''), 'pt-BR') ||
        String(M.nomeCientifico(ta)).localeCompare(String(M.nomeCientifico(tb)), 'pt-BR');
    });
    var attrs = D.atributosDoGrupo(grupo);
    return '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
      '<th class="esq">Ordem</th><th class="esq">Família</th><th class="esq">Espécie</th><th class="esq">Nome comum</th>' +
      attrs.map(function (a) { return '<th class="esq">' + esc(a.curto) + '</th>'; }).join('') +
      '<th>ni</th><th>AR</th><th>FO</th></tr></thead><tbody>' +
      ids.map(function (id) {
        var t = mapaTx[id] || {}, a = t.atributos || {};
        return '<tr><td class="esq taxon-sup">' + esc(t.ordem || '—') + '</td>' +
          '<td class="esq taxon-sup">' + esc(t.familia || '—') + '</td>' +
          '<td class="esq">' + nomeHtml(t) + '</td>' +
          '<td class="esq">' + esc(t.nomeComum || '—') + '</td>' +
          attrs.map(function (at) {
            var v = a[at.chave];
            /* sigla de lista vermelha em maiúscula; os demais códigos como digitados */
            if (['iucn', 'listaNacional', 'listaEstadual'].indexOf(at.chave) >= 0) v = D.siglaAmeaca(v);
            return '<td class="esq">' + esc(v || '—') + '</td>';
          }).join('') +
          '<td>' + fmt(mapa[id], 0) + '</td>' +
          '<td>' + pct(rel[id], 1) + '</td>' +
          '<td>' + pct(freq[id], 0) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p style="font-size:.74rem;color:var(--texto-3);margin-top:6px">ni = indivíduos · AR = abundância relativa · ' +
      'FO = frequência de ocorrência · ' + attrs.map(function (a) { return esc(a.curto) + ' = ' + esc(a.rotulo); }).join(' · ') + '</p>';
  }

  /* =======================================================================
     EVENTOS
     ==================================================================== */
  function ligarEventos() {
    window.addEventListener('hashchange', rota);
    $('#btn-tema').addEventListener('click', alternarTema);

    $('#modal-cancelar').addEventListener('click', fecharModal);
    $('#modal-fundo').addEventListener('mousedown', function (ev) {
      if (ev.target === $('#modal-fundo')) fecharModal();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('#modal-fundo').hidden) fecharModal();
    });
    $('#modal-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var dados = {};
      $$('#modal-campos [name]').forEach(function (el) { dados[el.name] = el.value.trim(); });
      var fn = modalOk;
      fecharModal();
      if (fn) fn(dados);
    });

    /* botões fixos do cabeçalho de cada tela */
    $('#btn-novo-projeto').addEventListener('click', novoProjeto);
    $('#btn-nova-campanha').addEventListener('click', novaCampanha);
    $('#btn-nova-unidade').addEventListener('click', novaUnidade);
    $('#btn-novo-taxon').addEventListener('click', novoTaxon);
    $('#btn-gbif-lote').addEventListener('click', verificarLote);
    $('#btn-ir-laudo').addEventListener('click', function () { location.hash = '#laudo'; });
    $('#btn-imprimir').addEventListener('click', function () { window.print(); });

    $('#btn-exportar').addEventListener('click', function () {
      A.baixar('seara-fauna-' + A.hoje() + '.json', A.exportarJSON(), 'application/json');
      toast('Backup exportado.');
    });
    $('#btn-exemplos').addEventListener('click', escolherExemplo);
    $('#btn-importar-arquivo').addEventListener('click', escolherImportacao);
    $('#arquivo-tabela').addEventListener('change', function (ev) {
      var f = ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () { abrirMapeamento(String(leitor.result), f.name); };
      leitor.readAsText(f, 'utf-8');
    });
    $('#arquivo-import').addEventListener('change', function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () {
        try {
          var substituir = !estado.projetos.length ||
            confirmar('Já existem projetos neste aparelho.\n\nOK = SUBSTITUIR tudo pelo arquivo.\nCancelar = JUNTAR o arquivo ao que já existe.');
          if (substituir) A.importarJSON(leitor.result);
          else A.mesclarJSON(leitor.result);
          estado = A.obter();
          aplicarTema();
          renderizar('projetos');
          location.hash = '#projetos';
          rota();
          toast(substituir ? 'Dados importados.' : 'Dados juntados aos existentes.');
        } catch (e) {
          toast('Não consegui ler o arquivo: ' + e.message);
        }
      };
      leitor.readAsText(f);
      ev.target.value = '';
    });

    $('#btn-csv-registros').addEventListener('click', function () {
      var at = A.ativos();
      if (!at.projeto) return;
      A.baixar('registros-' + A.hoje() + '.csv', A.exportarCSVRegistros(at.projeto, estado.taxons), 'text/csv');
      toast('CSV de registros exportado.');
    });
    $('#btn-csv-taxons').addEventListener('click', function () {
      A.baixar('taxons-' + A.hoje() + '.csv', A.exportarCSVTaxons(filtrarTaxons(), grupoDoCatalogo()), 'text/csv');
      toast('CSV do catálogo exportado.');
    });

    /* delegação para tudo que é gerado dinamicamente */
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-acao]');
      if (el) { acao(el.getAttribute('data-acao'), el); return; }

      var seg = ev.target.closest('#seg-unidade button');
      if (seg) {
        var at = A.ativos();
        A.definirAtivos(at.projeto.id, at.campanha.id, seg.getAttribute('data-unidade'));
        renderRegistros();
        return;
      }

      var item = ev.target.closest('.item[data-projeto]');
      if (item) {
        var id = item.getAttribute('data-projeto');
        A.definirAtivos(estado.projetoAtivo === id ? null : id, null, null);
        renderProjetos();
      }
    });
  }

  function acao(nome, el) {
    var at = A.ativos();
    var idP = el.getAttribute('data-projeto');
    var idC = el.getAttribute('data-campanha');
    var idU = el.getAttribute('data-unidade');
    var idT = el.getAttribute('data-taxon');
    var idR = el.getAttribute('data-registro');

    switch (nome) {
      case 'novo-projeto': novoProjeto(); break;

      case 'abrir-projeto':
        A.definirAtivos(idP, null, null);
        var p0 = A.acharProjeto(idP);
        if (p0 && p0.campanhas.length) A.definirAtivos(idP, p0.campanhas[0].id, p0.campanhas[0].unidades[0] ? p0.campanhas[0].unidades[0].id : null);
        location.hash = '#campanhas';
        break;

      case 'editar-projeto':
        var pe = A.acharProjeto(idP);
        abrirModal('Editar projeto', formProjeto(pe), function (d) {
          A.atualizarProjeto(idP, d); renderProjetos(); toast('Projeto atualizado.');
        });
        break;

      case 'excluir-projeto':
        if (confirmar('Excluir este projeto e todas as suas campanhas, unidades e registros?\nO catálogo de táxons não é afetado.')) {
          A.removerProjeto(idP); renderProjetos(); toast('Projeto excluído.');
        }
        break;

      case 'limpar-avisos':
        delete estado.importacao; A.salvar(); renderProjetos(); break;

      case 'nova-campanha': novaCampanha(); break;

      case 'abrir-campanha':
        var cc = A.acharCampanha(idP || at.projeto.id, idC);
        A.definirAtivos(idP || at.projeto.id, idC, cc && cc.unidades[0] ? cc.unidades[0].id : null);
        location.hash = '#unidades';
        break;

      case 'editar-campanha':
        var ce = A.acharCampanha(at.projeto.id, idC);
        abrirModal('Editar campanha', formCampanha(ce), function (d) {
          A.atualizarCampanha(at.projeto.id, idC, d); renderCampanhas(); toast('Campanha atualizada.');
        });
        break;

      case 'excluir-campanha':
        if (confirmar('Excluir esta campanha e todas as suas unidades e registros?')) {
          A.removerCampanha(at.projeto.id, idC); renderCampanhas(); toast('Campanha excluída.');
        }
        break;

      case 'nova-unidade': novaUnidade(); break;

      case 'abrir-unidade':
        A.definirAtivos(at.projeto.id, at.campanha.id, idU);
        location.hash = '#registros';
        break;

      case 'editar-unidade':
        var ue = A.acharUnidade(at.projeto.id, at.campanha.id, idU);
        editarUnidade(ue);
        break;

      case 'excluir-unidade':
        if (confirmar('Excluir esta unidade amostral e seus registros?')) {
          A.removerUnidade(at.projeto.id, at.campanha.id, idU); renderUnidades(); toast('Unidade excluída.');
        }
        break;

      case 'editar-registro':
        editarRegistro(idR);
        break;

      case 'excluir-registro':
        if (at.unidade) { A.removerRegistro(at.unidade, idR); renderRegistros(); }
        break;

      case 'novo-taxon': novoTaxon(); break;

      case 'editar-taxon':
        var te = A.acharTaxon(idT);
        abrirModal('Editar táxon', formTaxon(te), function (d) {
          A.atualizarTaxon(idT, extrairTaxon(d)); renderTaxons(); toast('Táxon atualizado.');
        });
        break;

      case 'excluir-taxon':
        var uso = A.usoDosTaxons()[idT] || 0;
        if (confirmar(uso
          ? 'Este táxon tem ' + uso + ' registro(s). Excluir apaga também esses registros. Continuar?'
          : 'Excluir este táxon do catálogo?')) {
          A.removerTaxon(idT); renderTaxons(); toast('Táxon excluído.');
        }
        break;

      case 'gbif-um': verificarUm(idT); break;
      case 'gbif-lote': verificarLote(); break;

      case 'div-aceitar': aplicarDivergencia(idT, Number(el.getAttribute('data-i')), true); break;
      case 'div-recusar': aplicarDivergencia(idT, Number(el.getAttribute('data-i')), false); break;

      case 'atalho': lancarAtalho(idT); break;

      case 'ver-exemplos': escolherExemplo(); break;
      case 'abrir-exemplo': abrirExemplo(el.getAttribute('data-exemplo')); break;
      case 'import-json': fecharModal(); $('#arquivo-import').click(); break;
      case 'import-tabela': fecharModal(); $('#arquivo-tabela').click(); break;
      case 'import-cancelar': importPendente = null; renderProjetos(); break;
      case 'import-confirmar': confirmarImportacao(); break;

      case 'editar-secundarios': editarSecundarios(); break;
    }
  }

  /* ---------------------------------------------------------- ações longas */
  function novoProjeto() {
    abrirModal('Novo projeto', formProjeto(null), function (d) {
      var p = A.novoProjeto(d);
      A.definirAtivos(p.id, null, null);
      renderProjetos();
      toast('Projeto criado. Agora crie a primeira campanha.');
      location.hash = '#campanhas';
    });
  }

  function novaCampanha() {
    var at = A.ativos();
    if (!at.projeto) { toast('Abra um projeto primeiro.'); return; }
    abrirModal('Nova campanha', formCampanha(null), function (d) {
      var c = A.novaCampanha(at.projeto.id, d);
      A.definirAtivos(at.projeto.id, c.id, null);
      renderCampanhas();
      toast('Campanha criada.');
    });
  }

  function novaUnidade() {
    var at = A.ativos();
    if (!at.campanha) { toast('Abra uma campanha primeiro.'); return; }
    var base = A.unidadeVazia('transecto', at.campanha.unidades.length);
    abrirModalUnidade('Nova unidade amostral', base, function (d) {
      var dd = extrairUnidade(d);
      var u = A.novaUnidade(at.projeto.id, at.campanha.id, dd);
      A.definirAtivos(at.projeto.id, at.campanha.id, u.id);
      renderUnidades();
      toast('Unidade criada.');
    });
  }

  function editarUnidade(u) {
    abrirModalUnidade('Editar unidade amostral', u, function (d) {
      var at = A.ativos();
      A.atualizarUnidade(at.projeto.id, at.campanha.id, u.id, extrairUnidade(d));
      renderUnidades();
      toast('Unidade atualizada.');
    });
  }

  /**
   * O formulário da unidade é o único que se redesenha sozinho: trocar o
   * método troca os campos de esforço. Sem isso, transecto e armadilha
   * fotográfica pediriam as mesmas coisas — e é justamente o que não pode.
   */
  function abrirModalUnidade(titulo, u, aoSalvar) {
    function montar(metodoChave, valores) {
      var campos = formUnidade(u, metodoChave);
      if (valores) {
        campos.forEach(function (c) {
          if (c.chave && valores[c.chave] !== undefined && c.chave.indexOf('esf_') !== 0) c.valor = valores[c.chave];
        });
      }
      abrirModal(titulo, campos, aoSalvar);
      var sel = $('#mc-metodo');
      if (sel) {
        sel.addEventListener('change', function () {
          var atuais = {};
          $$('#modal-campos [name]').forEach(function (el) { atuais[el.name] = el.value; });
          montar(sel.value, atuais);
        });
      }
    }
    montar((u && u.metodo) || 'transecto', null);
  }

  function novoTaxon() {
    abrirModal('Novo táxon', formTaxon(null), function (d) {
      var dados = extrairTaxon(d);
      if (!dados.genero) { toast('Informe o nome científico.'); return; }
      A.novoTaxon(dados);
      renderTaxons();
      toast('Táxon cadastrado.');
    });
  }

  function editarRegistro(idR) {
    var at = A.ativos();
    if (!at.unidade) return;
    var r = (at.unidade.registros || []).filter(function (x) { return x.id === idR; })[0];
    if (!r) return;
    var t = A.acharTaxon(r.taxonId);
    abrirModal('Editar registro', [
      { chave: 'especie', rotulo: 'Espécie', valor: t ? M.nomeCientifico(t) : '', obrigatorio: true,
        dica: 'Se o nome não existir no catálogo, um táxon novo é criado.' },
      { chave: 'quantidade', rotulo: 'Quantidade', tipo: 'number', passo: '1', valor: r.quantidade },
      { chave: 'tipo', rotulo: 'Tipo de registro', tipo: 'select', opcoes: D.TIPOS_REGISTRO.map(function (x) { return { valor: x.chave, rotulo: x.rotulo }; }), valor: r.tipo },
      { chave: 'hora', rotulo: 'Hora', tipo: 'time', valor: r.hora },
      { chave: 'observador', rotulo: 'Observador', valor: r.observador },
      { chave: 'foto', rotulo: 'Foto / registro', valor: r.foto },
      { chave: 'observacao', rotulo: 'Observação', tipo: 'textarea', valor: r.observacao }
    ], function (d) {
      var alvo = A.acharTaxonPorNome(d.especie);
      if (!alvo) {
        var pn = M.partirNome(d.especie);
        alvo = A.novoTaxon({ genero: pn.genero, epiteto: pn.epiteto });
      }
      var q = parseFloat(String(d.quantidade).replace(',', '.'));
      A.atualizarRegistro(at.unidade, idR, {
        taxonId: alvo.id, quantidade: isFinite(q) && q > 0 ? q : 1,
        tipo: d.tipo, hora: d.hora, observador: d.observador,
        foto: d.foto, observacao: d.observacao
      });
      renderRegistros();
      toast('Registro atualizado.');
    });
  }

  function editarSecundarios() {
    var at = A.ativos();
    if (!at.projeto) return;
    var s = at.projeto.secundarios || { titulo: '', autores: '', especies: [] };
    abrirModal('Dados secundários', [
      { chave: 'titulo', rotulo: 'Título do trabalho', valor: s.titulo },
      { chave: 'autores', rotulo: 'Autor(es)', valor: s.autores },
      { chave: 'especies', rotulo: 'Espécies', tipo: 'textarea', valor: (s.especies || []).join('\n'),
        dica: 'Um nome científico por linha. É esta lista que entra na comparação primários × secundários.' }
    ], function (d) {
      A.atualizarProjeto(at.projeto.id, {
        secundarios: {
          titulo: d.titulo, autores: d.autores,
          especies: String(d.especies || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean)
        }
      });
      renderResultados();
      toast('Dados secundários atualizados.');
    });
  }

  /* =========================================================== inicialização */
  function iniciar() {
    estado = A.carregar();
    aplicarTema();
    if (!estado.projetos.length && !estado.exemploSemeado) {
      A.semear();
      estado = A.obter();
    }
    ligarEventos();
    if (!location.hash) location.hash = '#projetos';
    rota();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if ((estado.tema || 'auto') === 'auto') { aplicarTema(); renderizar(telaAtual()); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
