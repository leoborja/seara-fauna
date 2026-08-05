/* ============================================================================
   Seara Biologia — Fauna — graficos.js
   Gráficos em SVG escrito à mão. Zero dependências, zero CDN.
   Todas as funções devolvem string de SVG; nenhuma toca no DOM.
   ========================================================================== */
(function (global) {
  'use strict';

  var PALETA = {
    verde: '#1B5E3F',
    verde2: '#2D7A4F',
    verde3: '#58A87A',
    verde4: '#8CC7A4',
    verde5: '#C9DFD1',
    terra: '#B4633A',
    terra2: '#D98A5F',
    areia: '#E4D3B8',
    cinza: '#8A9A91',
    /* Série categórica: 8 tons que se distinguem também em impressão P&B,
       porque o laudo costuma sair em impressora monocromática. */
    serie: ['#1B5E3F', '#B4633A', '#3F9264', '#D98A5F', '#123D2A', '#8CC7A4',
            '#A2542D', '#58A87A', '#C9DFD1', '#8A9A91']
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(v, casas) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (casas === undefined) casas = Math.abs(v) < 10 ? 2 : (Math.abs(v) < 100 ? 1 : 0);
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }

  function svg(w, h, conteudo, cls) {
    return '<svg class="grafico ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" ' +
      'width="100%" role="img" xmlns="http://www.w3.org/2000/svg" ' +
      'style="max-width:100%;height:auto;display:block">' + conteudo + '</svg>';
  }

  function vazio(msg) {
    return '<div class="grafico-vazio">' + esc(msg) + '</div>';
  }

  /* Corta o rótulo sem mexer na caixa das letras — nome de gênero é maiúsculo
     e epíteto é minúsculo; uppercase falsearia a nomenclatura. */
  function corta(s, max) {
    s = String(s || '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  /* =========================================================================
     1. CURVA DO COLETOR
        Faixa sombreada = IC 95 % da rarefação (Mao Tau, por indivíduos).
        Linha cheia = riqueza esperada. Pontos = acumulação observada, na
        ordem em que as unidades foram amostradas.
     ====================================================================== */
  function curvaColetor(rarefacao, acumulacao, opts) {
    opts = opts || {};
    if (!rarefacao || !rarefacao.length) {
      return vazio('Sem registros suficientes para a curva do coletor.');
    }

    var W = 760, H = 400;
    var mE = 56, mD = 20, mT = 28, mB = 56;
    var larg = W - mE - mD, alt = H - mT - mB;

    var maxN = rarefacao[rarefacao.length - 1].n;
    var maxS = 0;
    rarefacao.forEach(function (p) {
      maxS = Math.max(maxS, p.superior === null ? p.esperado : p.superior, p.esperado);
    });
    (acumulacao || []).forEach(function (p) { maxS = Math.max(maxS, p.riqueza); });
    maxS = Math.ceil(maxS * 1.08) || 1;

    function px(nn) { return mE + (nn / maxN) * larg; }
    function py(s) { return mT + alt - (s / maxS) * alt; }

    var s = [];

    /* grade */
    var passosY = escala(maxS, 5);
    passosY.forEach(function (v) {
      s.push('<line x1="' + mE + '" y1="' + py(v).toFixed(1) + '" x2="' + (mE + larg) +
        '" y2="' + py(v).toFixed(1) + '" stroke="var(--borda)" stroke-width="1" />');
      s.push('<text x="' + (mE - 8) + '" y="' + (py(v) + 4).toFixed(1) +
        '" text-anchor="end" class="g-micro">' + esc(fmt(v, 0)) + '</text>');
    });
    var passosX = escala(maxN, 6);
    passosX.forEach(function (v) {
      s.push('<line x1="' + px(v).toFixed(1) + '" y1="' + mT + '" x2="' + px(v).toFixed(1) +
        '" y2="' + (mT + alt) + '" stroke="var(--borda)" stroke-width="1" stroke-dasharray="2 3" />');
      s.push('<text x="' + px(v).toFixed(1) + '" y="' + (mT + alt + 18) +
        '" text-anchor="middle" class="g-micro">' + esc(fmt(v, 0)) + '</text>');
    });

    /* faixa de IC 95 % */
    var temIC = rarefacao.some(function (p) { return p.inferior !== null && p.superior !== null; });
    if (temIC) {
      var cima = rarefacao.map(function (p) { return px(p.n).toFixed(1) + ',' + py(p.superior).toFixed(1); });
      var baixo = rarefacao.slice().reverse().map(function (p) { return px(p.n).toFixed(1) + ',' + py(p.inferior).toFixed(1); });
      s.push('<polygon points="' + cima.concat(baixo).join(' ') + '" fill="' + PALETA.verde4 +
        '" fill-opacity=".38" stroke="none" />');
    }

    /* Curva de Coleman — a aproximação (Gotelli & Colwell 2011, eq. 4.1).
       Fica sempre um pouco abaixo do Mao Tau; serve de conferência visual. */
    if (opts.coleman && opts.coleman.length) {
      s.push('<polyline points="' + opts.coleman.map(function (p) {
        return px(p.n).toFixed(1) + ',' + py(p.esperado).toFixed(1);
      }).join(' ') + '" fill="none" stroke="' + PALETA.cinza +
        '" stroke-width="1.6" stroke-dasharray="6 4" stroke-linejoin="round" />');
    }

    /* linha esperada */
    s.push('<polyline points="' + rarefacao.map(function (p) {
      return px(p.n).toFixed(1) + ',' + py(p.esperado).toFixed(1);
    }).join(' ') + '" fill="none" stroke="' + PALETA.verde + '" stroke-width="2.4" stroke-linejoin="round" />');

    /* Marcos de campanha: onde uma campanha acaba e a próxima começa.
       Com N campanhas a curva do coletor é a acumulação de todas em
       sequência, e sem o marco não dá para ver o degrau de cada ida a campo. */
    (opts.marcos || []).forEach(function (mk) {
      if (!mk.individuos || mk.individuos > maxN) return;
      var x = px(mk.individuos);
      s.push('<line x1="' + x.toFixed(1) + '" y1="' + mT + '" x2="' + x.toFixed(1) + '" y2="' + (mT + alt) +
        '" stroke="' + PALETA.cinza + '" stroke-width="1.2" stroke-dasharray="5 4" />');
      s.push('<text x="' + (x - 4).toFixed(1) + '" y="' + (mT + 12) +
        '" text-anchor="end" class="g-micro">' + esc(corta(mk.rotulo, 18)) + '</text>');
    });

    /* acumulação observada */
    (acumulacao || []).forEach(function (p) {
      if (p.individuos > maxN) return;
      s.push('<circle cx="' + px(p.individuos).toFixed(1) + '" cy="' + py(p.riqueza).toFixed(1) +
        '" r="4.2" fill="var(--superficie)" stroke="' + PALETA.terra + '" stroke-width="2" />');
    });

    /* eixos */
    s.push('<line x1="' + mE + '" y1="' + (mT + alt) + '" x2="' + (mE + larg) + '" y2="' + (mT + alt) +
      '" stroke="var(--borda-forte)" stroke-width="1.2" />');
    s.push('<line x1="' + mE + '" y1="' + mT + '" x2="' + mE + '" y2="' + (mT + alt) +
      '" stroke="var(--borda-forte)" stroke-width="1.2" />');

    s.push('<text x="' + (mE + larg / 2) + '" y="' + (H - 8) + '" text-anchor="middle" class="g-rotulo">' +
      esc(opts.rotuloX || 'Indivíduos amostrados') + '</text>');
    s.push('<text transform="translate(14,' + (mT + alt / 2) + ') rotate(-90)" text-anchor="middle" class="g-rotulo">' +
      esc(opts.rotuloY || 'Riqueza de espécies') + '</text>');

    /* legenda */
    var lx = mE + 12, ly = mT + 14;
    s.push('<line x1="' + lx + '" y1="' + ly + '" x2="' + (lx + 22) + '" y2="' + ly +
      '" stroke="' + PALETA.verde + '" stroke-width="2.4" />');
    s.push('<text x="' + (lx + 28) + '" y="' + (ly + 4) + '" class="g-micro">rarefação (Mao Tau)</text>');
    if (temIC) {
      s.push('<rect x="' + lx + '" y="' + (ly + 12) + '" width="22" height="9" fill="' + PALETA.verde4 + '" fill-opacity=".38" />');
      s.push('<text x="' + (lx + 28) + '" y="' + (ly + 20) + '" class="g-micro">IC 95 %</text>');
    }
    s.push('<circle cx="' + (lx + 11) + '" cy="' + (ly + 34) + '" r="4.2" fill="var(--superficie)" stroke="' + PALETA.terra + '" stroke-width="2" />');
    s.push('<text x="' + (lx + 28) + '" y="' + (ly + 38) + '" class="g-micro">acumulação observada por unidade</text>');
    if (opts.coleman && opts.coleman.length) {
      s.push('<line x1="' + lx + '" y1="' + (ly + 50) + '" x2="' + (lx + 22) + '" y2="' + (ly + 50) +
        '" stroke="' + PALETA.cinza + '" stroke-width="1.6" stroke-dasharray="6 4" />');
      s.push('<text x="' + (lx + 28) + '" y="' + (ly + 54) + '" class="g-micro">curva de Coleman (aproximação)</text>');
    }

    return svg(W, H, s.join(''), 'g-curva');
  }

  function escala(max, alvo) {
    if (!max || !isFinite(max)) return [0];
    var bruto = max / alvo;
    var mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    var passo = mag;
    [1, 2, 2.5, 5, 10].some(function (m) { if (mag * m >= bruto) { passo = mag * m; return true; } return false; });
    var v = [], x = 0;
    while (x <= max) { v.push(x); x += passo; }
    return v;
  }

  /* =========================================================================
     2. BARRAS HORIZONTAIS — composição por ordem / família / guilda
     ====================================================================== */
  function barrasComposicao(comp, opts) {
    opts = opts || {};
    var itens = (comp && comp.itens) || [];
    if (!itens.length) return vazio(opts.vazio || 'Sem dados para compor este gráfico.');

    var lim = opts.limite || 14;
    var lista = itens.slice(0, lim);
    var resto = itens.slice(lim);
    if (resto.length) {
      lista = lista.concat([{
        rotulo: 'outras ' + resto.length,
        especies: resto.reduce(function (a, b) { return a + b.especies; }, 0),
        individuos: resto.reduce(function (a, b) { return a + b.individuos; }, 0)
      }]);
    }

    var campo = opts.campo || 'individuos';
    var W = 760, mE = 176, mD = 96, mT = 22, linha = 26, gap = 6;
    var larg = W - mE - mD;
    var H = mT + lista.length * (linha + gap) + 14;
    var max = Math.max.apply(null, lista.map(function (i) { return i[campo]; })) || 1;
    var total = lista.reduce(function (a, b) { return a + b[campo]; }, 0);
    var s = [];

    lista.forEach(function (it, i) {
      var y = mT + i * (linha + gap);
      var w = Math.max(2, (it[campo] / max) * larg);
      var cor = PALETA.serie[i % PALETA.serie.length];
      s.push('<text x="' + (mE - 10) + '" y="' + (y + linha / 2 + 4) +
        '" text-anchor="end" class="g-rotulo">' + esc(corta(it.rotulo, 26)) + '</text>');
      s.push('<rect x="' + mE + '" y="' + (y + 2) + '" width="' + larg + '" height="' + (linha - 4) +
        '" fill="var(--superficie-2)" stroke="var(--borda)" stroke-width=".5" rx="3" />');
      s.push('<rect x="' + mE + '" y="' + (y + 2) + '" width="' + w.toFixed(1) + '" height="' + (linha - 4) +
        '" fill="' + cor + '" stroke="rgba(0,0,0,.22)" stroke-width=".5" rx="3" />');
      var pct = total ? (it[campo] / total) * 100 : 0;
      s.push('<text x="' + (mE + larg + 9) + '" y="' + (y + linha / 2 + 4) + '" class="g-valor">' +
        esc(fmt(it[campo], 0)) + '</text>');
      s.push('<text x="' + (W - 8) + '" y="' + (y + linha / 2 + 4) + '" text-anchor="end" class="g-micro">' +
        esc(fmt(pct, 1)) + ' %</text>');
    });

    return svg(W, H, s.join(''), 'g-composicao');
  }

  /* =========================================================================
     3. ROSCA — guilda trófica, hábitat, dependência de mata
     ====================================================================== */
  function rosca(comp, opts) {
    opts = opts || {};
    var itens = (comp && comp.itens) || [];
    if (!itens.length) return vazio(opts.vazio || 'Sem dados para compor este gráfico.');
    var campo = opts.campo || 'especies';
    var total = itens.reduce(function (a, b) { return a + b[campo]; }, 0);
    if (!total) return vazio(opts.vazio || 'Sem dados para compor este gráfico.');

    var W = 470, H = Math.max(240, 44 + itens.length * 24);
    var cx = 116, cy = H / 2, rExt = 92, rInt = 54;
    var s = [], ang = -90;

    itens.forEach(function (it, i) {
      var frac = it[campo] / total;
      var a0 = ang, a1 = ang + frac * 360;
      ang = a1;
      s.push('<path d="' + arcoAnel(cx, cy, rInt, rExt, a0, a1) + '" fill="' +
        PALETA.serie[i % PALETA.serie.length] + '" stroke="var(--superficie)" stroke-width="1.5" />');
    });

    s.push('<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="g-num-grande">' +
      esc(fmt(total, 0)) + '</text>');
    s.push('<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" class="g-micro">' +
      esc(campo === 'especies' ? 'espécies' : 'indivíduos') + '</text>');

    var lx = 244, ly = (H - itens.length * 24) / 2 + 14;
    itens.forEach(function (it, i) {
      var y = ly + i * 24;
      s.push('<rect x="' + lx + '" y="' + (y - 10) + '" width="13" height="13" rx="3" fill="' +
        PALETA.serie[i % PALETA.serie.length] + '" stroke="rgba(0,0,0,.25)" stroke-width=".5" />');
      s.push('<text x="' + (lx + 22) + '" y="' + y + '" class="g-rotulo">' + esc(corta(it.rotulo, 20)) + '</text>');
      s.push('<text x="' + (W - 12) + '" y="' + y + '" text-anchor="end" class="g-valor">' +
        esc(fmt(it[campo], 0)) + ' · ' + esc(fmt((it[campo] / total) * 100, 1)) + ' %</text>');
    });

    return svg(W, H, s.join(''), 'g-rosca');
  }

  function polar(cx, cy, r, graus) {
    var rad = (graus * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function arcoAnel(cx, cy, rInt, rExt, a0, a1) {
    if (a1 - a0 >= 359.999) a1 = a0 + 359.999;
    var grande = (a1 - a0) > 180 ? 1 : 0;
    var p1 = polar(cx, cy, rExt, a0), p2 = polar(cx, cy, rExt, a1);
    var p3 = polar(cx, cy, rInt, a1), p4 = polar(cx, cy, rInt, a0);
    return 'M ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) +
      ' A ' + rExt + ' ' + rExt + ' 0 ' + grande + ' 1 ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2) +
      ' L ' + p3[0].toFixed(2) + ' ' + p3[1].toFixed(2) +
      ' A ' + rInt + ' ' + rInt + ' 0 ' + grande + ' 0 ' + p4[0].toFixed(2) + ' ' + p4[1].toFixed(2) + ' Z';
  }

  /* =========================================================================
     4. BARRAS AGRUPADAS — riqueza e abundância por unidade amostral
     ====================================================================== */
  function barrasUnidades(linhas) {
    if (!linhas || !linhas.length) return vazio('Cadastre unidades amostrais para ver a comparação.');

    var W = 760, mE = 46, mD = 16, mT = 34, mB = 56;
    var larg = W - mE - mD, H = 300, alt = H - mT - mB;
    var max = 0;
    linhas.forEach(function (l) { max = Math.max(max, l.riqueza || 0, l.individuos || 0); });
    max = Math.ceil(max * 1.12) || 1;

    var passo = larg / linhas.length;
    var bw = Math.min(22, passo / 2.6);
    var s = [];

    escala(max, 5).forEach(function (v) {
      var y = mT + alt - (v / max) * alt;
      s.push('<line x1="' + mE + '" y1="' + y.toFixed(1) + '" x2="' + (mE + larg) + '" y2="' + y.toFixed(1) +
        '" stroke="var(--borda)" stroke-width="1" />');
      s.push('<text x="' + (mE - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" class="g-micro">' +
        esc(fmt(v, 0)) + '</text>');
    });

    linhas.forEach(function (l, i) {
      var xc = mE + passo * (i + 0.5);
      var hi = (l.individuos / max) * alt, hr = (l.riqueza / max) * alt;
      s.push('<rect x="' + (xc - bw - 2).toFixed(1) + '" y="' + (mT + alt - hi).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, hi).toFixed(1) +
        '" fill="' + PALETA.verde3 + '" stroke="rgba(0,0,0,.2)" stroke-width=".5" rx="2" />');
      s.push('<rect x="' + (xc + 2).toFixed(1) + '" y="' + (mT + alt - hr).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, hr).toFixed(1) +
        '" fill="' + PALETA.verde + '" stroke="rgba(0,0,0,.2)" stroke-width=".5" rx="2" />');
      s.push('<text x="' + xc.toFixed(1) + '" y="' + (mT + alt + 18) + '" text-anchor="middle" class="g-micro">' +
        esc(corta(l.rotulo, 9)) + '</text>');
    });

    s.push('<line x1="' + mE + '" y1="' + (mT + alt) + '" x2="' + (mE + larg) + '" y2="' + (mT + alt) +
      '" stroke="var(--borda-forte)" stroke-width="1.2" />');

    s.push('<rect x="' + mE + '" y="' + (mT - 22) + '" width="12" height="12" rx="2" fill="' + PALETA.verde3 + '" />');
    s.push('<text x="' + (mE + 18) + '" y="' + (mT - 12) + '" class="g-micro">indivíduos</text>');
    s.push('<rect x="' + (mE + 92) + '" y="' + (mT - 22) + '" width="12" height="12" rx="2" fill="' + PALETA.verde + '" />');
    s.push('<text x="' + (mE + 110) + '" y="' + (mT - 12) + '" class="g-micro">espécies</text>');

    return svg(W, H, s.join(''), 'g-unidades');
  }

  /* =========================================================================
     5. ESTIMADORES — ponto e barra de erro contra a riqueza observada
     ====================================================================== */
  function graficoEstimadores(est) {
    if (!est || !est.S) return vazio('Sem registros para estimar a riqueza.');

    var itens = [
      { rotulo: 'Chao 1', valor: est.chao1, ic: est.ic.chao1 },
      { rotulo: 'Chao 2', valor: est.chao2, ic: est.ic.chao2 },
      { rotulo: 'Jackknife 1', valor: est.jack1, ic: est.ic.jack1 },
      { rotulo: 'Jackknife 2', valor: est.jack2, ic: est.ic.jack2 },
      { rotulo: 'Bootstrap', valor: est.bootstrap, ic: est.ic.bootstrap }
    ].filter(function (i) { return i.valor !== null && isFinite(i.valor); });

    if (!itens.length) return vazio('Sem registros para estimar a riqueza.');

    var W = 760, mE = 120, mD = 96, mT = 34, linha = 34;
    var larg = W - mE - mD;
    var H = mT + itens.length * linha + 34;
    var max = est.S;
    itens.forEach(function (i) {
      max = Math.max(max, i.valor, (i.ic && i.ic[1]) || 0);
    });
    max = Math.ceil(max * 1.1) || 1;
    function px(v) { return mE + (v / max) * larg; }
    var s = [];

    escala(max, 6).forEach(function (v) {
      s.push('<line x1="' + px(v).toFixed(1) + '" y1="' + (mT - 8) + '" x2="' + px(v).toFixed(1) +
        '" y2="' + (mT + itens.length * linha) + '" stroke="var(--borda)" stroke-width="1" stroke-dasharray="2 3" />');
      s.push('<text x="' + px(v).toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" class="g-micro">' +
        esc(fmt(v, 0)) + '</text>');
    });

    /* riqueza observada: a referência contra a qual tudo se lê */
    s.push('<line x1="' + px(est.S).toFixed(1) + '" y1="' + (mT - 14) + '" x2="' + px(est.S).toFixed(1) +
      '" y2="' + (mT + itens.length * linha) + '" stroke="' + PALETA.terra + '" stroke-width="1.6" stroke-dasharray="4 3" />');
    s.push('<text x="' + px(est.S).toFixed(1) + '" y="' + (mT - 20) + '" text-anchor="middle" class="g-micro" style="fill:' +
      PALETA.terra + '">S observada = ' + esc(fmt(est.S, 0)) + '</text>');

    itens.forEach(function (it, i) {
      var y = mT + i * linha + linha / 2;
      s.push('<text x="' + (mE - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="g-rotulo">' + esc(it.rotulo) + '</text>');
      if (it.ic && it.ic[0] !== null && it.ic[1] !== null) {
        s.push('<line x1="' + px(it.ic[0]).toFixed(1) + '" y1="' + y + '" x2="' + px(it.ic[1]).toFixed(1) +
          '" y2="' + y + '" stroke="' + PALETA.verde3 + '" stroke-width="3" stroke-linecap="round" />');
        [it.ic[0], it.ic[1]].forEach(function (v) {
          s.push('<line x1="' + px(v).toFixed(1) + '" y1="' + (y - 6) + '" x2="' + px(v).toFixed(1) +
            '" y2="' + (y + 6) + '" stroke="' + PALETA.verde3 + '" stroke-width="2" />');
        });
      }
      s.push('<circle cx="' + px(it.valor).toFixed(1) + '" cy="' + y + '" r="5.5" fill="' + PALETA.verde +
        '" stroke="var(--superficie)" stroke-width="1.5" />');
      s.push('<text x="' + (W - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="g-valor">' +
        esc(fmt(it.valor, 1)) + '</text>');
    });

    return svg(W, H, s.join(''), 'g-estimadores');
  }

  /* =========================================================================
     6. BARRA COMPARATIVA — duas campanhas, ou primários x secundários
     ====================================================================== */
  function barraComparacao(cmp, rotuloA, rotuloB) {
    if (!cmp || !cmp.total) return vazio('Sem espécies para comparar.');
    var W = 700, H = 130, x0 = 14, larg = W - 28, y = 42, alt = 40;
    var partes = [
      { rotulo: 'só ' + rotuloA, valor: cmp.exclusivasA.length, cor: PALETA.verde },
      { rotulo: 'em comum', valor: cmp.comuns.length, cor: PALETA.verde4 },
      { rotulo: 'só ' + rotuloB, valor: cmp.exclusivasB.length, cor: PALETA.terra }
    ];
    var s = [], x = x0;
    partes.forEach(function (p) {
      var w = (p.valor / cmp.total) * larg;
      s.push('<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + Math.max(0, w).toFixed(1) +
        '" height="' + alt + '" fill="' + p.cor + '" stroke="rgba(0,0,0,.25)" stroke-width=".5" />');
      if (w > 46) {
        s.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + alt / 2 + 5) +
          '" text-anchor="middle" class="g-valor" style="fill:#fff">' + esc(fmt(p.valor, 0)) + '</text>');
      }
      s.push('<text x="' + (x + Math.max(w, 40) / 2).toFixed(1) + '" y="' + (y - 10) +
        '" text-anchor="middle" class="g-micro">' + esc(corta(p.rotulo, 18)) + '</text>');
      x += w;
    });
    s.push('<text x="' + x0 + '" y="' + (H - 12) + '" class="g-micro">Total de ' +
      esc(fmt(cmp.total, 0)) + ' espécies · similaridade de Jaccard ' +
      esc(cmp.similaridadeJaccard === null ? '—' : fmt(cmp.similaridadeJaccard * 100, 1) + ' %') + '</text>');
    return svg(W, H, s.join(''), 'g-comparacao');
  }

  /* =========================================================================
     7. COMPARAÇÃO DE N LISTAS — N campanhas, não duas
        Uma barra por campanha, dividida entre o que é só dela e o que
        divide com as outras. A escala é a mesma para todas, então o
        comprimento da barra já é a riqueza.
     ====================================================================== */
  function barrasComparacaoN(cmp) {
    var itens = (cmp && cmp.porLista) || [];
    if (!itens.length) return vazio('Sem campanhas com registro para comparar.');

    var W = 760, mE = 150, mD = 120, mT = 34, linha = 30, gap = 8;
    var larg = W - mE - mD;
    var H = mT + itens.length * (linha + gap) + 40;
    var max = Math.max.apply(null, itens.map(function (i) { return i.riqueza; })) || 1;
    var s = [];

    itens.forEach(function (it, i) {
      var y = mT + i * (linha + gap);
      var wC = (it.compartilhadas / max) * larg;
      var wE = (it.exclusivas.length / max) * larg;
      s.push('<text x="' + (mE - 10) + '" y="' + (y + linha / 2 + 4) +
        '" text-anchor="end" class="g-rotulo">' + esc(corta(it.rotulo, 22)) + '</text>');
      s.push('<rect x="' + mE + '" y="' + (y + 2) + '" width="' + larg + '" height="' + (linha - 4) +
        '" fill="var(--superficie-2)" stroke="var(--borda)" stroke-width=".5" rx="3" />');
      s.push('<rect x="' + mE + '" y="' + (y + 2) + '" width="' + Math.max(0, wC).toFixed(1) +
        '" height="' + (linha - 4) + '" fill="' + PALETA.verde4 + '" stroke="rgba(0,0,0,.2)" stroke-width=".5" rx="3" />');
      s.push('<rect x="' + (mE + wC).toFixed(1) + '" y="' + (y + 2) + '" width="' + Math.max(0, wE).toFixed(1) +
        '" height="' + (linha - 4) + '" fill="' + PALETA.terra + '" stroke="rgba(0,0,0,.2)" stroke-width=".5" rx="3" />');
      s.push('<text x="' + (W - 8) + '" y="' + (y + linha / 2 + 4) + '" text-anchor="end" class="g-valor">' +
        esc(fmt(it.riqueza, 0)) + ' spp. · ' + esc(fmt(it.exclusivas.length, 0)) + ' só dela</text>');
    });

    var ly = mT - 14;
    s.push('<rect x="' + mE + '" y="' + (ly - 9) + '" width="12" height="12" rx="2" fill="' + PALETA.verde4 + '" />');
    s.push('<text x="' + (mE + 18) + '" y="' + ly + '" class="g-micro">também em outra campanha</text>');
    s.push('<rect x="' + (mE + 210) + '" y="' + (ly - 9) + '" width="12" height="12" rx="2" fill="' + PALETA.terra + '" />');
    s.push('<text x="' + (mE + 228) + '" y="' + ly + '" class="g-micro">exclusiva desta campanha</text>');

    s.push('<text x="' + mE + '" y="' + (H - 12) + '" class="g-micro">' +
      esc(fmt(cmp.uniao.length, 0)) + ' espécies no total · ' +
      esc(fmt(cmp.comunsTodas.length, 0)) + ' em todas as ' + itens.length + ' campanhas</text>');

    return svg(W, H, s.join(''), 'g-comparacao-n');
  }

  global.GRAFICOS = {
    PALETA: PALETA,
    curvaColetor: curvaColetor,
    barrasComparacaoN: barrasComparacaoN,
    barrasComposicao: barrasComposicao,
    rosca: rosca,
    barrasUnidades: barrasUnidades,
    graficoEstimadores: graficoEstimadores,
    barraComparacao: barraComparacao,
    vazio: vazio
  };
})(typeof window !== 'undefined' ? window : globalThis);
