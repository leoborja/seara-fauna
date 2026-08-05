/* ============================================================================
   Seara Biologia — Fauna — importador.js
   Leitor genérico de tabela: CSV, TSV e Darwin Core.

   Por que existe: até aqui só entrava a planilha exata do João, convertida
   fora do navegador por `importar.py`. Qualquer outra tabela — a que sai do
   GBIF, do eBird, do iNaturalist, do SiBBr, ou a que o cliente mandou —
   ficava de fora. Este módulo lê a tabela como ela vier e deixa o usuário
   dizer o que é cada coluna.

   Darwin Core é reconhecido sozinho: `scientificName`, `individualCount`,
   `eventDate`, `decimalLatitude`, `decimalLongitude`, `samplingProtocol`,
   `recordedBy`. É o padrão do GBIF e é o que sai dos exportadores.

   Tudo aqui é função pura: recebe texto, devolve dados. Não toca no DOM e
   não escreve nada — quem grava é o app, depois da pré-visualização.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.MOTOR;

  /* =========================================================================
     1. LEITURA — delimitador, aspas, cabeçalho
     ====================================================================== */

  /** Adivinha o delimitador contando ocorrências fora de aspas na 1ª linha. */
  function detectarDelimitador(texto) {
    var primeira = texto.split(/\r?\n/)[0] || '';
    var cand = [';', ',', '\t', '|'];
    var melhor = ';', max = -1;
    cand.forEach(function (d) {
      var n = 0, aspas = false;
      for (var i = 0; i < primeira.length; i++) {
        var c = primeira[i];
        if (c === '"') aspas = !aspas;
        else if (c === d && !aspas) n++;
      }
      if (n > max) { max = n; melhor = d; }
    });
    return max > 0 ? melhor : ';';
  }

  /**
   * Analisador de CSV com aspas duplas (RFC 4180) e quebra de linha dentro
   * do campo. Escrito à mão — o app é de zero dependências.
   */
  function analisar(texto, delim) {
    var linhas = [], campo = '', linha = [], aspas = false;
    /* BOM do Excel: se ficar, a primeira coluna vem com um caractere invisível
       no nome e o mapeamento automático não acha `scientificName`. */
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);

    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; }
          else aspas = false;
        } else campo += c;
        continue;
      }
      if (c === '"') { aspas = true; continue; }
      if (c === delim) { linha.push(campo); campo = ''; continue; }
      if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue; }
      if (c === '\r') continue;
      campo += c;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  /**
   * @returns {{delimitador, colunas:string[], linhas:string[][], total:number,
   *            aviso:string}}
   */
  function ler(texto, delim) {
    var d = delim || detectarDelimitador(texto);
    var brutas = analisar(texto, d).filter(function (l) {
      return l.some(function (c) { return String(c).trim() !== ''; });
    });
    if (!brutas.length) return { delimitador: d, colunas: [], linhas: [], total: 0, aviso: 'Arquivo vazio.' };

    var colunas = brutas[0].map(function (c, i) {
      var nome = String(c).trim();
      return nome || ('coluna ' + (i + 1));
    });
    var linhas = brutas.slice(1);
    /* linha com mais colunas que o cabeçalho é sinal de delimitador errado */
    var largas = linhas.filter(function (l) { return l.length > colunas.length; }).length;
    return {
      delimitador: d,
      colunas: colunas,
      linhas: linhas,
      total: linhas.length,
      aviso: largas ? largas + ' linha(s) têm mais campos que o cabeçalho — confira o separador.' : ''
    };
  }

  /* =========================================================================
     2. DESTINOS — para onde cada coluna pode ir
     ====================================================================== */
  var DESTINOS = [
    { chave: 'especie', rotulo: 'Nome científico', obrigatorio: true,
      dwc: ['scientificname', 'acceptednameusage', 'taxon', 'species', 'verbatimidentification'],
      pt: ['nome cientifico', 'especie', 'taxon', 'nome científico'] },
    { chave: 'quantidade', rotulo: 'Quantidade',
      dwc: ['individualcount', 'organismquantity', 'count'],
      pt: ['quantidade', 'quant', 'n', 'nº', 'numero de individuos', 'indivíduos', 'individuos'] },
    { chave: 'unidade', rotulo: 'Unidade amostral',
      dwc: ['locationid', 'eventid', 'locality', 'verbatimlocality', 'parenteventid', 'station'],
      pt: ['unidade amostral', 'unidade', 'ponto', 'transecto', 'estacao', 'estação', 'local', 'sitio', 'sítio'] },
    { chave: 'campanha', rotulo: 'Campanha',
      dwc: ['fieldnumber', 'samplingeffort', 'expedition'],
      pt: ['campanha', 'periodo', 'período', 'fase'] },
    { chave: 'data', rotulo: 'Data',
      dwc: ['eventdate', 'verbatimeventdate', 'date'],
      pt: ['data', 'dia'] },
    { chave: 'hora', rotulo: 'Hora',
      dwc: ['eventtime'], pt: ['hora', 'horario', 'horário'] },
    { chave: 'nomeComum', rotulo: 'Nome comum',
      dwc: ['vernacularname'], pt: ['nome comum', 'nome popular', 'popular'] },
    { chave: 'ordem', rotulo: 'Ordem', dwc: ['order'], pt: ['ordem'] },
    { chave: 'familia', rotulo: 'Família', dwc: ['family'], pt: ['familia', 'família'] },
    { chave: 'classe', rotulo: 'Classe', dwc: ['class'], pt: ['classe'] },
    { chave: 'metodo', rotulo: 'Método', dwc: ['samplingprotocol'], pt: ['metodo', 'método'] },
    { chave: 'tipo', rotulo: 'Tipo de registro',
      dwc: ['basisofrecord', 'occurrenceremarks', 'establishmentmeans'],
      pt: ['tipo', 'tipo de registro', 'contato', 'evidencia', 'evidência'] },
    { chave: 'latitude', rotulo: 'Latitude',
      dwc: ['decimallatitude', 'latitude', 'verbatimlatitude'], pt: ['latitude', 'lat'] },
    { chave: 'longitude', rotulo: 'Longitude',
      dwc: ['decimallongitude', 'longitude', 'verbatimlongitude'], pt: ['longitude', 'long', 'lon'] },
    { chave: 'observador', rotulo: 'Observador',
      dwc: ['recordedby', 'identifiedby'], pt: ['observador', 'coletor', 'responsavel', 'responsável'] },
    { chave: 'observacao', rotulo: 'Observação',
      dwc: ['occurrenceremarks', 'eventremarks'], pt: ['observacao', 'observação', 'obs', 'comentario'] }
  ];

  function destino(chave) {
    for (var i = 0; i < DESTINOS.length; i++) if (DESTINOS[i].chave === chave) return DESTINOS[i];
    return null;
  }

  function chaveNorm(s) {
    return String(s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /**
   * Mapeamento automático. Casa primeiro pelo termo Darwin Core (sem espaço,
   * como vem do GBIF), depois pelo cabeçalho em português.
   * @returns {{mapa:Object, darwinCore:boolean}}
   */
  function detectar(colunas) {
    var mapa = {}, usadas = {}, achouDwc = 0;
    var normDwc = colunas.map(function (c) { return chaveNorm(c).replace(/ /g, ''); });
    var normPt = colunas.map(chaveNorm);

    DESTINOS.forEach(function (d) {
      for (var i = 0; i < colunas.length; i++) {
        if (usadas[i]) continue;
        if (d.dwc.indexOf(normDwc[i]) >= 0) { mapa[d.chave] = i; usadas[i] = 1; achouDwc++; return; }
      }
      for (var j = 0; j < colunas.length; j++) {
        if (usadas[j]) continue;
        if (d.pt.indexOf(normPt[j]) >= 0) { mapa[d.chave] = j; usadas[j] = 1; return; }
      }
    });
    return { mapa: mapa, darwinCore: achouDwc >= 2 };
  }

  /* =========================================================================
     3. PREPARO — o que entra, o que é rejeitado e por quê
     ====================================================================== */

  function celula(linha, i) {
    if (i === undefined || i === null || i < 0) return '';
    return String(linha[i] === undefined ? '' : linha[i]).trim();
  }

  /** Data em ISO. Aceita 2026-03-04, 04/03/2026 e o intervalo do Darwin Core. */
  function dataISO(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    /* O Darwin Core aceita intervalo ("2026-01-04/2026-01-09"): fica o início.
       Uma data brasileira também tem barra, mas nela o 1º pedaço é o dia. */
    if (s.indexOf('/') > 0 && /^\d{4}-/.test(s)) s = s.split('/')[0];
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) return m[1] + '-' + m[2] + '-01';
    return '';
  }

  /* Vocabulário do Darwin Core → tipo de registro do app. */
  var TIPOS_DWC = {
    humanobservation: 'visual', machineobservation: 'foto', preservedspecimen: 'captura',
    materialsample: 'captura', livingspecimen: 'captura', fossilspecimen: 'vestigio',
    observation: 'visual', occurrence: 'visual'
  };
  var TIPOS_PT = {
    visual: 'visual', avistamento: 'visual', auditivo: 'auditivo', vocalizacao: 'auditivo',
    canto: 'auditivo', vestigio: 'vestigio', pegada: 'vestigio', fezes: 'vestigio',
    captura: 'captura', carcaca: 'carcaca', atropelamento: 'carcaca', foto: 'foto',
    fotografia: 'foto', armadilha: 'foto'
  };

  function tipoRegistro(v, padrao) {
    var k = chaveNorm(v).replace(/ /g, '');
    return TIPOS_DWC[k] || TIPOS_PT[k] || padrao || 'visual';
  }

  /* Vocabulário de `samplingProtocol` → método do app. */
  function metodoDe(v) {
    var k = chaveNorm(v);
    if (!k) return null;
    if (/camera|armadilha fotog|trap camera|camera trap/.test(k)) return 'armadilhaFoto';
    if (/transect/.test(k)) return 'transecto';
    if (/mist ?net|rede de neblina/.test(k)) return 'redeNeblina';
    if (/pitfall|queda/.test(k)) return 'pitfall';
    if (/point count|ponto de escuta|ponto de contagem/.test(k)) return 'pontoEscuta';
    if (/playback/.test(k)) return 'playback';
    if (/rede de pesca|peneira|seine|gill ?net/.test(k)) return 'redePesca';
    if (/busca ativa|active search|opportunist|casual/.test(k)) return 'buscaAtiva';
    return null;
  }

  /**
   * Transforma a tabela lida no plano de importação.
   *
   * @param {Object} tabela      saída de ler()
   * @param {Object} mapa        {destino: índice da coluna}
   * @param {Object} opcoes      { metodo, unidadePadrao, campanhaPadrao, tipoPadrao }
   * @returns {{campanhas, especies, linhas, rejeitados, resumo}}
   */
  function preparar(tabela, mapa, opcoes) {
    opcoes = opcoes || {};
    var rejeitados = [], especies = {}, campanhas = {}, aceitas = 0, individuos = 0;
    var semQuantidade = 0, semData = 0;

    (tabela.linhas || []).forEach(function (l, n) {
      var nome = celula(l, mapa.especie);
      if (!nome) {
        rejeitados.push({ linha: n + 2, valor: '(vazio)', motivo: 'sem nome científico' });
        return;
      }
      /* "sp.", "sp", "cf." e afins: entra, mas avisado — é registro de gênero */
      var partes = nome.replace(/\s+/g, ' ').trim().split(' ');
      if (partes.length < 2) {
        rejeitados.push({ linha: n + 2, valor: nome, motivo: 'só o gênero, sem epíteto específico' });
        return;
      }

      var qBruta = celula(l, mapa.quantidade);
      var q;
      if (qBruta === '') { q = 1; semQuantidade++; }
      else {
        q = parseFloat(qBruta.replace(',', '.'));
        if (!isFinite(q) || q <= 0) {
          rejeitados.push({ linha: n + 2, valor: nome, motivo: 'quantidade inválida: "' + qBruta + '"' });
          return;
        }
      }

      var data = dataISO(celula(l, mapa.data));
      if (!data) semData++;

      var rotCamp = celula(l, mapa.campanha) || opcoes.campanhaPadrao || '1ª campanha';
      var rotUn = celula(l, mapa.unidade) || opcoes.unidadePadrao || 'UA 01';
      var met = metodoDe(celula(l, mapa.metodo)) || opcoes.metodo || 'buscaAtiva';

      if (!campanhas[rotCamp]) campanhas[rotCamp] = { rotulo: rotCamp, unidades: {} };
      var uns = campanhas[rotCamp].unidades;
      if (!uns[rotUn]) {
        uns[rotUn] = {
          codigo: rotUn, metodo: met, data: data,
          latitude: celula(l, mapa.latitude), longitude: celula(l, mapa.longitude),
          registros: []
        };
      }
      var un = uns[rotUn];
      if (!un.data && data) un.data = data;

      var chave = M.normalizar(nome);
      if (!especies[chave]) {
        especies[chave] = {
          nome: partes.join(' '),
          nomeComum: celula(l, mapa.nomeComum),
          ordem: celula(l, mapa.ordem),
          familia: celula(l, mapa.familia),
          classe: celula(l, mapa.classe),
          n: 0
        };
      }
      especies[chave].n += q;

      un.registros.push({
        especie: chave,
        quantidade: q,
        tipo: tipoRegistro(celula(l, mapa.tipo), opcoes.tipoPadrao),
        data: data || un.data,
        hora: celula(l, mapa.hora),
        observador: celula(l, mapa.observador),
        observacao: celula(l, mapa.observacao)
      });
      aceitas++;
      individuos += q;
    });

    var listaCamp = Object.keys(campanhas).map(function (k) {
      var c = campanhas[k];
      return { rotulo: c.rotulo, unidades: Object.keys(c.unidades).map(function (u) { return c.unidades[u]; }) };
    });
    var nUn = listaCamp.reduce(function (a, c) { return a + c.unidades.length; }, 0);

    return {
      campanhas: listaCamp,
      especies: especies,
      rejeitados: rejeitados,
      resumo: {
        lidas: (tabela.linhas || []).length,
        aceitas: aceitas,
        rejeitadas: rejeitados.length,
        individuos: individuos,
        especies: Object.keys(especies).length,
        campanhas: listaCamp.length,
        unidades: nUn,
        semQuantidade: semQuantidade,
        semData: semData
      }
    };
  }

  /** Assinatura do cabeçalho, para lembrar o mapeamento deste tipo de arquivo. */
  function assinatura(colunas) {
    return (colunas || []).map(chaveNorm).join('|');
  }

  global.IMPORTADOR = {
    ler: ler, analisar: analisar, detectarDelimitador: detectarDelimitador,
    DESTINOS: DESTINOS, destino: destino, detectar: detectar,
    preparar: preparar, assinatura: assinatura,
    dataISO: dataISO, tipoRegistro: tipoRegistro, metodoDe: metodoDe
  };
})(typeof window !== 'undefined' ? window : globalThis);
