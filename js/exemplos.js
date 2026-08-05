/* ============================================================================
   Seara Biologia — Fauna — exemplos.js
   Os projetos de demonstração. São dois, de propósito, e de grupos e métodos
   diferentes:

     avifauna     · transecto · km               · dados reais da planilha
     mastofauna   · armadilha fotográfica · armadilha-noite · 3 campanhas

   O segundo existe para PROVAR que o núcleo não é de ave nem de transecto.
   Ele usa a unidade de esforço própria do método, a autoecologia própria do
   grupo (hábito, período de atividade, porte — não dependência de mata nem
   sensibilidade de Stotz, que são escalas de ave) e três campanhas, para
   exercitar a comparação com N > 2.

   Os dados são guardados em forma compacta e montados no modelo do app pela
   função `montar`. Nada aqui é lido de arquivo externo: o app abre em
   file:// sem servidor.
   ========================================================================== */
(function (global) {
  'use strict';

  /* Cada táxon é [ordem, família, nome científico, nome comum, atributos, extra].
     `extra` guarda autor e a marca de fora do catálogo. */
  var EXEMPLOS = [

  {
    chave: 'avifauna',
    rotulo: 'Avifauna — Mineração (exemplo)',
    resumo: 'Transecto · km · 2 campanhas · 60 táxons · dados reais da planilha de origem',
    grupo: 'aves',
    projeto: {
      nome: 'Mineração — exemplo (Mariana/MG)',
      cliente: '',
      municipio: 'Mariana', uf: 'MG',
      orgao: '', processo: '',
      responsavel: '', registroProfissional: '',
      grupo: 'aves',
      observacao: 'Importado da planilha planilha de origem (avifauna).',
      secundarios: {
        titulo: 'Espécies de aves registradas na Serra da Calçada no município de Brumadinho/MG',
        autores: 'FRANCO, E. publicado no Taxeus — Lista de Espécies',
        especies: []
      }
    },
    classe: 'Aves',
    tipoPadrao: 'visual',
    origem: 'planilha de origem (avifauna)',
    taxons: [
      ["Accipitriformes","Accipitridae","Geranoaetus albicaudatus","Gavião de rabo branco",{"sensibilidade":"m","dependenciaMata":"1","habitat":"cam","dieta":"car"}],
      ["Apodiformes","Trochilidae","Chionomesa lactea","Beija flor de peito azul",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"nec"}],
      ["Apodiformes","Trochilidae","Phaethornis pretrei","Rabo branco acanelado",{"sensibilidade":"b","dependenciaMata":"2","habitat":"cam","dieta":"nec"}],
      ["Caprimulgiformes","Caprimulgidae","Hydropsalis parvula","Bacurau chintã",{"sensibilidade":"m","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Caprimulgiformes","Caprimulgidae","Nyctidromus albicollis","Bacurau",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"ins"}],
      ["Cariamiformes","Cariamidae","Cariama cristata","Seriema",{"sensibilidade":"m","dependenciaMata":"1","habitat":"cam","dieta":"ins"}],
      ["Charadriiformes","Charadriidae","Vanellus chilensis","Quero quero",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"car"}],
      ["Columbiformes","Columbidae","Columbina squammata","Fogo apagou",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"gra"}],
      ["Columbiformes","Columbidae","Columbina talpacoti","Rolinha roxa",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"gra"}],
      ["Columbiformes","Columbidae","Leptotila rufaxilla","Juriti gemedeira",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"gra"}],
      ["Columbiformes","Columbidae","Patagioenas picazuro","Pombão",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"gra"}],
      ["Columbiformes","Columbidae","Patagioenas plumbea","Pomba amargosa",{"sensibilidade":"a","dependenciaMata":"3","habitat":"flo","dieta":"gra"}],
      ["Coraciiformes","Alcedinidae","Chloroceryle americana","Martim pescador pequeno",{"sensibilidade":"b","dependenciaMata":"1","habitat":"aqu","dieta":"pis"}],
      ["Cuculiformes","Cuculidae","Piaya cayana","Alma de gato",{"sensibilidade":"b","dependenciaMata":"2","habitat":"flo","dieta":"ins"}],
      ["Cuculiformes","Cuculidae","Tapera naevia","Saci",{"sensibilidade":"b","dependenciaMata":"2","habitat":"flo","dieta":"ins"}],
      ["Galbuliformes","Galbulidae","Jacamaralcyon tridactyla","Cuitelão",{"iucn":"VU","sensibilidade":"m","dependenciaMata":"2","habitat":"flo","dieta":"ins"}],
      ["Gruiformes","Rallidae","Aramides saracura","Saracura do mato",{"sensibilidade":"b","dependenciaMata":"2","habitat":"flo","dieta":"oni"}],
      ["Passeriformes","Fringillidae","Euphonia chlorotica","Fim fim",{"sensibilidade":"b","dependenciaMata":"2","habitat":"flo","dieta":"fru"}],
      ["Passeriformes","Furariidae","Furnarius rufus","joão de barro",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Furariidae","Synallaxis spixi","João teneném",{"sensibilidade":"b","dependenciaMata":"2","habitat":"cam","dieta":"ins"}],
      ["Passeriformes","Furariidae","Synallaxis frontalis","Petrim",{"sensibilidade":"b","dependenciaMata":"2","habitat":"cam","dieta":"ins"}],
      ["Passeriformes","Hirundinidae","Alopochelidon fucata","Andorinha morena",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"ins"}],
      ["Passeriformes","Hirundinidae","Progne tapera","Andorinha do campo",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"ins"}],
      ["Passeriformes","Hirundinidae","Pygochelidon cyanoleuca","Andorinha pequena de casa",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Icteridae","Cacicus haemorrhous","Guaxe",{"sensibilidade":"m","dependenciaMata":"3","habitat":"flo","dieta":"oni"}],
      ["Passeriformes","Icteridae","Gnorimopsar chopi","Melro",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"oni"}],
      ["Passeriformes","Icteridae","Icterus jamacaii","Corrupião",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"oni"}],
      ["Passeriformes","Parulidae","Basileuterus culicivorus","Pula-pula",{"sensibilidade":"m","dependenciaMata":"3","habitat":"flo","dieta":"ins"}],
      ["Passeriformes","Passerellidae","Zonotrichia capensis","Tico tico",{"sensibilidade":"b","dependenciaMata":"2","habitat":"cam","dieta":"gra"}],
      ["Passeriformes","Rhynchocyclidae","Todirostrum poliocephalum","Teque teque",{"sensibilidade":"m","dependenciaMata":"2","habitat":"flo","dieta":"ins"}],
      ["Passeriformes","Thamnophilidae","Thamnophilus caerulescens","Choca da mata",{"sensibilidade":"b","dependenciaMata":"2","habitat":"flo","dieta":"oni"}],
      ["Passeriformes","Thraupidae","Conirostrum speciosum","Figuinha de rabo castanho",{"sensibilidade":"m","dependenciaMata":"2","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Thraupidae","Saltator similis","Trinca ferro",{"sensibilidade":"m","dependenciaMata":"2","habitat":"flo","dieta":"oni"}],
      ["Passeriformes","Thraupidae","Sicalis flaveola","Canário da terra",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"gra"}],
      ["Passeriformes","Thraupidae","Stilpnia cayana","Saíra amarela",{"sensibilidade":"b","dependenciaMata":"1","habitat":"flo","dieta":"fru"}],
      ["Passeriformes","Thraupidae","Thraupis palmarum","Sanhaçu do coqueiro",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"fru"}],
      ["Passeriformes","Thraupidae","Thraupis sayaca","Sanhaçu",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"oni"}],
      ["Passeriformes","Troglodytidae","Troglodytes musculus","Corruíra",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Turdidae","Turdus amaurochalinus","Sabiá poca",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"oni"}],
      ["Passeriformes","Turdidae","Turdus leucomelas","Sabiá barranco",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"oni"}],
      ["Passeriformes","Turdidae","Turdus rufiventris","Sabiá laranjeira",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"oni"}],
      ["Passeriformes","Tyrannidae","Camptostoma obsoletum","Risadinha",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Tyrannidae","Empidonomus varius","Peitica",{"sensibilidade":"b","dependenciaMata":"2","habitat":"flo","dieta":"ins"}],
      ["Passeriformes","Tyrannidae","Fluvicola nengeta","Lavadeira mascarada",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"ins"}],
      ["Passeriformes","Tyrannidae","Hirundinea ferruginea","Gibão de couro",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Tyrannidae","Machetornis rixosa","Suiriri cavaleiro",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Tyrannidae","Pitangus sulphuratus","Bem te vi",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"oni"}],
      ["Passeriformes","Tyrannidae","Tyrannus melancholicus","Suiriri",{"sensibilidade":"m","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Passeriformes","Tyrannidae","Tyrannus savana","Tesourinha",{"sensibilidade":"b","dependenciaMata":"1","habitat":"gen","dieta":"ins"}],
      ["Pelecaniformes","Ardeidae","Egretta thula","Garça branca",{"sensibilidade":"b","dependenciaMata":"1","habitat":"aqu","dieta":"pis"}],
      ["Pelecaniformes","Ardeidae","Nycticorax nycticorax","Savacu",{"sensibilidade":"b","dependenciaMata":"1","habitat":"aqu","dieta":"car"}],
      ["Psittaciformes","Psittacidae","Amazona aestiva","Papagaio verdadeiro",{"sensibilidade":"m","dependenciaMata":"1","habitat":"flo","dieta":"fru"}],
      ["Psittaciformes","Psittacidae","Amazona vinacea","Papagaio de peito roxo",{"iucn":"EN","listaEstadual":"VU","sensibilidade":"m","dependenciaMata":"1","habitat":"flo","dieta":"fru"}],
      ["Psittaciformes","Psittacidae","Aratinga auricapillus","Jandaia da testa vermelha",{"sensibilidade":"b","dependenciaMata":"1","habitat":"cam","dieta":"fru"}],
      ["Psittaciformes","Psittacidae","Forpus xanthopterygius","Tuim",{"sensibilidade":"b","dependenciaMata":"2","habitat":"gen","dieta":"fru"}],
      ["Psittaciformes","Psittacidae","Primolius maracana","Maracanã verdadeira",{"sensibilidade":"m","dependenciaMata":"1","habitat":"flo","dieta":"fru"}],
      ["Psittaciformes","Psittacidae","Psittacara leucophthalmus","Periquitão maracanã",{"sensibilidade":"m","dependenciaMata":"2","habitat":"gen","dieta":"fru"}],
      ["Strigiformes","Strigidae","Bubo virginianus","Jacurutu",{"sensibilidade":"b","dependenciaMata":"2","habitat":"cam","dieta":"car"}],
      ["Strigiformes","Strigidae","Megascops choliba","Corujinha do mato",{"sensibilidade":"b","dependenciaMata":"2","habitat":"flo","dieta":"car"}],
      ["Galbuliformes","Galbulidae","Brachygalba lugubris","Ariramba preta",{},{"fora":1}]
    ],
    campanhas: [
      {
        rotulo: "1ª campanha", sazonalidade: "chuva", dataInicio: "2022-09-24", dataFim: "2022-09-26",
        metodo: 'transecto',
        unidades: [
        {"codigo":"TST 01","data":"2022-09-24","areaInfluencia":"ADA/AID","esforco":{"larguraM":50},"regs":[[47,1],[32,1],[44,2],[27,1],[37,1],[21,1],[6,2],[10,1],[34,1],[43,2],[16,2],[0,1],[13,1],[57,1],[4,1],[58,1],[3,1]]},
        {"codigo":"TST 02","data":"2022-09-24","areaInfluencia":"ADA/AID","esforco":{"larguraM":50},"regs":[[12,2],[37,1],[10,1],[21,1],[38,2],[32,1],[49,1],[50,1],[31,1],[40,1],[46,1],[29,2],[2,1],[53,1]]},
        {"codigo":"TST 03","data":"2022-09-24","areaInfluencia":"ADA/AID","esforco":{"larguraM":50},"regs":[[32,2],[14,1],[37,1],[5,2],[39,1],[28,1]]},
        {"codigo":"TST 04","data":"2022-09-25","areaInfluencia":"ADA/AID","esforco":{"larguraM":50},"regs":[[52,4],[32,1],[33,1],[30,2],[21,1],[9,1],[39,1],[11,1],[40,1],[18,2],[37,1],[38,1],[41,1],[51,1]]},
        {"codigo":"TST 05","data":"2022-09-25","areaInfluencia":"AID","esforco":{"larguraM":50},"regs":[[36,1],[33,1],[32,1],[59,1],[1,1],[27,1],[20,1]]},
        {"codigo":"TST 06","data":"2022-09-25","areaInfluencia":"","esforco":{"larguraM":50},"regs":[[47,1],[32,5],[23,1],[38,1],[44,1]]},
        {"codigo":"TST 07","data":"2022-09-25","areaInfluencia":"","esforco":{"larguraM":50},"regs":[[34,1],[40,1],[44,1],[9,4],[7,1],[8,1],[23,1]]},
        {"codigo":"TST 08","data":"2022-09-25","areaInfluencia":"","esforco":{"larguraM":50},"regs":[[30,1],[32,1],[38,1],[17,1]]},
        {"codigo":"TST 09","data":"2022-09-26","areaInfluencia":"","esforco":{"larguraM":50},"regs":[[32,1],[37,1],[52,1],[22,1],[34,1],[36,2]]},
        {"codigo":"TST 10","data":"2022-09-26","areaInfluencia":"","esforco":{"larguraM":50},"regs":[[32,1],[33,1],[34,1],[36,1],[54,1]]}
        ]
      },
      {
        rotulo: "2ª campanha", sazonalidade: "seca", dataInicio: "", dataFim: "",
        metodo: 'transecto',
        unidades: [

        ]
      }
    ],
    avisos: [
      "“Brachygalba lugubris” (Galbulidae, Inf campo) aparece em TST 05 mas não está na aba Autoecologia. Entrou no catálogo marcado como fora do catálogo — confira se não é o mesmo bicho com outro nome.",
      "A planilha não traz o comprimento de 10 transecto(s) (TST 01, TST 02, TST 03, TST 04, TST 05, TST 06, TST 07, TST 08, TST 09, TST 10). Sem esforço não há densidade nem comparação entre métodos — preencha na tela de Unidades amostrais.",
      "11 espécie(s) do catálogo de autoecologia não têm registro em nenhuma unidade amostral. Na planilha elas vieram de observação ocasional, fora dos transectos: crie uma unidade de busca ativa para elas, senão não entram na riqueza nem na curva do coletor.",
      "Campanha(s) sem nenhuma unidade amostral: 2ª campanha. Na planilha as abas existem duplicadas mas estão em branco."
    ]
  },

  {
    chave: 'mastofauna',
    rotulo: 'Mastofauna de médio e grande porte — PCH Ribeirão do Cedro',
    resumo: 'Armadilha fotográfica · armadilha-noite · 3 campanhas · 23 espécies',
    grupo: 'mastofauna',
    projeto: {
      nome: 'PCH Ribeirão do Cedro',
      cliente: 'Cedro Energia S.A.',
      municipio: 'Conceição do Mato Dentro', uf: 'MG',
      orgao: 'SUPRAM Central Metropolitana / SEMAD-MG',
      processo: '01234/2025/001/2025',
      responsavel: 'João — Seara Biologia',
      registroProfissional: 'CRBio 00000/04-D',
      grupo: 'mastofauna',
      observacao: 'Projeto de demonstração do app com um grupo e um método diferentes dos da ' +
        'planilha de origem: mastofauna de médio e grande porte por armadilha fotográfica, ' +
        'esforço em armadilha-noite. Os dados de campo são fictícios. A nomenclatura foi ' +
        'conferida na GBIF (23/23 exatas e aceitas); a autoecologia e as categorias de ameaça ' +
        'são ilustrativas e têm de ser conferidas contra a lista vigente antes de ir para laudo.',
      secundarios: {
        titulo: 'Mamíferos de médio e grande porte do Espinhaço Meridional — levantamento secundário',
        autores: 'levantamento de literatura (lista digitada pelo responsável técnico)',
        especies: [
          'Cerdocyon thous', 'Chrysocyon brachyurus', 'Puma concolor', 'Panthera onca',
          'Leopardus pardalis', 'Myrmecophaga tridactyla', 'Tapirus terrestris',
          'Mazama americana', 'Mazama gouazoubira', 'Pecari tajacu', 'Tayassu pecari',
          'Cuniculus paca', 'Dasyprocta azarae', 'Hydrochoerus hydrochaeris',
          'Nasua nasua', 'Eira barbara', 'Galictis cuja', 'Lontra longicaudis',
          'Didelphis aurita', 'Dasypus novemcinctus', 'Euphractus sexcinctus',
          'Cabassous unicinctus', 'Priodontes maximus', 'Alouatta guariba',
          'Callithrix penicillata', 'Sapajus nigritus'
        ]
      }
    },
    classe: 'Mammalia',
    tipoPadrao: 'foto',
    origem: 'dados fictícios',
    avisos: [
      'Este é o exemplo de mastofauna: grupo, método e unidade de esforço diferentes dos da ' +
      'planilha de origem. Serve para conferir que os cálculos, a curva do coletor e o laudo ' +
      'não dependem de ave nem de transecto.',
      'Os dados de campo são fictícios e as categorias de ameaça são ilustrativas. Confira ' +
      'contra a Portaria MMA vigente e a lista estadual antes de usar qualquer número em laudo.'
    ],
    taxons: [
      ["Didelphimorphia","Didelphidae","Didelphis aurita","Gambá-de-orelha-preta",{"iucn":"LC","endemismo":"M. Atlântica","habito":"esc","atividade":"not","porte":"med","habitat":"flo","dieta":"oni","migratoria":"nao","cinegetica":"nao","exotica":"nao"},{"autor":"(Wied-Neuwied, 1826)"}],
      ["Cingulata","Dasypodidae","Dasypus novemcinctus","Tatu-galinha",{"iucn":"LC","habito":"fos","atividade":"not","porte":"med","habitat":"gen","dieta":"ins","cinegetica":"sim","exotica":"nao"},{"autor":"Linnaeus, 1758"}],
      ["Cingulata","Dasypodidae","Euphractus sexcinctus","Tatu-peba",{"iucn":"LC","habito":"fos","atividade":"diu","porte":"med","habitat":"cam","dieta":"oni","cinegetica":"sim","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}],
      ["Pilosa","Myrmecophagidae","Tamandua tetradactyla","Tamanduá-mirim",{"iucn":"LC","habito":"esc","atividade":"cat","porte":"med","habitat":"flo","dieta":"ins","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}],
      ["Pilosa","Myrmecophagidae","Myrmecophaga tridactyla","Tamanduá-bandeira",{"iucn":"VU","listaNacional":"VU","habito":"ter","atividade":"cat","porte":"gra","habitat":"cam","dieta":"ins","exotica":"nao"},{"autor":"Linnaeus, 1758"}],
      ["Primates","Cebidae","Sapajus nigritus","Macaco-prego",{"iucn":"NT","endemismo":"M. Atlântica","habito":"arb","atividade":"diu","porte":"med","habitat":"flo","dieta":"oni","exotica":"nao"},{"autor":"(Goldfuss, 1809)"}],
      ["Lagomorpha","Leporidae","Sylvilagus brasiliensis","Tapiti",{"iucn":"LC","habito":"ter","atividade":"cre","porte":"med","habitat":"gen","dieta":"her","cinegetica":"sim","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}],
      ["Lagomorpha","Leporidae","Lepus europaeus","Lebre-europeia",{"iucn":"LC","habito":"ter","atividade":"not","porte":"med","habitat":"ant","dieta":"her","exotica":"sim","cinegetica":"sim"},{"autor":"Pallas, 1778"}],
      ["Rodentia","Cuniculidae","Cuniculus paca","Paca",{"iucn":"LC","habito":"ter","atividade":"not","porte":"gra","habitat":"flo","dieta":"fru","cinegetica":"sim","exotica":"nao"},{"autor":"(Linnaeus, 1766)"}],
      ["Rodentia","Dasyproctidae","Dasyprocta azarae","Cutia",{"iucn":"DD","habito":"ter","atividade":"diu","porte":"med","habitat":"flo","dieta":"fru","cinegetica":"sim","exotica":"nao"},{"autor":"Lichtenstein, 1823"}],
      ["Rodentia","Erethizontidae","Coendou prehensilis","Ouriço-cacheiro",{"iucn":"LC","habito":"arb","atividade":"not","porte":"med","habitat":"flo","dieta":"fol","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}],
      ["Rodentia","Caviidae","Hydrochoerus hydrochaeris","Capivara",{"iucn":"LC","habito":"sem","atividade":"cat","porte":"gra","habitat":"aqu","dieta":"her","cinegetica":"sim","exotica":"nao"},{"autor":"(Linnaeus, 1766)"}],
      ["Carnivora","Canidae","Cerdocyon thous","Cachorro-do-mato",{"iucn":"LC","habito":"ter","atividade":"not","porte":"med","habitat":"gen","dieta":"oni","exotica":"nao"},{"autor":"(Linnaeus, 1766)"}],
      ["Carnivora","Canidae","Chrysocyon brachyurus","Lobo-guará",{"iucn":"NT","listaNacional":"VU","habito":"ter","atividade":"cre","porte":"gra","habitat":"cam","dieta":"oni","exotica":"nao"},{"autor":"(Illiger, 1815)"}],
      ["Carnivora","Procyonidae","Nasua nasua","Quati",{"iucn":"LC","habito":"esc","atividade":"diu","porte":"med","habitat":"flo","dieta":"oni","exotica":"nao"},{"autor":"(Linnaeus, 1766)"}],
      ["Carnivora","Procyonidae","Procyon cancrivorus","Mão-pelada",{"iucn":"LC","habito":"ter","atividade":"not","porte":"med","habitat":"aqu","dieta":"oni","exotica":"nao"},{"autor":"(G. Cuvier, 1798)"}],
      ["Carnivora","Mustelidae","Eira barbara","Irara",{"iucn":"LC","habito":"esc","atividade":"diu","porte":"med","habitat":"flo","dieta":"oni","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}],
      ["Carnivora","Felidae","Leopardus pardalis","Jaguatirica",{"iucn":"LC","habito":"ter","atividade":"not","porte":"med","habitat":"flo","dieta":"car","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}],
      ["Carnivora","Felidae","Leopardus guttulus","Gato-do-mato-do-sul",{"iucn":"VU","listaNacional":"VU","habito":"ter","atividade":"not","porte":"med","habitat":"flo","dieta":"car","exotica":"nao"},{"autor":"(Hensel, 1872)"}],
      ["Carnivora","Felidae","Puma concolor","Onça-parda",{"iucn":"LC","listaNacional":"VU","habito":"ter","atividade":"cat","porte":"gra","habitat":"flo","dieta":"car","exotica":"nao"},{"autor":"(Linnaeus, 1771)"}],
      ["Artiodactyla","Cervidae","Mazama gouazoubira","Veado-catingueiro",{"iucn":"LC","habito":"ter","atividade":"cat","porte":"gra","habitat":"gen","dieta":"fru","cinegetica":"sim","exotica":"nao"},{"autor":"(G. Fischer, 1814)"}],
      ["Artiodactyla","Tayassuidae","Pecari tajacu","Cateto",{"iucn":"LC","habito":"ter","atividade":"cat","porte":"gra","habitat":"flo","dieta":"fru","cinegetica":"sim","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}],
      ["Perissodactyla","Tapiridae","Tapirus terrestris","Anta",{"iucn":"VU","listaNacional":"VU","habito":"ter","atividade":"not","porte":"gra","habitat":"flo","dieta":"her","cinegetica":"sim","exotica":"nao"},{"autor":"(Linnaeus, 1758)"}]
    ],
    campanhas: [
      {
        rotulo: "1ª campanha", sazonalidade: "seca", dataInicio: "2025-07-14", dataFim: "2025-08-04",
        metodo: 'armadilhaFoto',
        unidades: [
        {"codigo":"AF 01","data":"2025-07-14","areaInfluencia":"ADA","fitofisionomia":"Floresta Estacional Semidecidual","latitude":"-19,0281","longitude":"-43,4192","altitude":"742","esforco":{"nCameras":1,"noites":21},"regs":[[0,2],[1,1],[3,1],[5,1],[6,1],[8,1],[9,1],[12,2],[14,1],[15,1],[16,1],[17,1],[18,1],[20,1]]},
        {"codigo":"AF 02","data":"2025-07-14","areaInfluencia":"ADA","fitofisionomia":"Mata de galeria","latitude":"-19,0344","longitude":"-43,4265","altitude":"705","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[3,1],[5,1],[8,1],[9,1],[12,2],[14,1],[15,1],[17,1],[20,1]]},
        {"codigo":"AF 03","data":"2025-07-14","areaInfluencia":"ADA","fitofisionomia":"Cerrado sentido restrito","latitude":"-19,0410","longitude":"-43,4118","altitude":"818","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[2,1],[6,1],[9,1],[12,2],[20,1]]},
        {"codigo":"AF 04","data":"2025-07-14","areaInfluencia":"AID","fitofisionomia":"Campo sujo","latitude":"-19,0472","longitude":"-43,4051","altitude":"884","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[2,1],[4,1],[6,1],[11,1],[12,2],[13,1],[20,1]]},
        {"codigo":"AF 05","data":"2025-07-14","areaInfluencia":"AID","fitofisionomia":"Floresta Estacional Semidecidual","latitude":"-19,0198","longitude":"-43,4330","altitude":"688","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[8,1],[9,1],[12,1],[14,1],[20,1]]},
        {"codigo":"AF 06","data":"2025-07-14","areaInfluencia":"AID","fitofisionomia":"Mata ciliar","latitude":"-19,0155","longitude":"-43,4402","altitude":"671","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[8,1],[9,1],[12,1],[14,1],[20,1]]},
        {"codigo":"AF 07","data":"2025-07-14","areaInfluencia":"AID","fitofisionomia":"Cerradão","latitude":"-19,0523","longitude":"-43,3988","altitude":"861","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[6,1],[9,1],[12,1],[20,1]]},
        {"codigo":"AF 08","data":"2025-07-14","areaInfluencia":"AII","fitofisionomia":"Pastagem","latitude":"-19,0601","longitude":"-43,3925","altitude":"792","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[2,1],[6,1],[12,1]]}
        ]
      },
      {
        rotulo: "2ª campanha", sazonalidade: "chuva", dataInicio: "2026-01-19", dataFim: "2026-02-18",
        metodo: 'armadilhaFoto',
        unidades: [
        {"codigo":"AF 01","data":"2026-01-19","areaInfluencia":"ADA","fitofisionomia":"Floresta Estacional Semidecidual","latitude":"-19,0281","longitude":"-43,4192","altitude":"742","esforco":{"nCameras":1,"noites":30},"regs":[[0,2],[1,2],[3,1],[5,1],[6,1],[8,1],[9,2],[10,1],[12,2],[14,1],[15,1],[16,1],[17,1],[19,1],[20,2],[21,1],[22,1]]},
        {"codigo":"AF 02","data":"2026-01-19","areaInfluencia":"ADA","fitofisionomia":"Mata de galeria","latitude":"-19,0344","longitude":"-43,4265","altitude":"705","esforco":{"nCameras":1,"noites":30},"regs":[[0,2],[1,2],[3,1],[5,1],[6,1],[8,1],[9,1],[12,2],[14,1],[15,1],[16,1],[17,1],[20,2],[21,1]]},
        {"codigo":"AF 03","data":"2026-01-19","areaInfluencia":"ADA","fitofisionomia":"Cerrado sentido restrito","latitude":"-19,0410","longitude":"-43,4118","altitude":"818","esforco":{"nCameras":1,"noites":30},"regs":[[0,2],[1,2],[2,1],[6,1],[8,1],[9,1],[11,1],[12,2],[14,1],[20,1]]},
        {"codigo":"AF 04","data":"2026-01-19","areaInfluencia":"AID","fitofisionomia":"Campo sujo","latitude":"-19,0472","longitude":"-43,4051","altitude":"884","esforco":{"nCameras":1,"noites":30},"regs":[[0,1],[1,1],[2,1],[4,1],[6,1],[9,1],[11,1],[12,2],[13,1],[14,1],[20,1]]},
        {"codigo":"AF 05","data":"2026-01-19","areaInfluencia":"AID","fitofisionomia":"Floresta Estacional Semidecidual","latitude":"-19,0198","longitude":"-43,4330","altitude":"688","esforco":{"nCameras":1,"noites":30},"regs":[[0,2],[1,1],[3,1],[5,1],[6,1],[8,1],[9,1],[12,2],[14,1],[15,1],[17,1],[20,1]]},
        {"codigo":"AF 06","data":"2026-01-19","areaInfluencia":"AID","fitofisionomia":"Mata ciliar","latitude":"-19,0155","longitude":"-43,4402","altitude":"671","esforco":{"nCameras":1,"noites":30},"regs":[[0,2],[1,1],[3,1],[8,1],[9,1],[12,2],[14,1],[20,1]]},
        {"codigo":"AF 07","data":"2026-01-19","areaInfluencia":"AID","fitofisionomia":"Cerradão","latitude":"-19,0523","longitude":"-43,3988","altitude":"861","esforco":{"nCameras":1,"noites":30},"regs":[[0,2],[1,1],[2,1],[6,1],[8,1],[9,1],[12,2],[14,1],[20,1]]},
        {"codigo":"AF 08","data":"2026-01-19","areaInfluencia":"AII","fitofisionomia":"Pastagem","latitude":"-19,0601","longitude":"-43,3925","altitude":"792","esforco":{"nCameras":1,"noites":30},"regs":[[0,1],[1,1],[2,1],[4,1],[6,1],[9,1],[11,1],[12,2],[20,1]]}
        ]
      },
      {
        rotulo: "3ª campanha", sazonalidade: "seca", dataInicio: "2026-07-13", dataFim: "2026-08-03",
        metodo: 'armadilhaFoto',
        unidades: [
        {"codigo":"AF 01","data":"2026-07-13","areaInfluencia":"ADA","fitofisionomia":"Floresta Estacional Semidecidual","latitude":"-19,0281","longitude":"-43,4192","altitude":"742","esforco":{"nCameras":1,"noites":21},"regs":[[0,2],[1,1],[3,1],[5,1],[6,1],[8,1],[9,1],[12,2],[14,1],[15,1],[16,1],[17,1],[19,1],[20,1],[21,1]]},
        {"codigo":"AF 02","data":"2026-07-13","areaInfluencia":"ADA","fitofisionomia":"Mata de galeria","latitude":"-19,0344","longitude":"-43,4265","altitude":"705","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[3,1],[6,1],[8,1],[9,1],[12,2],[14,1],[17,1],[20,1]]},
        {"codigo":"AF 03","data":"2026-07-13","areaInfluencia":"ADA","fitofisionomia":"Cerrado sentido restrito","latitude":"-19,0410","longitude":"-43,4118","altitude":"818","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[2,1],[6,1],[9,1],[11,1],[12,2],[20,1]]},
        {"codigo":"AF 04","data":"2026-07-13","areaInfluencia":"AID","fitofisionomia":"Campo sujo","latitude":"-19,0472","longitude":"-43,4051","altitude":"884","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[2,1],[4,1],[6,1],[7,1],[11,1],[12,1],[13,1],[20,1]]},
        {"codigo":"AF 05","data":"2026-07-13","areaInfluencia":"AID","fitofisionomia":"Floresta Estacional Semidecidual","latitude":"-19,0198","longitude":"-43,4330","altitude":"688","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[8,1],[9,1],[12,1],[14,1],[20,1]]},
        {"codigo":"AF 06","data":"2026-07-13","areaInfluencia":"AID","fitofisionomia":"Mata ciliar","latitude":"-19,0155","longitude":"-43,4402","altitude":"671","esforco":{"nCameras":1,"noites":21},"regs":[[0,1],[1,1],[9,1],[12,1],[20,1]]}
        ]
      }
    ]
  }

  ];

  function achar(chave) {
    for (var i = 0; i < EXEMPLOS.length; i++) if (EXEMPLOS[i].chave === chave) return EXEMPLOS[i];
    return null;
  }

  /**
   * Monta o exemplo no modelo do app.
   * @param {string} chave   'avifauna' | 'mastofauna'
   * @param {Object} A       ARMAZENAMENTO
   * @returns {Object|null}  o projeto criado
   *
   * Os táxons são reaproveitados por nome científico: abrir os dois exemplos
   * não duplica catálogo, e abrir o mesmo duas vezes não duplica espécie.
   */
  function montar(chave, A) {
    var ex = achar(chave);
    if (!ex || !A) return null;
    var M = global.MOTOR;

    var ids = ex.taxons.map(function (linha) {
      var nome = linha[2];
      var achado = A.acharTaxonPorNome(nome);
      if (achado) return achado.id;
      var pn = M.partirNome(nome);
      var extra = linha[5] || {};
      return A.novoTaxon({
        grupo: ex.grupo,
        classe: ex.classe,
        ordem: linha[0], familia: linha[1],
        genero: pn.genero, epiteto: pn.epiteto,
        nomeComum: linha[3] || '',
        autor: extra.autor || '',
        foraDoCatalogo: !!extra.fora,
        atributos: linha[4] || {}
      }).id;
    });

    var p = A.novoProjeto(ex.projeto);

    ex.campanhas.forEach(function (c) {
      var camp = A.novaCampanha(p.id, {
        rotulo: c.rotulo, sazonalidade: c.sazonalidade,
        dataInicio: c.dataInicio, dataFim: c.dataFim
      });
      (c.unidades || []).forEach(function (u) {
        var un = A.novaUnidade(p.id, camp.id, {
          metodo: c.metodo,
          codigo: u.codigo,
          data: u.data,
          areaInfluencia: u.areaInfluencia || '',
          fitofisionomia: u.fitofisionomia || '',
          latitude: u.latitude || '', longitude: u.longitude || '', altitude: u.altitude || '',
          esforco: u.esforco || {}
        });
        (u.regs || []).forEach(function (r) {
          A.novoRegistro(un, {
            taxonId: ids[r[0]],
            quantidade: r[1],
            tipo: r[2] || ex.tipoPadrao || 'visual',
            data: u.data
          });
        });
      });
    });

    A.salvar();
    return p;
  }

  global.EXEMPLOS = { LISTA: EXEMPLOS, achar: achar, montar: montar };
})(typeof window !== 'undefined' ? window : globalThis);
