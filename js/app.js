/* ============================================================================
   Seara Biologia — Fauna — app.js
   Interface e eventos. Todo o cálculo vem de motor.js; aqui só apresentação.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DADOS, M = window.MOTOR, G = window.GRAFICOS,
      A = window.ARMAZENAMENTO, B = window.GBIF;
  var AE = window.AUTOECOLOGIA, SEC = window.SECUNDARIOS,
      FT = window.FONTES, LO = window.LISTAS_OFICIAIS;
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

  /** Data e hora de uma consulta a fonte externa — o laudo precisa das duas. */
  function dataHoraBR(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return dataBR(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  var TELAS = ['projetos', 'campanhas', 'unidades', 'registros', 'taxons', 'secundarios',
    'resultados', 'laudo', 'ajuda'];

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
    else if (tela === 'secundarios') renderSecundarios();
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
    var pa = $('#painel-achados');
    if (pa) pa.innerHTML = painelAchadosHtml();
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
      /* Só palavras que começam por letra ou número: um nome como
         "Mineração — exemplo" dava "M—", porque o travessão contava
         como palavra e virava a segunda inicial. */
      var iniciais = (p.nome || '?').trim().split(/\s+/)
        .filter(function (x) { return /^[\p{L}\p{N}]/u.test(x); })
        .slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase() || '?';
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

  /* Os avisos da importação nascem RECOLHIDOS. Eles descrevem o arquivo de
     origem, não o trabalho dele, e abertos ocupavam a primeira tela inteira —
     o app se apresentava como uma lista de problemas. O painel de achados
     acima é que fica aberto; isto aqui é a nota de rodapé da importação. */
  function mostrarAvisosImport() {
    var alvo = $('#avisos-import');
    var imp = estado.importacao;
    if (!imp || !imp.avisos || !imp.avisos.length) { alvo.innerHTML = ''; return; }
    alvo.innerHTML = '<details class="card recolhivel"><summary>' +
      '<span>Observações da leitura do arquivo <b>(' + imp.avisos.length + ')</b>' +
      (imp.origem ? ' — ' + esc(imp.origem) : '') + '</span></summary>' +
      '<div class="avisos-pilha" style="margin-top:var(--e3)">' +
      imp.avisos.map(function (a) { return avisoHtml(esc(a)); }).join('') + '</div>' +
      '<div class="acoes" style="margin-top:var(--e3)">' +
      '<button class="btn btn-fantasma btn-pq" data-acao="limpar-avisos" type="button">Dispensar</button>' +
      '</div></details>';
  }

  /* =======================================================================
     PAINEL DE ACHADOS — o que o app já encontrou no projeto aberto

     NADA AQUI É ESCRITO À MÃO. Todo número sai do estado: com o dado do João
     carregado, o painel mostra o dado do João; sem achado, ele não aparece.

     Duas famílias, e a cor separa uma da outra:

       · DEFEITO NO DADO — ameaçada que o catálogo não declara, nome que a
         GBIF trata como desatualizado. É erro que já está lá e vai para o
         laudo assinado se ninguém mexer. Terracota.
       · FALTA PREENCHER — esforço em branco, autoecologia vazia, nome ainda
         não conferido. Não é erro; é trabalho que ainda não foi feito.

     Cada linha é um botão que abre a tela onde o dado está — o painel afirma,
     a tela prova.
     ==================================================================== */

  /**
   * Os campos que uma fonte externa sabe buscar. Fora daqui (sensibilidade de
   * Stotz, dependência de mata, endemismo, hábito, porte) não há fonte
   * consultável: continua sendo conhecimento do biólogo. Contar esses campos
   * como "a automação preenche" seria prometer o que o app não faz.
   */
  var CAMPOS_DE_FONTE = [
    { chave: 'autor', alvo: 'taxon', rotulo: 'autoria', fonte: 'GBIF' },
    { chave: 'nomeComum', alvo: 'taxon', rotulo: 'nome comum', fonte: 'GBIF / iNaturalist' },
    { chave: 'classe', alvo: 'taxon', rotulo: 'classe', fonte: 'GBIF' },
    { chave: 'ordem', alvo: 'taxon', rotulo: 'ordem', fonte: 'GBIF' },
    { chave: 'familia', alvo: 'taxon', rotulo: 'família', fonte: 'GBIF' },
    { chave: 'iucn', alvo: 'atributo', rotulo: 'categoria IUCN', fonte: 'iNaturalist' },
    { chave: 'listaNacional', alvo: 'atributo', rotulo: 'categoria da Portaria', fonte: 'Lista Nacional' }
  ];

  /**
   * O catálogo que serve a um projeto: o que foi registrado nele, mais o que
   * está no catálogo do app com o mesmo grupo faunístico. O catálogo é do app
   * inteiro — sem este recorte, abrir os dois exemplos faria o painel do
   * projeto de aves contar as 23 espécies de mamífero.
   */
  function catalogoDoProjeto(p, idsRegistrados) {
    var mapa = A.taxonsPorId();
    var grupo = p.grupo || 'aves';
    var vistos = {}, cat = [];
    (idsRegistrados || []).forEach(function (id) {
      var t = mapa[id];
      if (t && !vistos[t.id]) { vistos[t.id] = 1; cat.push(t); }
    });
    estado.taxons.forEach(function (t) {
      if ((t.grupo || 'aves') === grupo && !vistos[t.id]) { vistos[t.id] = 1; cat.push(t); }
    });
    return cat;
  }

  function plural(n, um, muitos) { return n === 1 ? um : muitos; }

  function achadosDoProjeto(p) {
    if (!p) return null;
    var grupo = p.grupo || 'aves';
    var mapaTx = A.taxonsPorId();
    /* a mesma coleta da tela de Resultados: o S do painel é o S de lá */
    var dados = coletar(p, 'projeto');
    var idsReg = Object.keys(dados.total);
    var S = idsReg.length;
    var cat = catalogoDoProjeto(p, idsReg);

    var destaque = null, defeitos = [], lacunas = [];

    /* ---------------- 1. ameaçadas que o catálogo não declara --------------
       O achado de maior consequência: a Lista Nacional aponta a espécie como
       ameaçada e a coluna Portaria do MMA do catálogo não diz isso. Foi
       exatamente o que aconteceu na planilha de origem. */
    if (AE && LO) {
      var cr = AE.cruzarListaOficial(cat);
      var naoDeclara = cr.naLista.filter(function (x) {
        return x.casamento !== 'subespecie' && x.oficial &&
          D.ehAmeaca(x.oficial.categoria) && !D.ehAmeaca(x.atual);
      });
      if (naoDeclara.length) {
        destaque = {
          n: naoDeclara.length,
          titulo: plural(naoDeclara.length,
            'espécie ameaçada que o catálogo não declara',
            'espécies ameaçadas que o catálogo não declara'),
          texto: naoDeclara.slice(0, 4).map(function (x) {
            return '<i class="cientifico">' + esc(M.nomeCientifico(x.taxon)) + '</i> consta como ' +
              esc(x.oficial.categoria) + ' na Lista Nacional (' + esc(x.oficial.ano) + ')' +
              (x.atual ? ', e o catálogo traz ' + esc(x.atual) : ', e o campo está em branco');
          }).join('; ') +
          (naoDeclara.length > 4 ? '; e mais ' + (naoDeclara.length - 4) : '') +
          '. Um laudo que informa o número errado de espécies ameaçadas é passivo.',
          destino: 'taxons', filtro: ''
        };
      }
      var outras = cr.divergencias.filter(function (x) { return naoDeclara.indexOf(x) < 0; });
      if (outras.length) {
        defeitos.push({
          n: outras.length,
          titulo: plural(outras.length,
            'categoria que não bate com a Lista Nacional',
            'categorias que não batem com a Lista Nacional'),
          texto: outras.slice(0, 3).map(function (x) {
            return '<i class="cientifico">' + esc(M.nomeCientifico(x.taxon)) + '</i> — catálogo ' +
              esc(x.atual || 'em branco') + ', lista oficial ' +
              esc(x.sugerido || 'não consta como espécie');
          }).join('; ') +
          (outras.length > 3 ? '; e mais ' + (outras.length - 3) : '') + '.',
          destino: 'taxons', filtro: ''
        });
      }
    }

    /* ------------- 2. nomes que a GBIF aponta como errados ----------------
       Só o que já foi conferido: sem a Conferência taxonômica rodada, este
       achado simplesmente não existe — e a lacuna correspondente aparece
       mais abaixo. */
    /* Conta TÁXONS, não propostas: `Hydropsalis parvula` volta com dois nomes
       aceitos candidatos, e dizer "2 sinônimos" para uma espécie inflaria o
       número. O que ele decide é a espécie, uma vez. */
    var TIPOS_NOME = { sinonimo: 1, grafia: 1, digitacao: 1 };
    var nSinonimo = 0, nGrafia = 0, nNome = 0, exGrafia = '';
    cat.forEach(function (t) {
      var temSin = false, temGrafia = false;
      ((t.gbif && t.gbif.divergencias) || []).forEach(function (d) {
        if (d.decidido || !TIPOS_NOME[d.tipo]) return;
        if (d.tipo === 'sinonimo') temSin = true;
        else {
          temGrafia = true;
          if (!exGrafia && d.atual && d.sugerido) exGrafia = d.atual + ' → ' + d.sugerido;
        }
      });
      if (temSin) nSinonimo++;
      if (temGrafia) nGrafia++;
      if (temSin || temGrafia) nNome++;
    });
    if (nNome) {
      var pedacos = [];
      if (nSinonimo) {
        pedacos.push(nSinonimo + ' ' + plural(nSinonimo,
          'que a GBIF trata como sinônimo de um nome aceito',
          'que a GBIF trata como sinônimos de nomes aceitos'));
      }
      if (nGrafia) {
        pedacos.push(nGrafia + ' com provável erro de digitação' +
          (exGrafia ? ' (' + esc(exGrafia) + ')' : ''));
      }
      defeitos.push({
        n: nNome,
        titulo: plural(nNome,
          'táxon com nome desatualizado ou grafado errado, segundo a GBIF',
          'táxons com nome desatualizado ou grafado errado, segundo a GBIF'),
        texto: pedacos.join(' e ') + '. Cada um é aceito ou recusado por você, um a um — ' +
          'divergência real entre autores não entra nesta conta.',
        destino: 'taxons', filtro: 'divergentes'
      });
    }

    /* ------------- 3. esperadas para a região e não detectadas ------------- */
    var sg = p.secundariosGbif;
    if (SEC && sg && sg.especies && sg.especies.length) {
      var prim = idsReg.map(function (id) {
        return mapaTx[id] ? M.nomeCientifico(mapaTx[id]) : '';
      }).filter(Boolean);
      var cz = SEC.cruzar(prim, sg.especies);
      if (cz.esperadas.length) {
        var f = sg.filtro || {};
        lacunas.push({
          n: cz.esperadas.length,
          titulo: plural(cz.esperadas.length,
            'espécie já registrada nesta região que o levantamento não detectou',
            'espécies já registradas nesta região que o levantamento não detectou'),
          texto: 'Ocorrências publicadas na GBIF num raio de ' + esc(fmt(f.raioKm, 0)) +
            ' km em volta da área' +
            ((f.classes || []).length ? ', classe ' + esc(f.classes.join(' + ')) : '') +
            '. Ou o esforço foi curto, ou a espécie deixou a área — a conclusão é sua, o número e a fonte são do app.',
          destino: 'secundarios', filtro: ''
        });
      }
    }

    /* ------------- 4. riqueza observada × tamanho do catálogo -------------- */
    var semRegistro = cat.length - S;
    if (S && semRegistro > 0) {
      lacunas.push({
        n: semRegistro,
        titulo: plural(semRegistro,
          'espécie do catálogo sem registro em nenhuma unidade amostral',
          'espécies do catálogo sem registro em nenhuma unidade amostral'),
        texto: 'A riqueza observada é <b>S = ' + esc(fmt(S, 0)) + '</b>, contada só sobre o que tem ' +
          'registro em unidade amostral, e o catálogo deste grupo tem ' + esc(fmt(cat.length, 0)) +
          ' táxons. A diferença costuma ser observação ocasional, fora das unidades: enquanto não ' +
          'tiver uma unidade amostral própria, ela não entra na riqueza nem na curva do coletor. ' +
          'É distinção que muda o laudo.',
        destino: 'taxons', filtro: 'semRegistro'
      });
    }

    /* ------------- 5. unidades sem esforço registrado ---------------------- */
    var semEsf = [], campSemEsf = null;
    (p.campanhas || []).forEach(function (c) {
      (c.unidades || []).forEach(function (u) {
        if (esforcoDe(u) !== null) return;
        semEsf.push(u.codigo);
        /* a tela de Unidades é por campanha: guardar QUAL abrir é o que faz
           a linha provar o que afirma em vez de cair num estado vazio */
        if (!campSemEsf) campSemEsf = { campanha: c.id, unidade: u.id };
      });
    });
    if (semEsf.length) {
      lacunas.push({
        n: semEsf.length,
        titulo: plural(semEsf.length,
          'unidade amostral sem esforço preenchido',
          'unidades amostrais sem esforço preenchido'),
        texto: 'Sem esforço não há densidade nem comparação entre métodos, e elas ficam de fora ' +
          'desses cálculos: ' + esc(semEsf.slice(0, 8).join(', ')) +
          (semEsf.length > 8 ? ' e mais ' + (semEsf.length - 8) : '') + '.',
        destino: 'unidades', filtro: '',
        campanha: campSemEsf ? campSemEsf.campanha : '',
        unidade: campSemEsf ? campSemEsf.unidade : ''
      });
    }

    /* ------------- 6. campos que as fontes sabem buscar -------------------- */
    var attrsGrupo = {};
    D.atributosDoGrupo(grupo).forEach(function (a) { attrsGrupo[a.chave] = 1; });
    var vazios = 0, porCampo = [];
    CAMPOS_DE_FONTE.forEach(function (c) {
      if (c.alvo === 'atributo' && !attrsGrupo[c.chave]) return;
      var n = 0;
      cat.forEach(function (t) {
        /* a Lista Nacional só preenche quem está NELA — contar as outras
           seria prometer um dado que a fonte não tem */
        if (c.chave === 'listaNacional') {
          var achadoLO = LO ? LO.buscar(M.nomeCientifico(t)) : null;
          if (!achadoLO || achadoLO.tipo === 'subespecie') return;
        }
        var v = c.alvo === 'atributo' ? (t.atributos || {})[c.chave] : t[c.chave];
        if (!String(v === undefined || v === null ? '' : v).trim()) n++;
      });
      if (n) { vazios += n; porCampo.push(n + ' de ' + c.rotulo); }
    });
    if (vazios) {
      lacunas.push({
        n: vazios,
        titulo: plural(vazios,
          'campo em branco que as fontes sabem buscar',
          'campos em branco que as fontes sabem buscar'),
        texto: porCampo.join(', ') + '. O botão <b>Preencher autoecologia</b> consulta GBIF, ' +
          'iNaturalist e a Lista Nacional e propõe campo a campo — o que a fonte não tiver ' +
          'continua em branco, e nada é gravado sem você aceitar.',
        destino: 'taxons', filtro: ''
      });
    }

    /* ------------- 7. ainda não conferidos na GBIF ------------------------- */
    var naoVerif = cat.filter(function (t) { return !t.gbif; }).length;
    if (naoVerif) {
      lacunas.push({
        n: naoVerif,
        titulo: plural(naoVerif,
          'táxon ainda não conferido na GBIF',
          'táxons ainda não conferidos na GBIF'),
        texto: 'A conferência taxonômica compara cada nome com a base internacional e separa ' +
          'sinônimo, erro de digitação e divergência real entre autores.',
        destino: 'taxons', filtro: 'naoVerificados'
      });
    }

    return {
      destaque: destaque, defeitos: defeitos, lacunas: lacunas,
      total: (destaque ? 1 : 0) + defeitos.length + lacunas.length
    };
  }

  function linhaAchado(a, classe) {
    return '<button class="achado' + (classe ? ' ' + classe : '') + '" type="button" ' +
      'data-acao="achado-ir" data-destino="' + esc(a.destino) + '" data-filtro="' + esc(a.filtro || '') + '"' +
      (a.campanha ? ' data-campanha="' + esc(a.campanha) + '"' : '') +
      (a.unidade ? ' data-unidade="' + esc(a.unidade) + '"' : '') + '>' +
      '<span class="achado-n">' + fmt(a.n, 0) + '</span>' +
      '<span class="achado-corpo"><b>' + a.titulo + '</b><small>' + a.texto + '</small></span>' +
      '<span class="achado-seta" aria-hidden="true">›</span></button>';
  }

  function painelAchadosHtml() {
    var p = A.ativos().projeto;
    if (!p) return '';
    var r = achadosDoProjeto(p);
    if (!r || !r.total) return '';

    if ((estado.achadosDispensados || {})[p.id]) {
      return '<div class="achados-oculto">' +
        '<button class="btn btn-fantasma btn-pq" data-acao="achados-mostrar" type="button">' +
        icone('ico-lupa') + plural(r.total, ' Mostrar o achado de ', ' Mostrar os ' + r.total + ' achados de ') +
        esc(p.nome) + '</button></div>';
    }

    var h = '<section class="achados" aria-labelledby="t-achados">' +
      '<div class="achados-topo">' +
      '<div><h2 id="t-achados">O que já foi encontrado neste projeto</h2>' +
      '<p>' + esc(p.nome) + ' · ' + r.total + ' ' + plural(r.total, 'achado', 'achados') +
      '. Cada linha abre a tela onde o dado está.</p></div>' +
      '<button class="btn btn-fantasma btn-pq" data-acao="achados-dispensar" type="button">' +
      icone('ico-x') + ' Dispensar</button></div>';

    if (r.destaque || r.defeitos.length) {
      h += '<h3 class="achados-titulo achados-titulo-defeito">Defeito no dado — já está no catálogo</h3>' +
        '<div class="achados-lista">' +
        (r.destaque ? linhaAchado(r.destaque, 'achado-defeito achado-destaque') : '') +
        r.defeitos.map(function (a) { return linhaAchado(a, 'achado-defeito'); }).join('') + '</div>';
    }
    if (r.lacunas.length) {
      h += '<h3 class="achados-titulo">Falta preencher — ainda não foi feito</h3>' +
        '<div class="achados-lista">' +
        r.lacunas.map(function (a) { return linhaAchado(a, ''); }).join('') + '</div>';
    }
    return h + '</section>';
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
        '<button class="item" type="button" data-acao="import-inat" style="width:100%;text-align:left;cursor:pointer">' +
        '<div class="avatar">iN</div><div class="item-corpo"><h3>iNaturalist — direto da API</h3>' +
        '<div class="item-meta"><span>As observações de um usuário, sem chave e sem exportar CSV</span></div></div></button>' +
        '<button class="item" type="button" data-acao="import-ebird" style="width:100%;text-align:left;cursor:pointer">' +
        '<div class="avatar">eB</div><div class="item-corpo"><h3>eBird — direto da API</h3>' +
        '<div class="item-meta"><span>Observações recentes num raio. ' +
        (FT && FT.temEbird() ? 'Chave já guardada neste aparelho' : 'Precisa de chave gratuita') +
        '</span></div></div></button>' +
        '</div>' }],
      null, { semSalvar: true });
  }

  /* ---------------------------------------------- iNaturalist e eBird
     Os dois caem na MESMA tela de pré-visualização e mapeamento do
     importador: viram uma tabela Darwin Core e seguem o caminho que já
     existe. Espécie que já está no catálogo é reaproveitada pelo nome
     normalizado — nunca duplicada. */
  function modalInaturalist() {
    abrirModal('Importar do iNaturalist', [
      { tipo: 'html', html: '<p class="card-nota" style="margin-bottom:var(--e3)">Sem chave e sem cadastro. ' +
        'Entra o caderno de campo de <strong>um usuário</strong> — o seu, ou o de quem fez o levantamento. ' +
        'Observação identificada só em gênero ou família é separada e não entra na riqueza.</p>' },
      { chave: 'login', rotulo: 'Usuário do iNaturalist', obrigatorio: true, placeholder: 'como aparece em inaturalist.org/people/…',
        valor: (estado.inatLogin || '') },
      { chave: 'taxonId', rotulo: 'Filtrar por taxon_id (opcional)', placeholder: '3 = Aves, 40151 = Mammalia',
        dica: 'O número do táxon no iNaturalist. Em branco traz tudo.' },
      { chave: 'de', rotulo: 'A partir de', tipo: 'date', valor: '' },
      { chave: 'ate', rotulo: 'Até', tipo: 'date', valor: '' }
    ], function (d) {
      if (!d.login) { toast('Informe o usuário.'); return; }
      estado.inatLogin = d.login;
      A.salvar();
      toast('Consultando o iNaturalist…');
      FT.inatObservacoes({ login: d.login, taxonId: d.taxonId, de: d.de, ate: d.ate })
        .then(function (r) {
          if (!r.ok) {
            toast(/422|Unknown user/.test(String(r.erro))
              ? 'O iNaturalist não conhece o usuário "' + d.login + '".'
              : r.erro);
            return;
          }
          entregarAoImportador(r.dados.resultados, {
            fonte: 'iNaturalist', consultadoEm: r.consultadoEm,
            arquivo: 'iNaturalist — ' + d.login,
            metodo: 'busca ativa', observador: d.login,
            truncado: r.dados.truncado, total: r.dados.total
          });
        });
    });
  }

  function modalEbird() {
    var at = A.ativos();
    var par = at.projeto ? paramsSecundarios(at.projeto) : { lat: '', lon: '', raioKm: 25 };
    abrirModal('Importar do eBird', [
      { tipo: 'html', html: '<p class="card-nota" style="margin-bottom:var(--e3)">O eBird exige uma ' +
        '<strong>chave de API</strong>. Ela é <strong>gratuita</strong> e sai em minutos em ' +
        '<code>ebird.org/api/keygen</code>. Ela fica guardada <strong>neste aparelho</strong> e ' +
        'nunca entra no backup JSON nem no código.</p>' +
        '<p class="card-nota" style="margin-bottom:var(--e3)">O eBird não publica endpoint de ' +
        '“minhas observações”: o que existe é <strong>por área</strong>. Por isso o que entra aqui é o ' +
        'que a comunidade registrou na região, não o seu caderno pessoal — trate como dado de apoio.</p>' },
      { chave: 'chave', rotulo: 'Chave de API do eBird', valor: FT.chaveEbird(),
        dica: 'Guardada só neste navegador. Deixe em branco para apagar a que está salva.' },
      { chave: 'lat', rotulo: 'Latitude', valor: par.lat, obrigatorio: true },
      { chave: 'lon', rotulo: 'Longitude', valor: par.lon, obrigatorio: true },
      { chave: 'raioKm', rotulo: 'Raio', tipo: 'number', passo: '1', valor: Math.min(par.raioKm || 25, 50),
        sufixo: 'km', dica: 'A API do eBird aceita até 50 km.' },
      { chave: 'dias', rotulo: 'Últimos', tipo: 'number', passo: '1', valor: 30,
        sufixo: 'dias', dica: 'A API do eBird só devolve os últimos 30 dias.' }
    ], function (d) {
      FT.definirChaveEbird(d.chave);
      if (!d.chave) { toast('Chave apagada. O eBird fica desabilitado; o resto do app não muda.'); return; }
      var lat = parseFloat(String(d.lat).replace(',', '.'));
      var lon = parseFloat(String(d.lon).replace(',', '.'));
      if (!isFinite(lat) || !isFinite(lon)) { toast('Preencha latitude e longitude.'); return; }
      toast('Consultando o eBird…');
      FT.ebirdProximas({ lat: lat, lon: lon, raioKm: d.raioKm, dias: d.dias })
        .then(function (r) {
          if (!r.ok) { toast(r.erro); return; }
          entregarAoImportador(r.dados, {
            fonte: 'eBird', consultadoEm: r.consultadoEm,
            arquivo: 'eBird — ' + lat.toFixed(3) + ', ' + lon.toFixed(3) + ' · ' + d.raioKm + ' km',
            metodo: 'busca ativa'
          });
        });
    });
  }

  /** Vira tabela Darwin Core e cai na tela de pré-visualização que já existe. */
  function entregarAoImportador(observacoes, meta) {
    var sep = SEC.filtrarEspecies(observacoes);
    if (!sep.especies.length) {
      toast('A ' + meta.fonte + ' não devolveu nenhuma observação identificada em espécie.');
      return;
    }
    var csv = SEC.paraDarwinCore(sep.especies, {
      metodo: meta.metodo, observador: meta.observador
    });
    abrirMapeamento(csv, meta.arquivo);
    if (importPendente) {
      importPendente.origemApi = {
        fonte: meta.fonte, consultadoEm: meta.consultadoEm,
        acimaDeEspecie: sep.acimaDeEspecie.length,
        truncado: !!meta.truncado, total: meta.total
      };
      importPendente.opcoes.nomeProjeto = meta.arquivo;
      renderProjetos();
    }
    var avisos = [];
    if (sep.acimaDeEspecie.length) {
      avisos.push(sep.acimaDeEspecie.length + ' observação(ões) identificada(s) acima do nível de espécie ' +
        'ficaram de fora — contá-las inflaria a riqueza.');
    }
    if (meta.truncado) {
      avisos.push('A consulta trouxe ' + observacoes.length + ' de ' + meta.total +
        ' observações (limite de paginação). Para o conjunto inteiro, exporte o CSV no site e importe como tabela.');
    }
    toast(sep.especies.length + ' observação(ões) da ' + meta.fonte + ' prontas para revisão. ' +
      avisos.join(' '));
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
      (imp.origemApi ? '<div style="margin-top:var(--e3)">' + avisoHtml(
        'Veio da API do <strong>' + esc(imp.origemApi.fonte) + '</strong>, consultada em ' +
        esc(dataHoraBR(imp.origemApi.consultadoEm)) + '. Essa procedência fica registrada no projeto e sai no laudo.' +
        (imp.origemApi.acimaDeEspecie ? ' ' + imp.origemApi.acimaDeEspecie +
          ' observação(ões) identificada(s) acima do nível de espécie já foram separadas.' : '') +
        (imp.origemApi.truncado ? ' <strong>A consulta foi truncada</strong> — veio parte do total (' +
          esc(imp.origemApi.total) + ').' : ''), 'info') + '</div>' : '') +
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

    var p = A.novoProjeto({
      nome: o.nomeProjeto || 'Importado', grupo: o.grupo,
      /* de onde vieram estes registros — o laudo cita a fonte */
      origemDados: imp.origemApi
        ? { fonte: imp.origemApi.fonte, consultadoEm: imp.origemApi.consultadoEm, via: 'API' }
        : { fonte: imp.arquivo, consultadoEm: new Date().toISOString(), via: 'arquivo' }
    });
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
      /* Uma linha só, e o resto atrás de um <details>. O bloco anterior tinha
         quatro instruções abertas no meio do formulário e roubava a atenção
         do campo que importa. */
      (function () {
        var ex = exemploAbreviacao(mapaTx);
        return '<details class="dica-teclado nao-imprime">' +
          '<summary><kbd>Enter</kbd> lança · <kbd>↓</kbd><kbd>↑</kbd> escolhe · ' +
          '<kbd>Tab</kbd> vai pra quantidade</summary>' +
          '<div class="dica-mais">' +
          (ex ? '<span>Abreviar funciona: <code>' + esc(ex) + '</code></span>' +
                '<span>Quantidade no fim: <code>' + esc(ex) + ' 3</code></span>' : '') +
          '<span>Nome comum também busca.</span>' +
          '</div></details>' +
      '</div></div>';
      })() +

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

  /* Quatro atalhos, não oito: com oito a fileira ocupava duas linhas inteiras
     e competia visualmente com o próprio campo de digitação. Quatro cabem numa
     linha e cobrem o caso real — repetição da espécie que acabou de sair. */
  function atalhosHtml(u, mapaTx) {
    var ids = recentesDaUnidade(u, 4);
    if (!ids.length) return '';
    return '<div class="atalhos-cx nao-imprime"><span class="atalhos-rot">Repetir</span>' +
      '<div class="atalhos">' + ids.map(function (id) {
        var t = mapaTx[id];
        if (!t) return '';
        return '<button class="atalho" type="button" data-acao="atalho" data-taxon="' + esc(id) + '" ' +
          'title="Lançar 1 indivíduo de ' + esc(M.nomeCientifico(t)) + '">' +
          '<i class="cientifico">' + esc(M.nomeCientifico(t)) + '</i></button>';
      }).join('') + '</div></div>';
  }

  /* Exemplo de abreviação tirado de uma espécie REAL do catálogo em uso.
     Estava fixo em "cerd tho" (Cerdocyon thous, um mamífero) e aparecia
     dentro de um projeto de avifauna. */
  function exemploAbreviacao(mapaTx) {
    var chaves = Object.keys(mapaTx || {});
    for (var i = 0; i < chaves.length; i++) {
      var nome = M.nomeCientifico(mapaTx[chaves[i]]) || '';
      var partes = nome.split(/\s+/);
      if (partes.length >= 2 && partes[0].length >= 4 && partes[1].length >= 3) {
        return partes[0].slice(0, 4).toLowerCase() + ' ' + partes[1].slice(0, 3).toLowerCase();
      }
    }
    return null;
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
    ['btn-csv-taxons', 'btn-gbif-lote', 'btn-auto-lote'].forEach(function (id) {
      var b = $('#' + id); if (b) b.disabled = !estado.taxons.length;
    });

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
      cardAutoecologia() +
      cardListaOficial() +

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
        /* marca de divergência contra a lista oficial: é offline e instantânea,
           então dá para calcular a cada desenho sem custo nenhum */
        var lo = AE ? AE.conferirListaOficial(t) : null;
        return '<tr>' +
          '<td class="esq">' + nomeHtml(t, true) +
          (t.foraDoCatalogo ? ' <span class="tag tag-terra">fora do catálogo</span>' : '') +
          (lo && lo.grave ? ' <span class="tag tag-terra" title="' + esc(lo.texto) + '">lista oficial: ' +
            esc(lo.sugerido || lo.situacao) + '</span>' : '') + '</td>' +
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
          '<button class="btn btn-fantasma btn-pq" data-acao="auto-um" data-taxon="' + t.id + '" type="button" title="Preencher autoecologia a partir das fontes">' + icone('ico-varinha') + '</button>' +
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

  /* =======================================================================
     AUTOECOLOGIA AUTOMÁTICA — o botão de um clique

     Até aqui a GBIF só resolvia o NOME. Toda a autoecologia era digitada
     espécie por espécie, e era a maior perda de tempo do trabalho.

     A regra não muda: a máquina PROPÕE, ele DECIDE. Nada entra sem ele
     aceitar, campo já preenchido nunca é sobrescrito calado, e cada valor
     aceito guarda de onde veio e quando — que é o que sai no laudo.
     ==================================================================== */
  var autoRodando = false, autoCancelar = false;

  /** Todas as propostas pendentes do catálogo, achatadas para a tela. */
  function sugestoesPendentes() {
    var out = [];
    estado.taxons.forEach(function (t) {
      if (!t.sugestoes || !t.sugestoes.itens) return;
      t.sugestoes.itens.forEach(function (p, i) {
        if (p.decidido) return;
        if (p.tipo === 'confirma') return;   // nada a decidir: já está igual
        out.push({ taxon: t, p: p, i: i });
      });
    });
    return out;
  }

  function contarSugestoes() {
    var pend = sugestoesPendentes();
    var conta = { preenche: 0, diverge: 0, grafia: 0, atencao: 0, confirma: 0, total: pend.length };
    pend.forEach(function (x) { conta[x.p.tipo] = (conta[x.p.tipo] || 0) + 1; });
    estado.taxons.forEach(function (t) {
      ((t.sugestoes || {}).itens || []).forEach(function (p) {
        if (p.tipo === 'confirma') conta.confirma++;
      });
    });
    return conta;
  }

  function rotuloTipoSugestao(t) {
    return {
      preenche: 'campo em branco', diverge: 'diverge do que você preencheu',
      grafia: 'mesmo nome, outra grafia', atencao: 'atenção', confirma: 'confere'
    }[t] || t;
  }

  function cardAutoecologia() {
    var comSug = estado.taxons.filter(function (t) { return t.sugestoes; }).length;
    var c = contarSugestoes();
    var cob = AE.cobertura(estado.taxons, grupoDoCatalogo());
    var pend = sugestoesPendentes();

    var h = '<div class="card"><div class="card-titulo"><h2>Autoecologia automática</h2>' +
      '<span class="card-nota">' + comSug + ' de ' + estado.taxons.length + ' táxons consultados</span></div>' +

      '<p class="card-nota" style="margin-bottom:var(--e3)">Um clique consulta a <strong>GBIF</strong> ' +
      '(hierarquia completa, autoria, ano e nome comum em português), o <strong>iNaturalist</strong> ' +
      '(categoria de conservação) e a <strong>Lista Nacional</strong> embutida — e propõe o preenchimento. ' +
      '<strong>Nada é gravado sem você aceitar</strong>, e campo que você já preencheu nunca é ' +
      'sobrescrito sem ordem sua.</p>' +

      '<div class="gbif-barra" id="auto-barra">' +
      '<div class="progresso"><i id="auto-progresso" style="width:' +
      (estado.taxons.length ? (comSug / estado.taxons.length * 100) : 0) + '%"></i></div>' +
      '<span class="progresso-txt" id="auto-texto">' +
      (c.total ? c.total + (c.total === 1 ? ' sugestão' : ' sugestões') + ' aguardando decisão'
        : (comSug ? 'nenhuma sugestão pendente' : 'ainda não consultado')) +
      '</span>' +
      '<button class="btn btn-pq" data-acao="auto-lote" type="button">' + icone('ico-varinha') +
      (autoRodando ? ' Parar' : ' Preencher autoecologia') + '</button>' +
      '</div>' +

      '<div class="painel-num" style="margin-top:var(--e4)">' +
      numCx(pct(cob.perc, 0), 'campos preenchidos', fmt(cob.preenchidos, 0) + ' de ' + fmt(cob.total, 0)) +
      numCx(fmt(c.preenche, 0), 'a preencher', 'campos em branco') +
      numCx(fmt(c.diverge, 0), 'divergências', 'você × fonte', c.diverge > 0) +
      numCx(fmt(c.grafia, 0), 'grafia', 'mesmo nome, com hífen') +
      numCx(fmt(c.atencao, 0), 'atenção', 'decisão individual', c.atencao > 0) +
      numCx(fmt(c.confirma, 0), 'confirmados', 'fonte concorda') +
      '</div>';

    if (pend.length) {
      h += '<div class="acoes" style="margin-top:var(--e4)">' +
        (c.preenche ? '<button class="btn btn-pq" data-acao="auto-aceitar-vazios" type="button">' +
          icone('ico-check') + ' Aceitar os ' + c.preenche + ' campos em branco</button>' : '') +
        (c.grafia ? '<button class="btn btn-sec btn-pq" data-acao="auto-aceitar-grafia" type="button">' +
          icone('ico-check') + ' Adotar a grafia das fontes (' + c.grafia + ')</button>' : '') +
        /* "Aceitar todos" cobre campo em branco e grafia — nunca divergência.
           Divergir significa que já existe valor escrito pelo responsável
           técnico, e sobrescrever isso em lote troca "Papagaio de peito roxo"
           por "Leão-baio" sem ele ver. As divergências têm ação própria,
           porque entre elas está o achado que mais importa
           (Furariidae → Furnariidae). */
        (c.preenche + c.grafia ? '<button class="btn btn-sec btn-pq" data-acao="auto-aceitar-seguros" type="button">' +
          icone('ico-check') + ' Aceitar em branco e grafia (' + (c.preenche + c.grafia) + ')</button>' : '') +
        (c.diverge ? '<button class="btn btn-sec btn-pq" data-acao="auto-ir-divergencias" type="button">' +
          icone('ico-alerta') + ' Revisar ' + c.diverge + ' divergência' + (c.diverge === 1 ? '' : 's') +
          ' uma a uma</button>' : '') +
        '<button class="btn btn-fantasma btn-pq" data-acao="auto-recusar-todos" type="button">' +
        icone('ico-x') + ' Recusar tudo</button>' +
        '</div>' +
        (c.atencao ? '<div style="margin-top:var(--e3)">' + avisoHtml(
          '<strong>' + c.atencao + (c.atencao === 1 ? ' sugestão marcada' : ' sugestões marcadas') +
          ' como “atenção”</strong> fica' + (c.atencao === 1 ? '' : 'm') +
          ' de fora de qualquer decisão em lote: é categoria de autoridade que não é a IUCN, espécie que a ' +
          'lista oficial só traz como subespécie, ou troca de gênero — que mudaria o nome científico. ' +
          'Cada uma pede decisão individual.') + '</div>' : '') +
        (filtroSugestao
          ? '<div class="acoes" style="margin-top:var(--e4)"><span class="tag tag-terra">Mostrando só as ' +
            (pend.filter(function (x) { return x.p.tipo === filtroSugestao; }).length) +
            ' divergências</span>' +
            '<button class="btn btn-fantasma btn-pq" data-acao="auto-limpar-filtro" type="button">' +
            'Ver todas as sugestões</button></div>'
          : '') +
        tabelaSugestoes(filtroSugestao
          ? pend.filter(function (x) { return x.p.tipo === filtroSugestao; })
          : pend);
    } else if (comSug) {
      h += '<div style="margin-top:var(--e4)">' + avisoHtml(
        'Nenhuma sugestão pendente. Tudo o que as fontes propuseram já foi decidido por você.', 'info') + '</div>';
    }

    /* O QUE A FONTE NÃO TEM. Silêncio de API é fácil de confundir com dado:
       o iNaturalist só publica `conservation_status` para quem NÃO é LC, e
       um app que traduzisse essa ausência em "LC" estaria inventando
       categoria de conservação no laudo. */
    if (comSug) {
      var semIucn = estado.taxons.filter(function (t) {
        return t.sugestoes && !((t.sugestoes.itens || []).some(function (p) {
          return p.chave === 'iucn' && p.sugerido;
        }));
      }).length;
      if (semIucn) {
        h += '<div style="margin-top:var(--e3)">' + avisoHtml(
          '<strong>' + semIucn + ' de ' + comSug + ' táxons voltaram sem categoria IUCN.</strong> ' +
          'O iNaturalist só publica a categoria de quem <em>não</em> é “pouco preocupante” — ' +
          'ausência de resposta <strong>não quer dizer LC</strong>, quer dizer que não há registro. ' +
          'Se o laudo precisa da coluna IUCN preenchida, ela vai ter que ser digitada.', 'info') + '</div>';
      }
    }

    /* falhas: dizer QUAL fonte não respondeu, não um “erro” genérico */
    var falhas = {};
    estado.taxons.forEach(function (t) {
      ((t.sugestoes || {}).falhas || []).forEach(function (f) {
        falhas[f.fonte] = (falhas[f.fonte] || 0) + 1;
      });
    });
    var kf = Object.keys(falhas);
    if (kf.length) {
      h += '<div style="margin-top:var(--e3)" class="avisos-pilha">' + kf.map(function (k) {
        return avisoHtml('<strong>' + esc(k) + '</strong> não respondeu em ' + falhas[k] +
          ' táxon(s). O que as outras fontes trouxeram está aqui; rode de novo quando houver rede.');
      }).join('') + '</div>';
    }

    return h + '</div>';
  }

  function tabelaSugestoes(pend) {
    var TETO = 200;
    var mostra = pend.slice(0, TETO);
    return '<div class="tabela-envolve" style="margin-top:var(--e4)"><table class="tabela"><thead><tr>' +
      '<th class="esq">Espécie</th><th class="esq">Campo</th><th class="esq">Valor atual</th>' +
      '<th class="esq">Proposto</th><th class="esq">Fonte e data da consulta</th><th></th>' +
      '</tr></thead><tbody>' +
      mostra.map(function (x) {
        var p = x.p;
        var classe = p.tipo === 'diverge' ? ' tag-terra' : (p.tipo === 'atencao' ? ' tag-terra' : '');
        return '<tr>' +
          '<td class="esq">' + nomeHtml(x.taxon) + '</td>' +
          '<td class="esq">' + esc(p.rotulo) +
          '<br><span class="tag' + classe + '" style="margin-top:3px">' + esc(rotuloTipoSugestao(p.tipo)) + '</span></td>' +
          '<td class="esq">' + (p.atual
            ? '<span class="div-de">' + esc(p.atual) + '</span>'
            : '<span style="color:var(--texto-3)">(em branco)</span>') + '</td>' +
          '<td class="esq"><span class="div-para">' + esc(p.sugerido || '—') + '</span></td>' +
          /* o `div` não é enfeite: `max-width` num `td` de tabela auto é
             ignorado pelo algoritmo de largura de coluna, e a nota saía
             cortada na borda do rolamento */
          '<td class="esq"><div class="cel-fonte">' + esc(p.fonte || '—') +
          (p.consultadoEm ? '<br><span class="cel-fonte-data">consultado em ' +
            esc(dataBR(p.consultadoEm)) + '</span>' : '') +
          (p.nota ? '<br><span class="cel-fonte-nota">' + esc(p.nota) + '</span>' : '') +
          '</div></td>' +
          '<td class="acoes-cel">' +
          '<button class="btn btn-pq" data-acao="sug-aceitar" data-taxon="' + x.taxon.id + '" data-i="' + x.i + '" type="button" title="Aceitar">' + icone('ico-check') + '</button>' +
          '<button class="btn btn-sec btn-pq" data-acao="sug-recusar" data-taxon="' + x.taxon.id + '" data-i="' + x.i + '" type="button" title="Recusar">' + icone('ico-x') + '</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (pend.length > TETO ? '<p class="card-nota" style="margin-top:6px">Mostrando ' + TETO +
        ' de ' + pend.length + ' sugestões. Decida estas e as próximas aparecem.</p>' : '');
  }

  function guardarSugestoes(res) {
    var t = res.taxon;
    /* Sugestão de campo que já tem divergência da GBIF esperando decisão sai
       daqui: seria a mesma pergunta feita duas vezes, em duas telas. */
    var pendentesGbif = {};
    ((t.gbif && t.gbif.divergencias) || []).forEach(function (d) {
      if (!d.decidido) pendentesGbif[d.chave] = 1;
    });

    /* Decisão que ele já tomou não volta a ser perguntada. */
    var jaDecidido = {};
    ((t.sugestoes || {}).itens || []).forEach(function (p) {
      if (p.decidido) jaDecidido[p.alvo + ':' + p.chave + ':' + p.sugerido] = p.decidido;
    });

    var itens = res.propostas.filter(function (p) {
      return !(p.alvo === 'taxon' && pendentesGbif[p.chave]);
    });
    itens.forEach(function (p) {
      var d = jaDecidido[p.alvo + ':' + p.chave + ':' + p.sugerido];
      if (d) p.decidido = d;
    });

    t.sugestoes = { em: res.consultadoEm, itens: itens, falhas: res.falhas };
    A.salvar();
  }

  function decidirSugestao(taxonId, i, aceitar) {
    var t = A.acharTaxon(taxonId);
    if (!t || !t.sugestoes || !t.sugestoes.itens[i]) return;
    var p = t.sugestoes.itens[i];
    if (aceitar) AE.aplicar(t, p);
    p.decidido = aceitar ? 'aceita' : 'recusada';
    A.salvar();
    renderTaxons();
    toast(aceitar
      ? p.rotulo + ' de ' + M.nomeCientifico(t) + ': preenchido com “' + p.sugerido + '”.'
      : 'Sugestão recusada — o dado continua como estava.');
  }

  /* Filtro da tabela de sugestões. Fica fora do estado salvo de propósito:
     é escolha de visualização do momento, não dado do projeto. */
  var filtroSugestao = null;

  function irParaDivergencias() {
    filtroSugestao = 'diverge';
    renderTaxons();
    var t = document.querySelector('#tela-taxons .tabela-envolve');
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Divergência é onde já existe valor escrito por você — por isso vai uma a uma.');
  }

  function limparFiltroSugestao() {
    filtroSugestao = null;
    renderTaxons();
  }

  function decidirEmLote(tipos, aceitar) {
    var n = 0;
    estado.taxons.forEach(function (t) {
      ((t.sugestoes || {}).itens || []).forEach(function (p) {
        if (p.decidido || p.tipo === 'confirma') return;
        if (tipos.indexOf(p.tipo) < 0) return;
        if (aceitar) AE.aplicar(t, p);
        p.decidido = aceitar ? 'aceita' : 'recusada';
        n++;
      });
    });
    A.salvar();
    renderTaxons();
    toast(aceitar ? n + ' campo(s) preenchido(s) a partir das fontes.'
      : n + ' sugestão(ões) recusada(s) — nada mudou no seu dado.');
  }

  function autoUm(taxonId) {
    var t = A.acharTaxon(taxonId);
    if (!t) return;
    toast('Consultando GBIF, iNaturalist e a lista oficial…');
    AE.consultarTaxon(t).then(function (res) {
      guardarSugestoes(res);
      renderTaxons();
      var pend = res.propostas.filter(function (p) { return !p.decidido && p.tipo !== 'confirma'; }).length;
      if (res.offline) {
        toast('Sem conexão. O cruzamento com a lista oficial (que é offline) foi feito; o resto fica para depois.');
      } else {
        toast(M.nomeCientifico(t) + ': ' + (pend ? pend + ' sugestão(ões) para decidir.' : 'nada a propor — já está completo.'));
      }
    });
  }

  function autoLote() {
    if (autoRodando) { autoCancelar = true; return; }
    var lista = estado.taxons.slice();
    if (!lista.length) return;
    autoRodando = true; autoCancelar = false;
    renderTaxons();

    var barra = $('#auto-progresso'), txt = $('#auto-texto');

    AE.consultarLote(lista, function (feito, total, res) {
      guardarSugestoes(res);
      if (barra) barra.style.width = (feito / total * 100) + '%';
      if (txt) txt.textContent = feito + ' de ' + total + ' — ' + M.nomeCientifico(res.taxon);
    }, function () { return autoCancelar; }).then(function (saida) {
      autoRodando = false;
      var offline = saida.some(function (x) { return x.offline; });
      renderTaxons();
      var c = contarSugestoes();
      if (offline) {
        toast('A rede caiu. O que já foi consultado está salvo, e o cruzamento com a lista oficial ' +
          'continua funcionando — ele é offline.');
      } else if (autoCancelar) {
        toast('Interrompido. O que já foi consultado está salvo.');
      } else {
        toast('Pronto: ' + saida.length + ' táxons consultados, ' + c.total + ' sugestão(ões) para você decidir.');
      }
    }).catch(function (e) {
      autoRodando = false;
      renderTaxons();
      toast('Falha ao preencher: ' + e.message);
    });
  }

  /* =======================================================================
     LISTA NACIONAL — cruzamento automático e OFFLINE

     É o de maior valor legal e o que não depende de rede nenhuma: a lista
     está embutida. Roda sozinho toda vez que a tela desenha, ou seja, assim
     que um táxon entra no catálogo.
     ==================================================================== */
  function cardListaOficial() {
    if (!LO || !AE) return '';
    var cr = AE.cruzarListaOficial(estado.taxons);

    /* pendentes = ainda não decididas por ele */
    var pend = cr.divergencias.filter(function (x) {
      var d = x.taxon.listaOficial;
      return !(d && d.situacao === x.situacao && d.sugerido === x.sugerido);
    });

    /* O NÚMERO QUE PEGA O ERRO: quantas o catálogo declara ameaçadas na
       Portaria, contra quantas a lista oficial diz que são. Na planilha de
       origem o resumo declarava "Ameaçada BR: 0" — e o certo era 1. */
    var declaradas = estado.taxons.filter(function (t) {
      return D.ehAmeaca((t.atributos || {}).listaNacional);
    }).length;
    var oficiais = cr.ameacadasOficial.length;

    var h = '<div class="card"><div class="card-titulo">' +
      '<h2>Lista Nacional de Espécies Ameaçadas</h2>' +
      '<span class="card-nota">cruzamento automático · funciona sem internet</span></div>' +

      '<div class="painel-num">' +
      numCx(fmt(cr.naLista.length, 0), 'na lista oficial', 'de ' + fmt(estado.taxons.length, 0) + ' táxons') +
      numCx(fmt(oficiais, 0), 'ameaçadas (oficial)', 'VU, EN, CR, RE, EW, EX', oficiais > 0) +
      numCx(fmt(declaradas, 0), 'ameaçadas (catálogo)', 'coluna Portaria MMA', declaradas !== oficiais) +
      numCx(fmt(cr.subespecies.length, 0), 'só a subespécie', 'não conta como ameaçada') +
      numCx(fmt(pend.length, 0), 'divergências', 'aguardando decisão', pend.length > 0) +
      '</div>';

    if (cr.subespecies.length) {
      h += '<div style="margin-top:var(--e4)">' + avisoHtml(
        '<strong>' + cr.subespecies.length + (cr.subespecies.length === 1
          ? ' espécie aparece na lista oficial apenas como subespécie'
          : ' espécies aparecem na lista oficial apenas como subespécie') + '</strong> — ' +
        cr.subespecies.map(function (x) {
          return '<i>' + esc(M.nomeCientifico(x.taxon)) + '</i>';
        }).join(', ') + '. A lista protege a subespécie, não a espécie inteira, então elas ' +
        '<strong>não</strong> entram na conta de ameaçadas. Se a população levantada for dessa ' +
        'subespécie, preencha à mão — a decisão é sua.', 'info') + '</div>';
    }

    if (declaradas !== oficiais) {
      h += '<div style="margin-top:var(--e4)">' + avisoHtml(
        '<strong>O catálogo declara ' + declaradas + ' espécie' + (declaradas === 1 ? '' : 's') +
        ' ameaçada' + (declaradas === 1 ? '' : 's') + ' na Portaria do MMA, e a lista oficial aponta ' +
        oficiais + '.</strong> Um laudo que informa o número errado de espécies ameaçadas é ' +
        'passivo — resolva as divergências abaixo antes de assinar.') + '</div>';
    }

    if (pend.length) {
      h += '<div class="tabela-envolve" style="margin-top:var(--e4)"><table class="tabela"><thead><tr>' +
        '<th class="esq">Espécie</th><th class="esq">No catálogo</th><th class="esq">Na lista oficial</th>' +
        '<th class="esq">O que isso quer dizer</th><th></th></tr></thead><tbody>' +
        pend.map(function (x) {
          var podeAplicar = x.situacao === 'faltando' || x.situacao === 'diferente';
          return '<tr>' +
            '<td class="esq">' + nomeHtml(x.taxon) +
            (x.oficial ? '<br><span class="taxon-sup" style="font-size:.76rem;color:var(--texto-3)">' +
              esc(x.oficial.familia || '') + ' · ' + esc(x.oficial.grupo || '') + '</span>' : '') + '</td>' +
            '<td class="esq">' + (x.atual
              ? '<span class="tag tag-terra">' + esc(x.atual) + '</span>'
              : '<span style="color:var(--texto-3)">(em branco)</span>') + '</td>' +
            '<td class="esq">' + (x.sugerido
              ? '<span class="tag tag-verde">' + esc(x.sugerido) + '</span>' +
                (x.oficial && x.oficial.ano ? ' <span style="color:var(--texto-3);font-size:.78rem">' + x.oficial.ano + '</span>' : '')
              : '<span style="color:var(--texto-3)">não consta como espécie</span>') + '</td>' +
            '<td class="esq"><div class="cel-fonte">' + esc(x.texto) + '</div></td>' +
            '<td class="acoes-cel">' +
            (podeAplicar
              ? '<button class="btn btn-pq" data-acao="lo-aceitar" data-taxon="' + x.taxon.id + '" type="button" title="Preencher com a categoria oficial">' + icone('ico-check') + '</button>'
              : '') +
            '<button class="btn btn-sec btn-pq" data-acao="lo-recusar" data-taxon="' + x.taxon.id + '" type="button" title="' +
            (podeAplicar ? 'Recusar' : 'Já vi, não mexer') + '">' + icone('ico-x') + '</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } else if (cr.naLista.length) {
      h += '<div style="margin-top:var(--e4)">' + avisoHtml(
        'Nenhuma divergência pendente contra a lista oficial.', 'info') + '</div>';
    } else {
      h += '<div style="margin-top:var(--e4)">' + avisoHtml(
        'Nenhum táxon do catálogo consta da lista oficial embutida.', 'info') + '</div>';
    }

    /* As duas honestidades obrigatórias, na própria tela onde o dado aparece */
    h += '<div class="avisos-pilha" style="margin-top:var(--e4)">' +
      avisoHtml('<strong>Fonte:</strong> ' + esc(LO.FONTE.nome) + ' — ' + esc(LO.FONTE.portal) +
        ', ' + esc(LO.FONTE.orgao) + '. ' + esc(LO.FONTE.taxons) + ' táxons, licença ' +
        esc(LO.FONTE.licenca) + '. Convertida em ' + esc(dataBR(LO.FONTE.convertidoEm)) + '. ' +
        '<strong>' + esc(LO.FONTE.limitacao) + '</strong>') +
      avisoHtml('<strong>Listas estaduais:</strong> ' + esc(LO.ESTADUAIS.nota)) +
      '</div></div>';
    return h;
  }

  function decidirListaOficial(taxonId, aceitar) {
    var t = A.acharTaxon(taxonId);
    if (!t) return;
    var x = AE.conferirListaOficial(t);
    if (aceitar && x.sugerido) {
      AE.aplicar(t, {
        chave: 'listaNacional', alvo: 'atributo', sugerido: x.sugerido,
        fonte: 'Lista Nacional (MMA) · reavaliação 2021',
        consultadoEm: LO.FONTE.convertidoEm
      });
      /* reconfere: depois de aplicar, a situação vira 'confere' */
      t.listaOficial = { situacao: 'confere', sugerido: x.sugerido, em: new Date().toISOString(), decisao: 'aceita' };
    } else {
      t.listaOficial = { situacao: x.situacao, sugerido: x.sugerido, em: new Date().toISOString(), decisao: 'recusada' };
    }
    A.salvar();
    renderTaxons();
    toast(aceitar
      ? M.nomeCientifico(t) + ': Portaria MMA preenchida com ' + x.sugerido + '.'
      : 'Anotado. O dado continua como estava e a divergência não volta a perguntar.');
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
     TELA 6 — DADOS SECUNDÁRIOS

     Substitui a garimpagem bibliográfica. Na planilha, a aba `Outros` trazia
     UMA referência digitada à mão; aqui vem a lista inteira do que já foi
     publicado na região, direto da GBIF, com o filtro e a data guardados
     para o laudo poder citar a fonte.
     ==================================================================== */
  var secRodando = false, secCancelar = false, secProgresso = '';

  function paramsSecundarios(p) {
    var g = (p.secundariosGbif && p.secundariosGbif.filtro) || {};
    var centro = SEC.centroDoProjeto(p);
    return {
      lat: g.lat !== undefined && g.lat !== null ? g.lat : (centro ? centro.lat : ''),
      lon: g.lon !== undefined && g.lon !== null ? g.lon : (centro ? centro.lon : ''),
      raioKm: g.raioKm || 20,
      grupo: g.grupo || p.grupo || 'aves',
      centro: centro
    };
  }

  function renderSecundarios() {
    var at = A.ativos();
    var alvo = $('#secundarios-conteudo');
    if (!at.projeto) {
      alvo.innerHTML = vazioHtml('Nenhum projeto aberto',
        'Escolha um projeto para levantar os dados secundários da região dele.',
        '<a class="btn" href="#projetos">Ir para Projetos</a>');
      $('#sub-secundarios').textContent =
        'O que a literatura já registrou na região, direto da GBIF.';
      return;
    }
    var p = at.projeto;
    $('#sub-secundarios').textContent = p.nome + ' · ' + (p.municipio || '—') + (p.uf ? '/' + p.uf : '');

    var par = paramsSecundarios(p);
    var sg = p.secundariosGbif || null;

    var h = trilha(1) +
      '<div class="card"><div class="card-titulo"><h2>Buscar na GBIF</h2>' +
      '<span class="card-nota">sem chave, sem cadastro</span></div>' +
      '<p class="card-nota" style="margin-bottom:var(--e4)">A busca é por <strong>raio em volta de um ponto</strong> ' +
      '(<code>geoDistance</code>) e por <strong>classe do grupo do projeto</strong>. A chave numérica da classe é ' +
      'perguntada à própria GBIF — não está cravada no código.</p>' +

      '<div class="grade grade-4">' +
      '<div class="campo"><label for="sec-lat">Latitude</label>' +
      '<input id="sec-lat" type="text" inputmode="decimal" value="' + esc(par.lat) + '" placeholder="-20,3778"></div>' +
      '<div class="campo"><label for="sec-lon">Longitude</label>' +
      '<input id="sec-lon" type="text" inputmode="decimal" value="' + esc(par.lon) + '" placeholder="-43,4161"></div>' +
      '<div class="campo"><label for="sec-raio">Raio</label>' +
      '<div class="campo-unidade"><input id="sec-raio" type="number" step="any" min="1" value="' + esc(par.raioKm) + '">' +
      '<span class="sufixo">km</span></div></div>' +
      '<div class="campo"><label for="sec-grupo">Grupo faunístico</label><select id="sec-grupo">' +
      D.GRUPOS.map(function (g) {
        var cls = (g.classesGbif || []).join(' + ');
        return '<option value="' + g.chave + '"' + (par.grupo === g.chave ? ' selected' : '') + '>' +
          esc(g.rotulo) + (cls && cls !== g.rotulo ? ' — ' + esc(cls) : '') + '</option>';
      }).join('') + '</select></div>' +
      '</div>' +

      (par.centro
        ? '<p class="card-nota" style="margin-top:var(--e2)">Ponto sugerido: média das coordenadas de ' +
          par.centro.unidades + ' unidade(s) amostral(is) deste projeto.</p>'
        : (sg
            ? '<p class="card-nota" style="margin-top:var(--e2)">Ponto digitado por você — nenhuma unidade ' +
              'amostral deste projeto tem coordenada preenchida.</p>'
            : '<div style="margin-top:var(--e3)">' + avisoHtml(
                'Nenhuma unidade amostral tem coordenada preenchida, então <strong>não há de onde tirar o ponto</strong> — ' +
                'digite a latitude e a longitude da área. O app não chuta a coordenada do município.') + '</div>')) +

      '<div class="acoes" style="margin-top:var(--e4)">' +
      '<button class="btn" data-acao="sec-buscar" type="button">' + icone('ico-lupa') +
      (secRodando ? ' Parar' : ' Buscar ocorrências') + '</button>' +
      (sg ? '<button class="btn btn-sec" data-acao="sec-atualizar" type="button">' + icone('ico-globo') +
        ' Refazer sem usar o cache</button>' : '') +
      '</div>' +
      (secRodando ? '<div class="gbif-barra" style="margin-top:var(--e3)">' +
        '<div class="progresso"><i id="sec-progresso" style="width:0%"></i></div>' +
        '<span class="progresso-txt" id="sec-texto">' + esc(secProgresso || 'consultando…') + '</span></div>' : '') +
      '</div>';

    if (!sg) {
      h += '<div class="card">' + vazioHtml('Nenhum levantamento secundário ainda',
        'Confirme o ponto e o raio acima e clique em <strong>Buscar ocorrências</strong>. ' +
        'A GBIF devolve o que já foi publicado na região; o app cruza com o seu levantamento de campo ' +
        'e separa em <strong>exclusivas do primário</strong>, <strong>em comum</strong> e ' +
        '<strong>esperadas para a região mas não detectadas</strong>.') + '</div>';
      alvo.innerHTML = h;
      ligarSecundarios();
      return;
    }

    /* ---------------------------------------------------- o que voltou */
    var f = sg.filtro || {};
    h += '<div class="card"><div class="card-titulo"><h2>O que a GBIF tem nesta área</h2>' +
      '<span class="card-nota">consultado em ' + esc(dataHoraBR(sg.consultadoEm)) + '</span></div>' +
      '<div class="painel-num">' +
      numCx(fmt(sg.ocorrencias, 0), 'ocorrências', 'com coordenada') +
      numCx(fmt(sg.especies.length, 0), 'espécies', 'resolvidas em nome') +
      numCx(fmt(f.raioKm, 0) + ' km', 'raio', 'em volta do ponto') +
      numCx(esc((f.classes || []).join(' + ') || 'todas'), 'classe', 'filtro de grupo') +
      '</div>' +
      '<p class="card-nota fonte" style="margin-top:var(--e3)"><strong>Filtro exato usado</strong> — ' +
      'geoDistance ' + esc(f.lat) + ', ' + esc(f.lon) + ', ' + esc(f.raioKm) + ' km · ' +
      'taxonKey ' + esc((f.taxonKeys || []).join(', ') || '—') + ' · hasCoordinate=true · ' +
      'facet=speciesKey (até ' + esc(f.limiteEspecies) + '). Fonte: ' + esc(sg.fonte) + '. ' +
      'É esta linha que vai na citação do laudo.</p>' +
      (sg.naoResolvidas ? '<div style="margin-top:var(--e3)">' + avisoHtml(
        sg.naoResolvidas + ' chave(s) de espécie não puderam ser resolvidas em nome e ficaram de fora.') + '</div>' : '') +
      (sg.parcial ? '<div style="margin-top:var(--e3)">' + avisoHtml(
        'A resolução dos nomes foi <strong>interrompida</strong> — a lista está incompleta. Rode de novo.') + '</div>' : '') +
      '</div>';

    /* ------------------------------------------------------ cruzamento */
    var mapaTx = A.taxonsPorId();
    var prim = [];
    p.campanhas.forEach(function (c) {
      c.unidades.forEach(function (u) {
        (u.registros || []).forEach(function (r) {
          var t = mapaTx[r.taxonId];
          if (t) prim.push(M.nomeCientifico(t));
        });
      });
    });
    var cz = SEC.cruzar(prim, sg.especies);

    h += '<div class="card"><div class="card-titulo"><h2>Primários × secundários</h2>' +
      '<span class="card-nota">' + fmt(cz.riquezaPrimaria, 0) + ' em campo · ' +
      fmt(cz.riquezaSecundaria, 0) + ' na região</span></div>' +
      '<div class="painel-num">' +
      numCx(fmt(cz.soPrimario.length, 0), 'só no primário', 'o que o campo achou e a região não tinha') +
      numCx(fmt(cz.comuns.length, 0), 'em comum', 'corroboradas') +
      numCx(fmt(cz.esperadas.length, 0), 'esperadas não detectadas', 'a região tem, o campo não pegou', cz.esperadas.length > 0) +
      numCx(pct(cz.cobertura, 0), 'cobertura', 'do que a região tem') +
      numCx(pct(cz.jaccard, 0), 'Jaccard', 'similaridade das listas') +
      '</div>' +

      '<div class="avisos-pilha" style="margin-top:var(--e4)">' + avisoHtml(
        'A terceira lista é a que dá argumento ao laudo: <strong>' + cz.esperadas.length +
        ' espécie(s) já registrada(s) nesta área não apareceram no levantamento</strong>. ' +
        'Ou o esforço foi insuficiente, ou elas deixaram a área — as duas conclusões são do laudo, ' +
        'e as duas precisam ser escritas por você, não pelo app.', 'info') +
      /* Armadilha real: o cruzamento é por NOME. Um sinônimo não resolvido no
         catálogo não casa com o nome aceito da GBIF e aparece como exclusivo
         do primário — parecendo achado quando é erro de nomenclatura. */
      avisoHtml('O cruzamento é <strong>por nome científico</strong>. Espécie que ainda está no ' +
        'catálogo com um <strong>sinônimo</strong> não casa com o nome aceito na GBIF e cai em ' +
        '“exclusivas do primário” parecendo um achado. Rode a <strong>Conferência taxonômica</strong> ' +
        'em Táxons antes de levar esta comparação para o laudo.') + '</div>' +

      tabelaCruzamento('Esperadas para a região e não detectadas', cz.esperadas, true) +
      tabelaCruzamento('Em comum', cz.comuns, true) +
      tabelaCruzamento('Exclusivas do levantamento primário', cz.soPrimario, false) +
      '</div>';

    /* ----------------------------------- a lista bibliográfica manual */
    var sec = (p.secundarios && p.secundarios.especies) || [];
    h += '<div class="card"><div class="card-titulo"><h2>Lista bibliográfica digitada</h2>' +
      '<button class="btn btn-sec btn-pq" data-acao="editar-secundarios" type="button">' +
      icone('ico-lapis') + ' Editar lista</button></div>' +
      '<p class="card-nota">A comparação com a GBIF acima não substitui uma referência específica da área. ' +
      'Esta lista continua aqui para quando houver um levantamento publicado que valha citar nominalmente.</p>' +
      (sec.length ? '<p class="card-nota" style="margin-top:var(--e2)">' + fmt(sec.length, 0) +
        ' espécie(s) digitada(s)' + (p.secundarios.titulo ? ' — ' + esc(p.secundarios.titulo) : '') + '.</p>' : '');
    h += '</div>';

    alvo.innerHTML = h;
    ligarSecundarios();
  }

  function tabelaCruzamento(titulo, lista, comOcorrencias) {
    if (!lista.length) return '<h3 style="margin-top:var(--e5);margin-bottom:var(--e2)">' + esc(titulo) +
      ' (0)</h3><div class="grafico-vazio">Nenhuma.</div>';
    var TETO = 400;
    return '<h3 style="margin-top:var(--e5);margin-bottom:var(--e2)">' + esc(titulo) + ' (' + lista.length + ')</h3>' +
      '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
      '<th class="esq">Espécie</th><th class="esq">Ordem</th><th class="esq">Família</th>' +
      (comOcorrencias ? '<th>Ocorrências na GBIF</th>' : '') + '</tr></thead><tbody>' +
      lista.slice(0, TETO).map(function (e) {
        return '<tr><td class="esq"><i class="cientifico">' + esc(e.nome) + '</i></td>' +
          '<td class="esq taxon-sup">' + esc(e.ordem || '—') + '</td>' +
          '<td class="esq taxon-sup">' + esc(e.familia || '—') + '</td>' +
          (comOcorrencias ? '<td>' + (e.ocorrencias === null || e.ocorrencias === undefined ? '—' : fmt(e.ocorrencias, 0)) + '</td>' : '') +
          '</tr>';
      }).join('') + '</tbody></table></div>' +
      (lista.length > TETO ? '<p class="card-nota" style="margin-top:6px">Mostrando ' + TETO + ' de ' + lista.length + '.</p>' : '');
  }

  function ligarSecundarios() {
    ['sec-lat', 'sec-lon', 'sec-raio', 'sec-grupo'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.addEventListener('change', function () { /* lido na hora de buscar */ });
    });
  }

  function lerParamsSecundarios() {
    function n(id) {
      var el = $('#' + id);
      return el ? parseFloat(String(el.value).replace(',', '.')) : NaN;
    }
    var g = $('#sec-grupo');
    return {
      lat: n('sec-lat'), lon: n('sec-lon'), raioKm: n('sec-raio') || 20,
      grupo: g ? g.value : grupoDoProjeto()
    };
  }

  function buscarSecundarios(semCache) {
    if (secRodando) { secCancelar = true; return; }
    var at = A.ativos();
    if (!at.projeto) return;
    var par = lerParamsSecundarios();
    if (!isFinite(par.lat) || !isFinite(par.lon)) {
      toast('Preencha a latitude e a longitude da área. Sem ponto não há raio.');
      return;
    }
    secRodando = true; secCancelar = false; secProgresso = 'descobrindo a chave da classe na GBIF…';
    renderSecundarios();

    SEC.levantar({
      lat: par.lat, lon: par.lon, raioKm: par.raioKm, grupo: par.grupo, semCache: !!semCache
    }, function (etapa, feitas, total) {
      var barra = $('#sec-progresso'), txt = $('#sec-texto');
      if (etapa === 'especies') {
        secProgresso = 'resolvendo nomes: ' + feitas + ' de ' + total;
        if (barra) barra.style.width = (total ? feitas / total * 100 : 0) + '%';
      } else if (etapa === 'ocorrencias') {
        secProgresso = 'contando ocorrências na área…';
      }
      if (txt) txt.textContent = secProgresso;
    }, function () { return secCancelar; }).then(function (res) {
      secRodando = false;
      if (!res.ok) {
        renderSecundarios();
        toast(res.offline
          ? 'Sem conexão com a GBIF. O resto do app continua funcionando; a busca fica para depois.'
          : ('Falha na busca: ' + res.erro));
        return;
      }
      A.atualizarProjeto(at.projeto.id, { secundariosGbif: res });
      estado = A.obter();
      renderSecundarios();
      toast(fmt(res.ocorrencias, 0) + ' ocorrências e ' + res.especies.length +
        ' espécies na área' + (res.doCache ? ' (do cache)' : '') + '.');
    }).catch(function (e) {
      secRodando = false;
      renderSecundarios();
      toast('Falha na busca: ' + e.message);
    });
  }

  /* =======================================================================
     TELA 7 — RESULTADOS
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
      cruzamentoOficialHtml(registrados) +
      /* os avisos são constantes nossas e já trazem marcação — escapar aqui
         mostraria as tags na tela */
      '<div style="margin-top:var(--e4)" class="avisos-pilha">' +
      D.AVISOS_LEGAIS.map(function (a) { return avisoHtml(a); }).join('') + '</div>' +
      '</div>';
  }

  /**
   * O cruzamento com a Lista Nacional, do jeito que precisa aparecer em
   * Resultados: o número que o catálogo declara contra o número que a lista
   * oficial diz. Foi exatamente aqui que a planilha de origem errou —
   * declarava "Ameaçada BR: 0" com uma espécie VU na lista.
   */
  function cruzamentoOficialHtml(registrados) {
    if (!AE || !LO) return '';
    var cr = AE.cruzarListaOficial(registrados);
    var declaradas = registrados.filter(function (t) {
      return D.ehAmeaca((t.atributos || {}).listaNacional);
    }).length;
    var oficiais = cr.ameacadasOficial.length;
    if (!cr.naLista.length && !declaradas) return '';

    var h = '<h3 style="margin-top:var(--e5);margin-bottom:var(--e2)">Conferência contra a Lista Nacional</h3>';

    if (declaradas !== oficiais) {
      h += avisoHtml('<strong>Divergência: o catálogo declara ' + declaradas +
        ' espécie(s) ameaçada(s) na Portaria do MMA e a lista oficial aponta ' + oficiais + '.</strong> ' +
        'Resolva em <strong>Táxons</strong> antes de gerar o laudo — número errado de espécie ameaçada ' +
        'em documento oficial é passivo.');
    } else if (oficiais) {
      h += avisoHtml('O catálogo e a lista oficial concordam: ' + oficiais +
        ' espécie(s) ameaçada(s) na Portaria do MMA.', 'info');
    }

    if (cr.naLista.length) {
      h += '<div class="tabela-envolve" style="margin-top:var(--e3)"><table class="tabela"><thead><tr>' +
        '<th class="esq">Espécie</th><th class="esq">Catálogo</th><th class="esq">Lista oficial</th>' +
        '<th class="esq">Situação</th></tr></thead><tbody>' +
        cr.naLista.map(function (x) {
          return '<tr><td class="esq">' + nomeHtml(x.taxon) + '</td>' +
            '<td class="esq">' + (x.atual ? esc(x.atual) : '<span style="color:var(--texto-3)">—</span>') + '</td>' +
            '<td class="esq">' + (x.oficial ? esc(x.oficial.categoria) + ' <span style="color:var(--texto-3);font-size:.8rem">(' +
              x.oficial.ano + ')</span>' : '—') + '</td>' +
            '<td class="esq"><span class="tag' + (x.grave ? ' tag-terra' : ' tag-verde') + '">' +
            esc({ confere: 'confere', faltando: 'falta preencher', diferente: 'diverge',
              subespecie: 'só a subespécie consta', naoConsta: 'não consta' }[x.situacao] || x.situacao) +
            '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return h;
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
    /* GBIF: o levantamento secundário da região inteira */
    var sg = p.secundariosGbif;
    if (sg && sg.especies && sg.especies.length) {
      var cz = SEC.cruzar(prim, sg.especies);
      var f = sg.filtro || {};
      h += '<div class="card"><div class="card-titulo"><h2>Primários × secundários (GBIF)</h2>' +
        '<a class="btn btn-sec btn-pq" href="#secundarios">Abrir a tela</a></div>' +
        '<p class="card-nota" style="margin-bottom:var(--e3)">Ocorrências publicadas num raio de ' +
        fmt(f.raioKm, 0) + ' km em volta de ' + esc(f.lat) + ', ' + esc(f.lon) +
        ((f.classes || []).length ? ' · classe ' + esc(f.classes.join(' + ')) : '') +
        ' · consultado em ' + esc(dataHoraBR(sg.consultadoEm)) + '.</p>' +
        '<div class="painel-num">' +
        numCx(fmt(cz.soPrimario.length, 0), 'só no primário') +
        numCx(fmt(cz.comuns.length, 0), 'em comum') +
        numCx(fmt(cz.esperadas.length, 0), 'esperadas não detectadas', '', cz.esperadas.length > 0) +
        numCx(pct(cz.cobertura, 0), 'cobertura da região') +
        '</div>' +
        '<div class="grade grade-2" style="margin-top:var(--e4)">' +
        blocoEspecies('Exclusivas do primário', cz.soPrimario.map(function (e) { return e.nome; })) +
        blocoEspecies('Esperadas para a região e não detectadas (as 40 mais registradas)',
          cz.esperadas.slice(0, 40).map(function (e) { return e.nome; })) +
        '</div></div>';
    }

    var titulo = (p.secundarios && p.secundarios.titulo) || '';
    h += '<div class="card"><div class="card-titulo"><h2>Dados primários × secundários (lista digitada)</h2>' +
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
      /* O grupo importa: sem ele, `rotuloAtributo` cai no domínio de 'todos',
         que não tem nectarívora nem granívora — e o laudo saía com "nec" e
         "gra" crus na legenda da rosca. */
      G.rosca(M.composicao(dados.total, mapaTx, function (t) {
        return D.rotuloAtributo('dieta', (t.atributos || {}).dieta, t.grupo || p.grupo);
      }), { campo: 'especies' }) +
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

      secaoLaudoListaOficial(registrados) +
      secaoLaudoSecundarios(p, mapaTx) +

      '<section><h2>Tabela de espécies</h2>' +
      tabelaLaudoEspecies(dados.total, mapaTx, rel, freq, inc, p.grupo) + '</section>' +

      secaoLaudoProcedencia(registrados, p) +

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

  /* ------------------------------------------------- seções novas do laudo */

  /**
   * A conferência contra a Lista Nacional, no laudo. Sai SEMPRE que houver
   * espécie na lista — inclusive dizendo que confere, porque afirmar que
   * conferiu é parte do que ele assina.
   */
  function secaoLaudoListaOficial(registrados) {
    if (!AE || !LO) return '';
    var cr = AE.cruzarListaOficial(registrados);
    var declaradas = registrados.filter(function (t) {
      return D.ehAmeaca((t.atributos || {}).listaNacional);
    }).length;
    var oficiais = cr.ameacadasOficial.length;
    if (!cr.naLista.length && !declaradas) return '';

    var h = '<section><h2>Conferência contra a Lista Nacional</h2>';

    if (declaradas !== oficiais) {
      h += '<p style="font-size:.86rem;line-height:1.6"><strong>Divergência não resolvida:</strong> a tabela ' +
        'de espécies deste laudo declara ' + declaradas + ' espécie(s) ameaçada(s) na Portaria do MMA, ' +
        'e o cruzamento com a lista oficial aponta ' + oficiais + '.</p>';
    }

    h += '<div class="tabela-envolve"><table class="tabela"><thead><tr>' +
      '<th class="esq">Espécie</th><th class="esq">Família</th><th class="esq">Neste laudo</th>' +
      '<th class="esq">Lista oficial</th><th class="esq">Situação</th></tr></thead><tbody>' +
      cr.naLista.map(function (x) {
        return '<tr><td class="esq">' + nomeHtml(x.taxon) + '</td>' +
          '<td class="esq taxon-sup">' + esc(x.taxon.familia || (x.oficial && x.oficial.familia) || '—') + '</td>' +
          '<td class="esq">' + esc(x.atual || '—') + '</td>' +
          '<td class="esq">' + esc(x.oficial ? x.oficial.categoria + ' (' + x.oficial.ano + ')' : '—') + '</td>' +
          '<td class="esq">' + esc({
            confere: 'confere', faltando: 'não declarada no laudo', diferente: 'diverge',
            subespecie: 'a lista traz só subespécie', naoConsta: 'não consta da lista'
          }[x.situacao] || x.situacao) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="fonte" style="margin-top:8px">Fonte: ' + esc(LO.FONTE.nome) + ' — ' +
      esc(LO.FONTE.orgao) + ', via ' + esc(LO.FONTE.portal) + ' (' + esc(LO.FONTE.taxons) +
      ' táxons, licença ' + esc(LO.FONTE.licenca) + '), consultada em ' +
      esc(dataBR(LO.FONTE.convertidoEm)) + '. <strong>' + esc(LO.FONTE.limitacao) + '</strong> ' +
      esc(LO.ESTADUAIS.nota) + '</p></section>';
    return h;
  }

  /** Primários × secundários da GBIF — com o filtro citado, senão não vale. */
  function secaoLaudoSecundarios(p, mapaTx) {
    var sg = p.secundariosGbif;
    if (!sg || !sg.especies || !sg.especies.length) return '';
    var prim = [];
    (p.campanhas || []).forEach(function (c) {
      (c.unidades || []).forEach(function (u) {
        (u.registros || []).forEach(function (r) {
          var t = mapaTx[r.taxonId];
          if (t) prim.push(M.nomeCientifico(t));
        });
      });
    });
    var cz = SEC.cruzar(prim, sg.especies);
    var f = sg.filtro || {};

    return '<section><h2>Dados primários × secundários</h2>' +
      '<div class="painel-num">' +
      numCx(fmt(cz.riquezaPrimaria, 0), 'espécies em campo') +
      numCx(fmt(cz.riquezaSecundaria, 0), 'espécies na região') +
      numCx(fmt(cz.soPrimario.length, 0), 'só no primário') +
      numCx(fmt(cz.comuns.length, 0), 'em comum') +
      numCx(fmt(cz.esperadas.length, 0), 'não detectadas') +
      numCx(pct(cz.cobertura, 0), 'cobertura') +
      '</div>' +
      '<h3 style="margin-top:var(--e4)">Exclusivas do levantamento primário (' + cz.soPrimario.length + ')</h3>' +
      '<p style="line-height:1.9;font-size:.84rem">' + (cz.soPrimario.length
        ? cz.soPrimario.map(function (e) { return '<i class="cientifico">' + esc(e.nome) + '</i>'; }).join(' · ')
        : 'Nenhuma.') + '</p>' +
      '<h3 style="margin-top:var(--e4)">Esperadas para a região e não detectadas (' + cz.esperadas.length + ')</h3>' +
      '<p style="line-height:1.9;font-size:.84rem">' + (cz.esperadas.length
        ? cz.esperadas.slice(0, 60).map(function (e) { return '<i class="cientifico">' + esc(e.nome) + '</i>'; }).join(' · ') +
          (cz.esperadas.length > 60 ? ' <span style="color:var(--texto-3)">… e mais ' + (cz.esperadas.length - 60) + '</span>' : '')
        : 'Nenhuma.') + '</p>' +
      '<p class="fonte" style="margin-top:8px">Fonte: ' + esc(sg.fonte) + '. Filtro: geoDistance ' +
      esc(f.lat) + ', ' + esc(f.lon) + ', ' + esc(f.raioKm) + ' km' +
      ((f.classes || []).length ? ' · classe ' + esc(f.classes.join(' + ')) +
        ' (taxonKey ' + esc((f.taxonKeys || []).join(', ')) + ')' : '') +
      ' · hasCoordinate=true · ' + fmt(sg.ocorrencias, 0) + ' ocorrências. Consultado em ' +
      esc(dataHoraBR(sg.consultadoEm)) + '.</p></section>';
  }

  /**
   * De onde veio cada dado. É o que permite ao responsável técnico responder
   * pela origem de cada número que ele assina — e é a diferença entre um
   * campo preenchido por uma API e um campo preenchido por ninguém.
   */
  function secaoLaudoProcedencia(registrados, p) {
    if (!AE) return '';
    var fontes = AE.fontesUsadas(registrados);
    var origem = p.origemDados;
    if (!fontes.length && !origem && !p.secundariosGbif) return '';

    var h = '<section><h2>Procedência dos dados</h2>';

    if (origem) {
      h += '<p style="font-size:.84rem;line-height:1.6">Os registros deste levantamento entraram por ' +
        esc(origem.via === 'API' ? 'consulta à API' : 'importação de arquivo') + ': <strong>' +
        esc(origem.fonte) + '</strong>, em ' + esc(dataHoraBR(origem.consultadoEm)) + '.</p>';
    }

    if (fontes.length) {
      h += '<div class="tabela-envolve" style="margin-top:var(--e3)"><table class="tabela"><thead><tr>' +
        '<th class="esq">Fonte</th><th>Campos aceitos</th><th>Espécies</th>' +
        '<th class="esq">Consulta mais antiga</th><th class="esq">Mais recente</th></tr></thead><tbody>' +
        fontes.map(function (f) {
          return '<tr><td class="esq">' + esc(f.fonte) + '</td>' +
            '<td>' + fmt(f.campos, 0) + '</td><td>' + fmt(f.taxons, 0) + '</td>' +
            '<td class="esq">' + esc(dataBR(f.primeira)) + '</td>' +
            '<td class="esq">' + esc(dataBR(f.ultima)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="fonte" style="margin-top:8px">Cada campo da tabela acima foi <strong>proposto</strong> pela ' +
        'fonte indicada e <strong>aceito individualmente</strong> pelo responsável técnico. Nenhum valor foi ' +
        'gravado automaticamente, e nenhum campo já preenchido foi sobrescrito sem decisão expressa.</p>';
    } else {
      h += '<p style="font-size:.84rem;line-height:1.6">Nenhum campo de autoecologia foi preenchido a partir ' +
        'de fonte externa: todos foram digitados pelo responsável técnico.</p>';
    }

    return h + '</section>';
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
    $('#btn-auto-lote').addEventListener('click', autoLote);
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

      /* painel de achados */
      case 'achado-ir':
        var flt = el.getAttribute('data-filtro') || '';
        if (flt) {
          /* o filtro só prova o achado se o recorte de grupo não escondê-lo */
          filtroTaxon.so = flt;
          filtroTaxon.texto = '';
          filtroTaxon.grupo = null;
        }
        /* a tela de Unidades e a de Registros são por campanha: sem abrir a
           campanha certa, a linha levaria a um "nenhuma campanha aberta" */
        if (idC && at.projeto) A.definirAtivos(at.projeto.id, idC, idU || null);
        location.hash = '#' + (el.getAttribute('data-destino') || 'projetos');
        break;

      case 'achados-dispensar':
        if (at.projeto) {
          if (!estado.achadosDispensados) estado.achadosDispensados = {};
          estado.achadosDispensados[at.projeto.id] = 1;
          A.salvar(); renderProjetos();
        }
        break;

      case 'achados-mostrar':
        if (at.projeto && estado.achadosDispensados) {
          delete estado.achadosDispensados[at.projeto.id];
          A.salvar(); renderProjetos();
        }
        break;

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

      /* autoecologia automática */
      case 'auto-um': autoUm(idT); break;
      case 'auto-lote': autoLote(); break;
      case 'sug-aceitar': decidirSugestao(idT, Number(el.getAttribute('data-i')), true); break;
      case 'sug-recusar': decidirSugestao(idT, Number(el.getAttribute('data-i')), false); break;
      case 'auto-aceitar-vazios': decidirEmLote(['preenche'], true); break;
      case 'auto-aceitar-grafia': decidirEmLote(['grafia'], true); break;
      case 'auto-aceitar-seguros': decidirEmLote(['preenche', 'grafia'], true); break;
      case 'auto-ir-divergencias': irParaDivergencias(); break;
      case 'auto-limpar-filtro': limparFiltroSugestao(); break;
      case 'auto-recusar-todos': decidirEmLote(['preenche', 'diverge', 'grafia', 'atencao'], false); break;

      /* lista oficial */
      case 'lo-aceitar': decidirListaOficial(idT, true); break;
      case 'lo-recusar': decidirListaOficial(idT, false); break;

      /* dados secundários */
      case 'sec-buscar': buscarSecundarios(false); break;
      case 'sec-atualizar': buscarSecundarios(true); break;

      /* importação de observações externas */
      case 'import-inat': fecharModal(); modalInaturalist(); break;
      case 'import-ebird': fecharModal(); modalEbird(); break;

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
