/* ============================================================================
   Seara Biologia — Fauna — dados.js
   Catálogos fixos: métodos e suas unidades de esforço, domínios de
   autoecologia, listas legais, rótulos. Nada aqui depende de aves — o grupo
   entra pelos atributos, não pelo código.
   ========================================================================== */
(function (global) {
  'use strict';

  /* =========================================================================
     MÉTODOS — cada um declara a própria unidade de esforço.
     `campos` são os campos próprios do método (o formulário se monta a partir
     daqui). `esforco(e)` devolve o valor na unidade declarada.
     ====================================================================== */
  var METODOS = [
    {
      chave: 'transecto',
      rotulo: 'Transecto',
      unidade: 'km',
      unidadeLonga: 'quilômetro percorrido',
      descricao: 'Percurso linear com faixa de detecção de largura fixa.',
      campos: [
        { chave: 'comprimentoKm', rotulo: 'Comprimento', unidade: 'km', passo: '0,01' },
        { chave: 'larguraM', rotulo: 'Largura da faixa', unidade: 'm', passo: '1', padrao: 50 }
      ],
      esforco: function (e) { return num(e.comprimentoKm); },
      /* Fórmula herdada da planilha (`Inf campo` L3):
         área (ha) = (comprimento_km × 1000 × largura_m) / 10.000 */
      area: function (e) {
        var c = num(e.comprimentoKm), l = num(e.larguraM);
        if (c === null || l === null) return null;
        return (c * 1000 * l) / 10000;
      }
    },
    {
      chave: 'pontoEscuta',
      rotulo: 'Ponto de escuta',
      unidade: 'hora·ponto',
      unidadeLonga: 'hora de escuta por ponto',
      descricao: 'Ponto fixo, com raio de detecção e duração determinados.',
      campos: [
        { chave: 'raioM', rotulo: 'Raio de detecção', unidade: 'm', passo: '1', padrao: 50 },
        { chave: 'duracaoMin', rotulo: 'Duração', unidade: 'min', passo: '1', padrao: 10 },
        { chave: 'nPontos', rotulo: 'Nº de pontos', unidade: '', passo: '1', padrao: 1 }
      ],
      esforco: function (e) {
        var d = num(e.duracaoMin), n = num(e.nPontos);
        if (d === null) return null;
        return (d / 60) * (n === null ? 1 : n);
      },
      area: function (e) {
        var r = num(e.raioM), n = num(e.nPontos);
        if (r === null) return null;
        return (Math.PI * r * r / 10000) * (n === null ? 1 : n);
      }
    },
    {
      chave: 'armadilhaFoto',
      rotulo: 'Armadilha fotográfica',
      unidade: 'armadilha-noite',
      unidadeLonga: 'armadilha por noite de exposição',
      descricao: 'Câmeras-trap expostas por um número de noites.',
      campos: [
        { chave: 'nCameras', rotulo: 'Nº de câmeras', unidade: '', passo: '1', padrao: 1 },
        { chave: 'noites', rotulo: 'Noites de exposição', unidade: '', passo: '1', padrao: 1 }
      ],
      esforco: function (e) { return prod(e.nCameras, e.noites); },
      area: function () { return null; }
    },
    {
      chave: 'pitfall',
      rotulo: 'Pitfall',
      unidade: 'balde-noite',
      unidadeLonga: 'balde por noite',
      descricao: 'Armadilha de queda, com baldes interligados por cerca-guia.',
      campos: [
        { chave: 'nBaldes', rotulo: 'Nº de baldes', unidade: '', passo: '1', padrao: 1 },
        { chave: 'noites', rotulo: 'Noites', unidade: '', passo: '1', padrao: 1 }
      ],
      esforco: function (e) { return prod(e.nBaldes, e.noites); },
      area: function () { return null; }
    },
    {
      chave: 'redeNeblina',
      rotulo: 'Rede de neblina',
      unidade: 'm²·h',
      unidadeLonga: 'metro quadrado de rede por hora aberta',
      descricao: 'Redes de neblina (mist nets) abertas por um período.',
      campos: [
        { chave: 'nRedes', rotulo: 'Nº de redes', unidade: '', passo: '1', padrao: 1 },
        { chave: 'areaM2', rotulo: 'Área por rede', unidade: 'm²', passo: '0,1', padrao: 12 },
        { chave: 'horas', rotulo: 'Horas abertas', unidade: 'h', passo: '0,1', padrao: 6 }
      ],
      esforco: function (e) { return prod3(e.nRedes, e.areaM2, e.horas); },
      area: function () { return null; }
    },
    {
      chave: 'buscaAtiva',
      rotulo: 'Busca ativa',
      unidade: 'hora·pessoa',
      unidadeLonga: 'hora de procura por observador',
      descricao: 'Procura visual e auditiva sem percurso fixo.',
      campos: [
        { chave: 'nObservadores', rotulo: 'Nº de observadores', unidade: '', passo: '1', padrao: 1 },
        { chave: 'horas', rotulo: 'Horas de procura', unidade: 'h', passo: '0,1', padrao: 1 }
      ],
      esforco: function (e) { return prod(e.nObservadores, e.horas); },
      area: function () { return null; }
    },
    {
      chave: 'playback',
      rotulo: 'Playback',
      unidade: 'hora',
      unidadeLonga: 'hora de emissão',
      descricao: 'Emissão de vocalizações para atrair espécies-alvo.',
      campos: [
        { chave: 'duracaoMin', rotulo: 'Duração', unidade: 'min', passo: '1', padrao: 30 },
        { chave: 'especiesAlvo', rotulo: 'Espécies-alvo', unidade: '', tipo: 'texto' }
      ],
      esforco: function (e) { var d = num(e.duracaoMin); return d === null ? null : d / 60; },
      area: function () { return null; }
    },
    {
      chave: 'redePesca',
      rotulo: 'Rede de pesca / peneira',
      unidade: 'm²·h',
      unidadeLonga: 'metro quadrado de rede por hora',
      descricao: 'Amostragem de ictiofauna com rede ou peneira.',
      campos: [
        { chave: 'areaM2', rotulo: 'Área de rede', unidade: 'm²', passo: '0,1', padrao: 10 },
        { chave: 'horas', rotulo: 'Horas', unidade: 'h', passo: '0,1', padrao: 1 }
      ],
      esforco: function (e) { return prod(e.areaM2, e.horas); },
      area: function () { return null; }
    }
  ];

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function prod(a, b) {
    var x = num(a), y = num(b);
    return (x === null || y === null) ? null : x * y;
  }
  function prod3(a, b, c) {
    var p = prod(a, b), z = num(c);
    return (p === null || z === null) ? null : p * z;
  }

  function metodo(chave) {
    for (var i = 0; i < METODOS.length; i++) if (METODOS[i].chave === chave) return METODOS[i];
    return METODOS[0];
  }

  /* =========================================================================
     REGISTRO — tipo de contato
     ====================================================================== */
  var TIPOS_REGISTRO = [
    { chave: 'visual', rotulo: 'Visual' },
    { chave: 'auditivo', rotulo: 'Auditivo' },
    { chave: 'vestigio', rotulo: 'Vestígio' },
    { chave: 'captura', rotulo: 'Captura' },
    { chave: 'carcaca', rotulo: 'Carcaça' },
    { chave: 'foto', rotulo: 'Foto' }
  ];

  var AREAS_INFLUENCIA = [
    { chave: 'ADA', rotulo: 'ADA — Área diretamente afetada' },
    { chave: 'AID', rotulo: 'AID — Área de influência direta' },
    { chave: 'AII', rotulo: 'AII — Área de influência indireta' },
    { chave: 'ADA/AID', rotulo: 'ADA / AID' }
  ];

  var SAZONALIDADES = [
    { chave: 'chuva', rotulo: 'Chuva' },
    { chave: 'seca', rotulo: 'Seca' },
    { chave: '', rotulo: '— não informada' }
  ];

  var FITOFISIONOMIAS = [
    'Floresta Estacional Semidecidual', 'Floresta Ombrófila Densa',
    'Cerrado sentido restrito', 'Cerradão', 'Campo rupestre', 'Campo sujo',
    'Campo limpo', 'Vereda', 'Mata ciliar', 'Mata de galeria',
    'Pastagem', 'Área antropizada', 'Reflorestamento', 'Corpo d’água', 'Outra'
  ];

  var UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

  /* `classe` é só o padrão que o formulário de táxon sugere para o grupo —
     nada no cálculo depende dela. */
  var GRUPOS = [
    { chave: 'aves', rotulo: 'Aves', classe: 'Aves' },
    { chave: 'mastofauna', rotulo: 'Mastofauna', classe: 'Mammalia' },
    { chave: 'herpetofauna', rotulo: 'Herpetofauna', classe: '' },
    { chave: 'ictiofauna', rotulo: 'Ictiofauna', classe: 'Actinopterygii' },
    { chave: 'entomofauna', rotulo: 'Entomofauna', classe: 'Insecta' },
    { chave: 'outro', rotulo: 'Outro grupo', classe: '' }
  ];

  function grupo(chave) {
    for (var i = 0; i < GRUPOS.length; i++) if (GRUPOS[i].chave === chave) return GRUPOS[i];
    return GRUPOS[0];
  }

  /* =========================================================================
     ATRIBUTOS DE AUTOECOLOGIA — chave/valor por grupo, extensível.
     O catálogo inicial é de aves (planilha `Autoecologia`, linha 4), mas nada
     no motor depende dele: acrescentar um atributo aqui basta.
     ====================================================================== */
  var ATRIBUTOS = [
    {
      chave: 'iucn', rotulo: 'IUCN', grupo: 'todos', curto: 'IUCN',
      ajuda: 'Categoria da Lista Vermelha da IUCN. Referência internacional, sem força legal no laudo brasileiro.',
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'LC', rotulo: 'LC — Pouco preocupante' },
        { valor: 'NT', rotulo: 'NT — Quase ameaçada' },
        { valor: 'VU', rotulo: 'VU — Vulnerável' },
        { valor: 'EN', rotulo: 'EN — Em perigo' },
        { valor: 'CR', rotulo: 'CR — Criticamente em perigo' },
        { valor: 'DD', rotulo: 'DD — Dados insuficientes' }
      ]
    },
    {
      chave: 'listaNacional', rotulo: 'Portaria MMA', grupo: 'todos', curto: 'MMA',
      ajuda: 'Lista Nacional de Espécies Ameaçadas. A Portaria MMA 444/2014 foi substituída pela 148/2022 — confira a vigente.',
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'VU', rotulo: 'VU — Vulnerável' },
        { valor: 'EN', rotulo: 'EN — Em perigo' },
        { valor: 'CR', rotulo: 'CR — Criticamente em perigo' }
      ]
    },
    {
      chave: 'listaEstadual', rotulo: 'Lista estadual', grupo: 'todos', curto: 'Estadual',
      ajuda: 'Lista estadual de espécies ameaçadas. Em Minas Gerais, Deliberação Normativa COPAM 147/2010.',
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'VU', rotulo: 'VU — Vulnerável' },
        { valor: 'EN', rotulo: 'EN — Em perigo' },
        { valor: 'CR', rotulo: 'CR — Criticamente em perigo' }
      ]
    },
    {
      /* Stotz et al. (1996) é uma referência de AVES. Aplicar essa escala a
         mamífero seria emprestar um número de outro grupo — por isso o
         atributo é declarado de aves e some do catálogo de mastofauna. */
      chave: 'sensibilidade', rotulo: 'Sensibilidade a distúrbio', grupo: 'aves', curto: 'Sensib.',
      ajuda: 'Sensibilidade a distúrbio antrópico (Stotz et al., 1996) — escala definida para aves.',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'b', rotulo: 'Baixa' },
        { valor: 'm', rotulo: 'Média' },
        { valor: 'a', rotulo: 'Alta' }
      ]
    },
    {
      chave: 'endemismo', rotulo: 'Endemismo', grupo: 'todos', curto: 'Endem.',
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'Brasil', rotulo: 'Brasil' },
        { valor: 'M. Atlântica', rotulo: 'Mata Atlântica' },
        { valor: 'Cerrado', rotulo: 'Cerrado' },
        { valor: 'Caatinga', rotulo: 'Caatinga' },
        { valor: 'Amazônia', rotulo: 'Amazônia' }
      ]
    },
    {
      chave: 'dependenciaMata', rotulo: 'Dependência de mata', grupo: 'aves', curto: 'Dep. mata',
      ajuda: 'Grau de dependência de ambientes florestais (Silva, 1995) — escala definida para aves.',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: '1', rotulo: '1 — Independente' },
        { valor: '2', rotulo: '2 — Semidependente' },
        { valor: '3', rotulo: '3 — Dependente' }
      ]
    },

    /* ---------------------------------------------------------- mastofauna
       O que substitui a autoecologia de ave. Não é tradução da escala de
       Stotz: são atributos próprios do grupo, com domínio próprio. */
    {
      chave: 'habito', rotulo: 'Hábito', grupo: 'mastofauna', curto: 'Hábito',
      ajuda: 'Uso do estrato: onde o animal se desloca e forrageia.',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'ter', rotulo: 'Terrestre' },
        { valor: 'arb', rotulo: 'Arborícola' },
        { valor: 'esc', rotulo: 'Escansorial (sobe e anda no chão)' },
        { valor: 'sem', rotulo: 'Semiaquático' },
        { valor: 'fos', rotulo: 'Fossorial / semifossorial' },
        { valor: 'ala', rotulo: 'Alado' }
      ]
    },
    {
      chave: 'atividade', rotulo: 'Período de atividade', grupo: 'mastofauna', curto: 'Atividade',
      ajuda: 'Período de maior atividade. É o que se lê direto do horário das fotos da armadilha.',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'diu', rotulo: 'Diurno' },
        { valor: 'not', rotulo: 'Noturno' },
        { valor: 'cre', rotulo: 'Crepuscular' },
        { valor: 'cat', rotulo: 'Catemeral (dia e noite)' }
      ]
    },
    {
      chave: 'porte', rotulo: 'Porte', grupo: 'mastofauna', curto: 'Porte',
      ajuda: 'Classe de massa corporal. O corte de 1 kg é o que separa a mastofauna de médio e grande porte da de pequeno porte.',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'peq', rotulo: 'Pequeno porte (< 1 kg)' },
        { valor: 'med', rotulo: 'Médio porte (1–10 kg)' },
        { valor: 'gra', rotulo: 'Grande porte (> 10 kg)' }
      ]
    },

    {
      chave: 'habitat', rotulo: 'Hábitat preferencial', grupo: 'todos', curto: 'Hábitat',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'cam', rotulo: 'Campestre' },
        { valor: 'flo', rotulo: 'Florestal' },
        { valor: 'aqu', rotulo: 'Aquático' },
        { valor: 'gen', rotulo: 'Generalista' },
        { valor: 'ant', rotulo: 'Antrópico' }
      ]
    },

    /* A guilda trófica tem o mesmo NOME em todos os grupos e um DOMÍNIO
       diferente em cada um: nectarívora é guilda de ave, folívora é de
       mamífero. Três entradas com a mesma chave e grupos diferentes —
       `atributosDoGrupo` escolhe a certa. */
    {
      chave: 'dieta', rotulo: 'Guilda trófica', grupo: 'aves', curto: 'Guilda',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'car', rotulo: 'Carnívora' },
        { valor: 'nec', rotulo: 'Nectarívora' },
        { valor: 'gen', rotulo: 'Generalista' },
        { valor: 'ins', rotulo: 'Insetívora' },
        { valor: 'fru', rotulo: 'Frugívora' },
        { valor: 'gra', rotulo: 'Granívora' },
        { valor: 'oni', rotulo: 'Onívora' },
        { valor: 'det', rotulo: 'Detritívora' },
        { valor: 'pis', rotulo: 'Piscívora' }
      ]
    },
    {
      chave: 'dieta', rotulo: 'Guilda trófica', grupo: 'mastofauna', curto: 'Guilda',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'car', rotulo: 'Carnívora' },
        { valor: 'oni', rotulo: 'Onívora' },
        { valor: 'her', rotulo: 'Herbívora' },
        { valor: 'fol', rotulo: 'Folívora' },
        { valor: 'fru', rotulo: 'Frugívora' },
        { valor: 'gra', rotulo: 'Granívora' },
        { valor: 'ins', rotulo: 'Insetívora / mirmecófaga' },
        { valor: 'hem', rotulo: 'Hematófaga' },
        { valor: 'pis', rotulo: 'Piscívora' }
      ]
    },
    {
      chave: 'dieta', rotulo: 'Guilda trófica', grupo: 'todos', curto: 'Guilda',
      grafico: true,
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'car', rotulo: 'Carnívora' },
        { valor: 'gen', rotulo: 'Generalista' },
        { valor: 'ins', rotulo: 'Insetívora' },
        { valor: 'fru', rotulo: 'Frugívora' },
        { valor: 'her', rotulo: 'Herbívora' },
        { valor: 'oni', rotulo: 'Onívora' },
        { valor: 'det', rotulo: 'Detritívora' },
        { valor: 'pis', rotulo: 'Piscívora' }
      ]
    },
    {
      chave: 'migratoria', rotulo: 'Migratória', grupo: 'todos', curto: 'Migr.',
      opcoes: [
        { valor: '', rotulo: '—' },
        { valor: 'sim', rotulo: 'Sim' },
        { valor: 'nao', rotulo: 'Não' },
        { valor: 'parcial', rotulo: 'Parcial' }
      ]
    },
    {
      chave: 'cinegetica', rotulo: 'Cinegética', grupo: 'todos', curto: 'Cineg.',
      opcoes: [{ valor: '', rotulo: '—' }, { valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
    },
    {
      chave: 'exotica', rotulo: 'Exótica', grupo: 'todos', curto: 'Exót.',
      opcoes: [{ valor: '', rotulo: '—' }, { valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
    }
  ];

  /**
   * O atributo de uma chave DENTRO de um grupo.
   * A mesma chave pode existir mais de uma vez com grupos diferentes —
   * `dieta` tem um domínio para ave (nectarívora) e outro para mamífero
   * (folívora). O específico do grupo ganha do 'todos'.
   */
  function atributo(chave, grupo) {
    var geral = null;
    for (var i = 0; i < ATRIBUTOS.length; i++) {
      var a = ATRIBUTOS[i];
      if (a.chave !== chave) continue;
      if (grupo && a.grupo === grupo) return a;      // específico do grupo
      if (a.grupo === 'todos' && !geral) geral = a;
    }
    if (geral) return geral;
    /* Sem grupo pedido (ou grupo sem entrada própria): devolve a primeira
       ocorrência, para não quebrar quem chama sem saber o grupo. */
    for (var j = 0; j < ATRIBUTOS.length; j++) if (ATRIBUTOS[j].chave === chave) return ATRIBUTOS[j];
    return null;
  }

  /**
   * O catálogo de autoecologia de um grupo: os atributos de 'todos' mais os
   * próprios do grupo, na ordem de declaração, uma entrada por chave.
   *
   * É ISTO que faz o app servir a qualquer grupo da fauna. Dependência de
   * mata (Silva, 1995) e sensibilidade (Stotz et al., 1996) são escalas de
   * AVE: para mastofauna elas não aparecem, e no lugar entram hábito,
   * período de atividade e porte. Acrescentar um grupo novo é acrescentar
   * linhas em ATRIBUTOS — nenhuma tela precisa saber que ele existe.
   */
  function atributosDoGrupo(grupo) {
    var ordem = [], vistos = {};
    ATRIBUTOS.forEach(function (a) {
      if (vistos[a.chave]) return;
      vistos[a.chave] = 1;
      ordem.push(a.chave);
    });
    var saida = [];
    ordem.forEach(function (chave) {
      var escolhido = null;
      for (var i = 0; i < ATRIBUTOS.length; i++) {
        var a = ATRIBUTOS[i];
        if (a.chave !== chave) continue;
        if (grupo && a.grupo === grupo) { escolhido = a; break; }
        if (a.grupo === 'todos' && !escolhido) escolhido = a;
      }
      if (escolhido) saida.push(escolhido);
    });
    return saida;
  }

  /** Os atributos que rendem gráfico de composição neste grupo. */
  function atributosGrafico(grupo) {
    return atributosDoGrupo(grupo).filter(function (a) { return a.grafico; });
  }

  /* Comparação de valor de atributo sem depender da caixa das letras.
     Vale só para estes domínios fechados e codificados (siglas como VU, EN,
     LC; códigos como 'cam', 'ins'), onde a caixa não carrega significado
     nenhum e a planilha vem com 'B' e 'b' misturados na mesma coluna.
     Nome científico é o oposto e nunca passa por aqui. */
  function mesmoCodigo(a, b) {
    return String(a === undefined || a === null ? '' : a).trim().toLowerCase() ===
           String(b === undefined || b === null ? '' : b).trim().toLowerCase();
  }

  function rotuloAtributo(chave, valor, grupo) {
    var a = atributo(chave, grupo);
    if (!a || valor === '' || valor === null || valor === undefined) return '—';
    for (var i = 0; i < a.opcoes.length; i++) {
      if (mesmoCodigo(a.opcoes[i].valor, valor)) return a.opcoes[i].rotulo;
    }
    return String(valor);
  }

  /** Categorias que caracterizam ameaça em qualquer das três listas. */
  var AMEACA = ['VU', 'EN', 'CR'];

  /** A espécie está ameaçada segundo o valor informado nesta lista? */
  function ehAmeaca(valor) {
    if (!valor) return false;
    return AMEACA.indexOf(String(valor).trim().toUpperCase()) >= 0;
  }

  /** Sigla normalizada para exibição (VU, EN, CR, LC…). */
  function siglaAmeaca(valor) {
    return valor ? String(valor).trim().toUpperCase() : '';
  }

  /* Avisos jurídicos que o app precisa carregar para o laudo (§6 da spec). */
  var AVISOS_LEGAIS = [
    'A Portaria MMA 444/2014 foi substituída pela Portaria MMA 148/2022. Confira se a lista ' +
    'usada no laudo é a vigente — lista desatualizada em documento oficial é passivo.',
    'A API da IUCN proíbe uso comercial (consultoria remunerada é uso comercial). As listas com ' +
    'força legal no laudo brasileiro são a Portaria do MMA e a estadual, atos normativos públicos. ' +
    'A categoria IUCN entra aqui apenas como referência, digitada pelo responsável técnico.'
  ];

  global.DADOS = {
    METODOS: METODOS, metodo: metodo,
    TIPOS_REGISTRO: TIPOS_REGISTRO,
    AREAS_INFLUENCIA: AREAS_INFLUENCIA,
    SAZONALIDADES: SAZONALIDADES,
    FITOFISIONOMIAS: FITOFISIONOMIAS,
    UFS: UFS,
    GRUPOS: GRUPOS, grupo: grupo,
    ATRIBUTOS: ATRIBUTOS, atributo: atributo, rotuloAtributo: rotuloAtributo,
    atributosDoGrupo: atributosDoGrupo, atributosGrafico: atributosGrafico,
    AMEACA: AMEACA, ehAmeaca: ehAmeaca, siglaAmeaca: siglaAmeaca, mesmoCodigo: mesmoCodigo,
    AVISOS_LEGAIS: AVISOS_LEGAIS,
    num: num
  };
})(typeof window !== 'undefined' ? window : globalThis);
