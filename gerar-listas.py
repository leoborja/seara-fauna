#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Converte o CSV da Lista Nacional de Espécies Ameaçadas em `js/listas-oficiais.js`.

O app é de zero dependências e tem que cruzar a lista OFFLINE — é consulta
pura, não precisa de rede para nada. Por isso o CSV vira um arquivo JS
embutido, gerado uma vez, aqui fora.

    python3 gerar-listas.py

Fonte do dado: Portal Brasileiro de Dados Abertos (dados.gov.br), conjunto
"Espécies da fauna brasileira ameaçadas de extinção", Ministério do Meio
Ambiente. Licença Creative Commons Atribuição.

ATENÇÃO — a limitação que precisa estar declarada no app:
este CSV é o documento de REAVALIAÇÃO de 2021, não o anexo literal da
Portaria MMA nº 148/2022. As duas coincidem na esmagadora maioria dos
táxons, mas o que tem força legal no laudo é a portaria.
"""

import csv
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
ENTRADA = RAIZ / 'dados' / 'fauna-ameacada-2021.csv'
SAIDA = RAIZ / 'js' / 'listas-oficiais.js'

# Categoria por extenso → sigla. A sigla vem entre parênteses no próprio
# texto, então a regra geral é extraí-la; o dicionário é a conferência.
SIGLAS = {
    'criticamente em perigo': 'CR',
    'em perigo': 'EN',
    'vulneravel': 'VU',
    'quase ameacada': 'NT',
    'menos preocupante': 'LC',
    'dados insuficientes': 'DD',
    'regionalmente extinta': 'RE',
    'extinta': 'EX',
    'extinta na natureza': 'EW',
}


def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def normalizar(s):
    return re.sub(r'\s+', ' ', sem_acento(str(s or '')).strip().lower())


def categoria(bruto):
    """(sigla, provavelmente_extinta, observacao)"""
    s = str(bruto or '').strip()
    if not s:
        return '', 0, ''
    # "[Sinonímia M. hypostoma]", "[Não é espécie brasileira]" e afins
    if s.startswith('['):
        return '', 0, s.strip('[]')
    pex = 1 if '(PEX)' in s.upper() else 0
    achados = re.findall(r'\(([A-Z]{2})\)', s.upper())
    achados = [a for a in achados if a != 'PE']  # PEX já tratado
    if achados:
        return achados[0], pex, ''
    chave = normalizar(re.sub(r'\(.*?\)', '', s))
    if chave in SIGLAS:
        return SIGLAS[chave], pex, ''
    return '', 0, s


def main():
    if not ENTRADA.exists():
        sys.exit('Não encontrei %s' % ENTRADA)

    with ENTRADA.open(encoding='utf-8-sig', newline='') as f:
        linhas = list(csv.DictReader(f, delimiter=';'))

    registros = []
    problemas = []
    vistos = {}

    for l in linhas:
        nome = re.sub(r'\s+', ' ', (l.get('Espécie ou Subespécie') or '').strip())
        if not nome:
            continue
        grupo = re.sub(r'\s+', ' ', (l.get('Grupo taxonômico') or '').strip())
        ordem = (l.get('Ordem') or '').strip()
        familia = (l.get('Família') or '').strip()
        c14, pex14, obs14 = categoria(l.get('Categoria em 2014'))
        c21, pex21, obs21 = categoria(l.get('Sugestão de Categoria 2021'))
        obs = obs21 or obs14
        pex = 1 if (pex21 or (pex14 and not c21)) else 0

        if not c14 and not c21 and not obs:
            problemas.append('%s — sem categoria legível' % nome)

        chave = normalizar(nome)
        if chave in vistos:
            problemas.append('%s — aparece mais de uma vez no CSV' % nome)
            continue
        vistos[chave] = 1

        reg = [grupo, ordem, familia, nome, c14, c21, pex]
        if obs:
            reg.append(obs)
        registros.append(reg)

    registros.sort(key=lambda r: normalizar(r[3]))

    corpo = ',\n'.join('    ' + json.dumps(r, ensure_ascii=False) for r in registros)

    cab = '''/* ============================================================================
   Seara Biologia — Fauna — listas-oficiais.js

   ARQUIVO GERADO. Não edite à mão — rode `python3 gerar-listas.py`.

   Lista Nacional de Espécies da Fauna Ameaçadas de Extinção, embutida para
   que o cruzamento funcione OFFLINE: é consulta pura, não tem por que
   depender de rede.

   FONTE: Portal Brasileiro de Dados Abertos (dados.gov.br) — conjunto
   "Espécies da fauna brasileira ameaçadas de extinção", Ministério do Meio
   Ambiente. Licença Creative Commons Atribuição.
   Arquivo de origem: dados/fauna-ameacada-2021.csv (%(n)d táxons).
   Convertido em %(hoje)s.

   A LIMITAÇÃO, QUE O APP DECLARA NA TELA E NO LAUDO:
   este CSV é o documento de REAVALIAÇÃO de 2021 — não é o anexo literal da
   Portaria MMA nº 148/2022, que é o ato com força legal. Use como triagem;
   confira contra a portaria antes de assinar.

   LISTAS ESTADUAIS: não há, até hoje, fonte legível por máquina da
   Deliberação Normativa COPAM 147/2010 (MG) nem das demais estaduais. A
   estrutura está pronta (ESTADUAIS), mas VAZIA de propósito — a coluna
   "Lista estadual" continua sendo preenchida à mão. Melhor faltar o dado do
   que inventá-lo.

   Cada registro: [grupo, ordem, família, nome, categoria2014, categoria2021,
                   provavelmenteExtinta, observação?]
   ========================================================================== */
(function (global) {
  'use strict';

  var FONTE = {
    nome: 'Lista Nacional de Espécies Ameaçadas de Extinção — reavaliação de 2021',
    orgao: 'Ministério do Meio Ambiente',
    portal: 'Portal Brasileiro de Dados Abertos (dados.gov.br)',
    licenca: 'Creative Commons Atribuição',
    arquivo: 'fauna-ameacada-2021.csv',
    convertidoEm: '%(hoje)s',
    taxons: %(n)d,
    limitacao: 'Documento de reavaliação de 2021. NÃO é o anexo literal da Portaria MMA nº 148/2022, ' +
      'que é o ato com força legal. Use como triagem e confira contra a portaria antes de assinar.'
  };

  /* Nenhuma lista estadual legível por máquina foi encontrada. Vazio de
     propósito: a coluna "Lista estadual" continua manual. */
  var ESTADUAIS = {
    disponiveis: [],
    nota: 'Nenhuma lista estadual está embutida. Em Minas Gerais vale a Deliberação Normativa ' +
      'COPAM 147/2010, que não tem versão legível por máquina publicada. A coluna "Lista estadual" ' +
      'continua sendo preenchida por você, à mão.'
  };

  var REGISTROS = [
''' % {'n': len(registros), 'hoje': date.today().isoformat()}

    rodape = '''
  ];

  /* ------------------------------------------------------------ utilidades */

  /** minúsculas, sem acento, espaços colapsados — só para COMPARAR.
      A grafia original fica intacta em `nome` e é ela que aparece na tela. */
  function normalizar(s) {
    return String(s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/\\s+/g, ' ');
  }

  function objeto(r) {
    return {
      grupo: r[0], ordem: r[1], familia: r[2], nome: r[3],
      categoria2014: r[4], categoria2021: r[5],
      provavelmenteExtinta: !!r[6],
      observacao: r[7] || '',
      /* A vigente é a de 2021 quando existe; senão, a de 2014. */
      categoria: r[5] || r[4],
      ano: r[5] ? 2021 : (r[4] ? 2014 : null)
    };
  }

  /* Índices montados uma vez: nome completo e binômio (as duas primeiras
     palavras), para casar espécie do catálogo com subespécie da lista. */
  var PORNOME = null, PORBINOMIO = null;

  function indexar() {
    if (PORNOME) return;
    PORNOME = {}; PORBINOMIO = {};
    REGISTROS.forEach(function (r) {
      var k = normalizar(r[3]);
      PORNOME[k] = r;
      var p = k.split(' ');
      if (p.length >= 2) {
        var bin = p[0] + ' ' + p[1];
        if (!PORBINOMIO[bin]) PORBINOMIO[bin] = [];
        PORBINOMIO[bin].push(r);
      }
    });
  }

  /**
   * Procura um nome científico na lista oficial.
   *
   * @returns {null | {tipo, registro, categoria, ano, subespecies}}
   *   tipo 'exata'      — o nome está na lista como está
   *   tipo 'subespecie' — a lista traz SUBESPÉCIES desta espécie, não a
   *                       espécie inteira. A diferença é jurídica: proteger
   *                       a subespécie não é proteger a espécie. Nunca
   *                       aplicado sozinho — vira sugestão a decidir.
   *   tipo 'especie'    — o catálogo traz subespécie e a lista, a espécie.
   */
  function buscar(nome) {
    indexar();
    var k = normalizar(nome);
    if (!k) return null;

    if (PORNOME[k]) {
      return { tipo: 'exata', registro: objeto(PORNOME[k]), subespecies: [] };
    }

    var p = k.split(' ');
    if (p.length < 2) return null;
    var bin = p[0] + ' ' + p[1];

    /* catálogo com subespécie, lista com a espécie */
    if (p.length > 2 && PORNOME[bin]) {
      return { tipo: 'especie', registro: objeto(PORNOME[bin]), subespecies: [] };
    }

    /* catálogo com a espécie, lista só com subespécies dela */
    if (p.length === 2 && PORBINOMIO[bin]) {
      var subs = PORBINOMIO[bin].filter(function (r) {
        return normalizar(r[3]) !== bin;
      });
      if (subs.length) {
        return {
          tipo: 'subespecie',
          registro: objeto(subs[0]),
          subespecies: subs.map(objeto)
        };
      }
    }
    return null;
  }

  /** Quantos táxons a lista traz de um grupo (para a nota de rodapé). */
  function contar(filtro) {
    if (!filtro) return REGISTROS.length;
    var f = normalizar(filtro);
    return REGISTROS.filter(function (r) { return normalizar(r[0]).indexOf(f) >= 0; }).length;
  }

  global.LISTAS_OFICIAIS = {
    FONTE: FONTE,
    ESTADUAIS: ESTADUAIS,
    REGISTROS: REGISTROS,
    buscar: buscar,
    contar: contar,
    normalizar: normalizar,
    objeto: objeto
  };
})(typeof window !== 'undefined' ? window : globalThis);
'''

    SAIDA.write_text(cab + corpo + rodape, encoding='utf-8')

    print('%d táxons gravados em %s (%.0f KB)' %
          (len(registros), SAIDA.relative_to(RAIZ), SAIDA.stat().st_size / 1024))
    com21 = sum(1 for r in registros if r[5])
    aves = sum(1 for r in registros if r[0] == 'Aves')
    print('  com categoria de 2021: %d · sem: %d' % (com21, len(registros) - com21))
    print('  Aves: %d' % aves)
    if problemas:
        print('  avisos (%d):' % len(problemas))
        for p in problemas[:15]:
            print('    - %s' % p)


if __name__ == '__main__':
    main()
