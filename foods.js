/* ============================================================
   foods.js — Base local de alimentos + lógica de cocción
   Macros por 100 g de producto CRUDO / tal como se compra.
   Edita libremente: añade líneas al array FOODS.
   Campos: id, n(ombre), cl(ase), kcal, p, c, f, fib, units[]
   ============================================================ */

/* Aceite usado al cocinar (oliva virgen extra) */
const OIL = { kcal: 900, p: 0, c: 0, f: 100 };

/* Métodos de cocción por clase de alimento.
   y   = rendimiento (peso cocinado / peso crudo)
   oil = gramos de aceite absorbidos por 100 g de producto CRUDO  */
const COOK_BY_CLASS = {
  huevo: {
    crudo:     { n: 'Crudo',              y: 1.00, oil: 0 },
    duro:      { n: 'Duro / pasado agua', y: 1.00, oil: 0 },
    poche:     { n: 'Escalfado',          y: 1.00, oil: 0 },
    plancha:   { n: 'A la plancha',       y: 0.90, oil: 2.5 },
    revuelto:  { n: 'Revuelto / tortilla',y: 0.92, oil: 5 },
    frito:     { n: 'Frito',              y: 0.90, oil: 10 }
  },
  carne: {
    crudo:     { n: 'Crudo',              y: 1.00, oil: 0 },
    plancha:   { n: 'A la plancha',       y: 0.75, oil: 2 },
    horno:     { n: 'Al horno',           y: 0.75, oil: 1.5 },
    hervido:   { n: 'Hervido / cocido',   y: 0.70, oil: 0 },
    guisado:   { n: 'Guisado',            y: 0.80, oil: 3 },
    frito:     { n: 'Frito / rebozado',   y: 0.78, oil: 8 },
    airfryer:  { n: 'Air fryer',          y: 0.76, oil: 1 }
  },
  pescado: {
    crudo:     { n: 'Crudo',              y: 1.00, oil: 0 },
    plancha:   { n: 'A la plancha',       y: 0.80, oil: 2 },
    horno:     { n: 'Al horno',           y: 0.82, oil: 1.5 },
    hervido:   { n: 'Hervido',            y: 0.85, oil: 0 },
    frito:     { n: 'Frito / rebozado',   y: 0.82, oil: 8 }
  },
  cereal: {
    crudo:     { n: 'En crudo',           y: 1.00, oil: 0 },
    hervido:   { n: 'Hervido',            y: 2.60, oil: 0 },
    salteado:  { n: 'Hervido y salteado', y: 2.55, oil: 3 }
  },
  arroz: {
    crudo:     { n: 'En crudo',           y: 1.00, oil: 0 },
    hervido:   { n: 'Hervido',            y: 2.80, oil: 0 },
    salteado:  { n: 'Hervido y salteado', y: 2.70, oil: 3 },
    paella:    { n: 'Paella / a la cazuela', y: 2.50, oil: 6 }
  },
  legumbre: {
    crudo:     { n: 'En crudo (seca)',    y: 1.00, oil: 0 },
    hervido:   { n: 'Hervida',            y: 2.50, oil: 0 },
    guisado:   { n: 'Guisada',            y: 2.45, oil: 4 }
  },
  patata: {
    crudo:     { n: 'Cruda',              y: 1.00, oil: 0 },
    hervido:   { n: 'Hervida',            y: 0.96, oil: 0 },
    horno:     { n: 'Al horno',           y: 0.75, oil: 2 },
    airfryer:  { n: 'Air fryer',          y: 0.65, oil: 2 },
    frito:     { n: 'Frita',              y: 0.55, oil: 12 }
  },
  verdura: {
    crudo:     { n: 'Cruda',              y: 1.00, oil: 0 },
    hervido:   { n: 'Hervida',            y: 0.92, oil: 0 },
    plancha:   { n: 'A la plancha',       y: 0.75, oil: 2.5 },
    horno:     { n: 'Al horno',           y: 0.72, oil: 2 },
    salteado:  { n: 'Salteada',           y: 0.80, oil: 3 },
    frito:     { n: 'Frita',              y: 0.70, oil: 9 }
  },
  simple: {
    tal:       { n: 'Tal cual',           y: 1.00, oil: 0 }
  }
};

/* ------------------------------------------------------------
   ALIMENTOS
   kcal/p/c/f por 100 g de producto crudo o tal como se compra.
   units: piezas típicas con su peso comestible en gramos.
   ------------------------------------------------------------ */
const FOODS = [

  /* ---- Huevos y lácteos ---- */
  { id:'huevo',      n:'Huevo de gallina',        cl:'huevo',   kcal:143, p:12.6, c:0.7, f:9.5,
    units:[{n:'S (43 g)',g:43},{n:'M (51 g)',g:51},{n:'L (58 g)',g:58},{n:'XL (66 g)',g:66}] },
  { id:'clara',      n:'Clara de huevo',          cl:'huevo',   kcal:52,  p:10.9, c:0.7, f:0.2,
    units:[{n:'1 clara M (33 g)',g:33}] },
  { id:'yema',       n:'Yema de huevo',           cl:'huevo',   kcal:322, p:15.9, c:0.6, f:28.2,
    units:[{n:'1 yema M (17 g)',g:17}] },
  { id:'leche_ent',  n:'Leche entera',            cl:'simple',  kcal:63,  p:3.2,  c:4.7, f:3.6, units:[{n:'Vaso (200 ml)',g:206}] },
  { id:'leche_desn', n:'Leche desnatada',         cl:'simple',  kcal:34,  p:3.4,  c:4.9, f:0.2, units:[{n:'Vaso (200 ml)',g:206}] },
  { id:'yog_nat',    n:'Yogur natural',           cl:'simple',  kcal:61,  p:3.5,  c:4.7, f:3.3, units:[{n:'Unidad (125 g)',g:125}] },
  { id:'yog_griego', n:'Yogur griego natural',    cl:'simple',  kcal:97,  p:9.0,  c:4.0, f:5.0, units:[{n:'Unidad (150 g)',g:150}] },
  { id:'skyr',       n:'Skyr / proteico 0%',      cl:'simple',  kcal:57,  p:10.0, c:4.0, f:0.2, units:[{n:'Unidad (150 g)',g:150}] },
  { id:'queso_fres', n:'Queso fresco batido 0%',  cl:'simple',  kcal:47,  p:8.0,  c:4.0, f:0.2, units:[{n:'Tarrina (250 g)',g:250}] },
  { id:'queso_curad',n:'Queso curado',            cl:'simple',  kcal:390, p:29.0, c:1.5, f:30.0,units:[{n:'Loncha (20 g)',g:20}] },
  { id:'queso_lonch',n:'Queso en lonchas',        cl:'simple',  kcal:300, p:22.0, c:2.0, f:23.0,units:[{n:'Loncha (20 g)',g:20}] },
  { id:'mozzarella', n:'Mozzarella',              cl:'simple',  kcal:280, p:22.0, c:2.2, f:20.0,units:[{n:'Bola (125 g)',g:125}] },
  { id:'mantequilla',n:'Mantequilla',             cl:'simple',  kcal:740, p:0.6,  c:0.6, f:82.0,units:[{n:'Porción (10 g)',g:10}] },

  /* ---- Carnes ---- */
  { id:'pechuga',    n:'Pechuga de pollo',        cl:'carne',   kcal:110, p:23.0, c:0,   f:1.8,
    units:[{n:'Filete (120 g)',g:120},{n:'Pechuga entera (250 g)',g:250}] },
  { id:'muslo_pollo',n:'Muslo de pollo sin piel', cl:'carne',   kcal:135, p:19.5, c:0,   f:6.2, units:[{n:'Muslo (110 g)',g:110}] },
  { id:'pavo',       n:'Pechuga de pavo',         cl:'carne',   kcal:104, p:23.5, c:0,   f:1.0, units:[{n:'Filete (110 g)',g:110}] },
  { id:'lomo_cerdo', n:'Lomo de cerdo',           cl:'carne',   kcal:145, p:21.5, c:0,   f:6.3, units:[{n:'Filete (110 g)',g:110}] },
  { id:'solomillo_c',n:'Solomillo de cerdo',      cl:'carne',   kcal:124, p:21.8, c:0,   f:4.0, units:[{n:'Ración (150 g)',g:150}] },
  { id:'secreto',    n:'Secreto ibérico',         cl:'carne',   kcal:290, p:17.0, c:0,   f:25.0,units:[{n:'Ración (150 g)',g:150}] },
  { id:'panceta',    n:'Panceta / bacon',         cl:'carne',   kcal:390, p:15.0, c:0.5, f:37.0,units:[{n:'Loncha (20 g)',g:20}] },
  { id:'ternera',    n:'Ternera magra',           cl:'carne',   kcal:131, p:21.0, c:0,   f:5.0, units:[{n:'Filete (130 g)',g:130}] },
  { id:'picada_vac', n:'Carne picada vacuno 5%',  cl:'carne',   kcal:130, p:21.0, c:0,   f:5.0, units:[{n:'Ración (150 g)',g:150}] },
  { id:'picada_mix', n:'Carne picada mixta 15%',  cl:'carne',   kcal:215, p:18.0, c:0,   f:15.0,units:[{n:'Ración (150 g)',g:150}] },
  { id:'hamburguesa',n:'Hamburguesa de vacuno',   cl:'carne',   kcal:225, p:18.5, c:1.0, f:16.0,units:[{n:'Unidad (120 g)',g:120}] },
  { id:'conejo',     n:'Conejo',                  cl:'carne',   kcal:133, p:22.0, c:0,   f:5.0, units:[{n:'Ración (150 g)',g:150}] },
  { id:'cordero',    n:'Cordero',                 cl:'carne',   kcal:230, p:18.0, c:0,   f:17.0,units:[{n:'Ración (150 g)',g:150}] },

  /* ---- Embutidos y curados ---- */
  { id:'jamon_serr', n:'Jamón serrano',           cl:'simple',  kcal:240, p:31.0, c:0.5, f:12.5,units:[{n:'Loncha (18 g)',g:18},{n:'Ración (60 g)',g:60}] },
  { id:'jamon_iber', n:'Jamón ibérico de bellota',cl:'simple',  kcal:300, p:31.0, c:0.5, f:19.0,units:[{n:'Loncha (18 g)',g:18},{n:'Ración (60 g)',g:60}] },
  { id:'jamon_york', n:'Jamón cocido / york',     cl:'simple',  kcal:110, p:18.0, c:1.5, f:3.5, units:[{n:'Loncha (25 g)',g:25}] },
  { id:'pavo_lonch', n:'Fiambre de pavo',         cl:'simple',  kcal:95,  p:17.0, c:2.0, f:2.0, units:[{n:'Loncha (25 g)',g:25}] },
  { id:'chorizo',    n:'Chorizo',                 cl:'simple',  kcal:455, p:22.0, c:2.0, f:40.0,units:[{n:'Rodaja (8 g)',g:8}] },
  { id:'salchichon', n:'Salchichón / fuet',       cl:'simple',  kcal:420, p:24.0, c:1.5, f:35.0,units:[{n:'Rodaja (8 g)',g:8}] },
  { id:'lomo_embuch',n:'Lomo embuchado',          cl:'simple',  kcal:255, p:36.0, c:1.0, f:12.0,units:[{n:'Loncha (15 g)',g:15}] },
  { id:'sobrasada',  n:'Sobrasada',               cl:'simple',  kcal:480, p:14.0, c:1.0, f:46.0,units:[{n:'Cucharada (15 g)',g:15}] },
  { id:'salchichas', n:'Salchichas frescas',      cl:'carne',   kcal:275, p:14.0, c:2.0, f:23.0,units:[{n:'Unidad (60 g)',g:60}] },

  /* ---- Pescados ---- */
  { id:'merluza',    n:'Merluza',                 cl:'pescado', kcal:71,  p:15.9, c:0,   f:0.6, units:[{n:'Filete (150 g)',g:150}] },
  { id:'salmon',     n:'Salmón',                  cl:'pescado', kcal:200, p:20.0, c:0,   f:13.0,units:[{n:'Lomo (140 g)',g:140}] },
  { id:'atun_nat',   n:'Atún al natural (lata)',  cl:'simple',  kcal:110, p:25.0, c:0,   f:1.0, units:[{n:'Lata escurrida (52 g)',g:52}] },
  { id:'atun_aceite',n:'Atún en aceite escurrido',cl:'simple',  kcal:190, p:25.0, c:0,   f:10.0,units:[{n:'Lata escurrida (52 g)',g:52}] },
  { id:'gambas',     n:'Gambas / langostinos',    cl:'pescado', kcal:85,  p:18.0, c:0.5, f:1.0, units:[{n:'Ración (120 g)',g:120}] },
  { id:'bacalao',    n:'Bacalao fresco',          cl:'pescado', kcal:82,  p:18.0, c:0,   f:0.7, units:[{n:'Lomo (150 g)',g:150}] },

  /* ---- Cereales, pan y pasta ---- */
  { id:'pasta',      n:'Pasta seca (macarrones)', cl:'cereal', kcal:359, p:12.5, c:71.0, f:1.5, fib:3.0,
    units:[{n:'Ración pequeña (60 g)',g:60},{n:'Ración media (80 g)',g:80},{n:'Ración grande (100 g)',g:100}] },
  { id:'pasta_int',  n:'Pasta integral seca',     cl:'cereal',  kcal:340, p:13.5, c:63.0, f:2.5, fib:8.0, units:[{n:'Ración (80 g)',g:80}] },
  { id:'arroz',      n:'Arroz blanco seco',       cl:'arroz',   kcal:354, p:7.0,  c:78.0, f:0.9, fib:1.0,
    units:[{n:'Ración pequeña (60 g)',g:60},{n:'Ración media (80 g)',g:80},{n:'Ración grande (100 g)',g:100}] },
  { id:'arroz_int',  n:'Arroz integral seco',     cl:'arroz',   kcal:350, p:7.5,  c:74.0, f:2.5, fib:3.5, units:[{n:'Ración (80 g)',g:80}] },
  { id:'quinoa',     n:'Quinoa seca',             cl:'cereal',  kcal:368, p:14.0, c:57.0, f:6.0, fib:7.0, units:[{n:'Ración (70 g)',g:70}] },
  { id:'cuscus',     n:'Cuscús seco',             cl:'cereal',  kcal:360, p:12.0, c:72.0, f:0.6, fib:5.0, units:[{n:'Ración (80 g)',g:80}] },
  { id:'avena',      n:'Copos de avena',          cl:'simple',  kcal:375, p:13.5, c:58.0, f:7.0, fib:10.0,
    units:[{n:'Cucharada (12 g)',g:12},{n:'Ración (50 g)',g:50},{n:'Ración (80 g)',g:80}] },
  { id:'pan_payes',  n:'Pan de payés',            cl:'simple',  kcal:265, p:8.5,  c:52.0, f:1.2, fib:3.0,
    units:[{n:'Rebanada fina (30 g)',g:30},{n:'Rebanada (45 g)',g:45},{n:'Rebanada gruesa (60 g)',g:60}] },
  { id:'pan_blanco', n:'Pan blanco de barra',     cl:'simple',  kcal:270, p:8.5,  c:53.0, f:1.5, fib:2.5,
    units:[{n:'Rebanada (30 g)',g:30},{n:'Barra pequeña (100 g)',g:100}] },
  { id:'pan_molde',  n:'Pan de molde',            cl:'simple',  kcal:265, p:8.0,  c:47.0, f:4.0, fib:3.0, units:[{n:'Rebanada (28 g)',g:28}] },
  { id:'pan_int',    n:'Pan integral',            cl:'simple',  kcal:245, p:9.0,  c:41.0, f:3.0, fib:7.0, units:[{n:'Rebanada (35 g)',g:35}] },
  { id:'tortita_ma', n:'Tortitas de maíz/arroz',  cl:'simple',  kcal:385, p:8.0,  c:81.0, f:2.5, fib:2.0, units:[{n:'Unidad (7 g)',g:7}] },
  { id:'tortilla_tr',n:'Tortilla de trigo (wrap)',cl:'simple',  kcal:300, p:8.0,  c:50.0, f:7.0, fib:2.5, units:[{n:'Unidad (45 g)',g:45}] },
  { id:'cereales_az',n:'Cereales de desayuno',    cl:'simple',  kcal:380, p:7.0,  c:80.0, f:2.5, fib:3.0, units:[{n:'Bol (40 g)',g:40}] },
  { id:'harina',     n:'Harina de trigo',         cl:'simple',  kcal:345, p:10.0, c:71.0, f:1.2, fib:3.0, units:[{n:'Cucharada (10 g)',g:10}] },

  /* ---- Legumbres ---- */
  { id:'garbanzo',   n:'Garbanzos secos',         cl:'legumbre',kcal:350, p:19.0, c:50.0, f:5.5, fib:15.0,units:[{n:'Ración (70 g)',g:70}] },
  { id:'lenteja',    n:'Lentejas secas',          cl:'legumbre',kcal:340, p:24.0, c:49.0, f:1.5, fib:16.0,units:[{n:'Ración (70 g)',g:70}] },
  { id:'alubia',     n:'Alubias secas',           cl:'legumbre',kcal:333, p:21.5, c:48.0, f:1.5, fib:17.0,units:[{n:'Ración (70 g)',g:70}] },
  { id:'garbanzo_bo',n:'Garbanzos de bote (escurridos)', cl:'simple', kcal:120, p:6.5, c:16.0, f:2.5, fib:6.0, units:[{n:'Bote escurrido (240 g)',g:240}] },
  { id:'lenteja_bo', n:'Lentejas de bote (escurridas)',  cl:'simple', kcal:105, p:7.5, c:13.0, f:0.5, fib:6.0, units:[{n:'Bote escurrido (240 g)',g:240}] },

  /* ---- Patatas y tubérculos ---- */
  { id:'patata',     n:'Patata',                  cl:'patata',  kcal:77,  p:2.0,  c:16.0, f:0.1, fib:2.0,
    units:[{n:'Pequeña (100 g)',g:100},{n:'Mediana (170 g)',g:170},{n:'Grande (250 g)',g:250}] },
  { id:'boniato',    n:'Boniato',                 cl:'patata',  kcal:86,  p:1.6,  c:18.0, f:0.1, fib:3.0, units:[{n:'Mediano (150 g)',g:150}] },

  /* ---- Verduras ---- */
  { id:'tomate',     n:'Tomate',                  cl:'verdura', kcal:18,  p:0.9,  c:3.0, f:0.2, fib:1.2, units:[{n:'Mediano (140 g)',g:140}] },
  { id:'cebolla',    n:'Cebolla',                 cl:'verdura', kcal:40,  p:1.1,  c:7.6, f:0.1, fib:1.7, units:[{n:'Mediana (120 g)',g:120}] },
  { id:'pimiento',   n:'Pimiento',                cl:'verdura', kcal:26,  p:1.0,  c:4.0, f:0.3, fib:1.8, units:[{n:'Unidad (150 g)',g:150}] },
  { id:'calabacin',  n:'Calabacín',               cl:'verdura', kcal:17,  p:1.2,  c:2.0, f:0.3, fib:1.1, units:[{n:'Mediano (200 g)',g:200}] },
  { id:'berenjena',  n:'Berenjena',               cl:'verdura', kcal:25,  p:1.0,  c:3.5, f:0.2, fib:3.0, units:[{n:'Mediana (250 g)',g:250}] },
  { id:'brocoli',    n:'Brócoli',                 cl:'verdura', kcal:34,  p:2.8,  c:4.0, f:0.4, fib:2.6, units:[{n:'Ración (150 g)',g:150}] },
  { id:'judia_verde',n:'Judías verdes',           cl:'verdura', kcal:31,  p:1.8,  c:4.0, f:0.2, fib:3.0, units:[{n:'Ración (200 g)',g:200}] },
  { id:'champinon',  n:'Champiñones',             cl:'verdura', kcal:22,  p:3.1,  c:1.0, f:0.3, fib:1.0, units:[{n:'Ración (150 g)',g:150}] },
  { id:'lechuga',    n:'Lechuga',                 cl:'verdura', kcal:15,  p:1.4,  c:1.5, f:0.2, fib:1.3, units:[{n:'Bol (80 g)',g:80}] },
  { id:'zanahoria',  n:'Zanahoria',               cl:'verdura', kcal:35,  p:0.9,  c:6.5, f:0.2, fib:2.8, units:[{n:'Mediana (80 g)',g:80}] },
  { id:'guisantes',  n:'Guisantes',               cl:'verdura', kcal:81,  p:5.4,  c:11.0,f:0.4, fib:5.0, units:[{n:'Ración (150 g)',g:150}] },
  { id:'tomate_frit',n:'Tomate frito',            cl:'simple',  kcal:85,  p:1.5,  c:9.0, f:4.5, fib:1.5, units:[{n:'Cucharada (25 g)',g:25},{n:'Ración (100 g)',g:100}] },

  /* ---- Frutas ---- */
  { id:'platano',    n:'Plátano',                 cl:'simple',  kcal:90,  p:1.1,  c:20.0,f:0.3, fib:2.6,
    units:[{n:'Pequeño (85 g)',g:85},{n:'Mediano (110 g)',g:110},{n:'Grande (140 g)',g:140}] },
  { id:'manzana',    n:'Manzana',                 cl:'simple',  kcal:52,  p:0.3,  c:12.0,f:0.2, fib:2.4,
    units:[{n:'Pequeña (120 g)',g:120},{n:'Mediana (170 g)',g:170},{n:'Grande (220 g)',g:220}] },
  { id:'naranja',    n:'Naranja',                 cl:'simple',  kcal:47,  p:0.9,  c:9.0, f:0.1, fib:2.4, units:[{n:'Mediana (150 g)',g:150}] },
  { id:'pera',       n:'Pera',                    cl:'simple',  kcal:57,  p:0.4,  c:12.5,f:0.1, fib:3.1, units:[{n:'Mediana (170 g)',g:170}] },
  { id:'uva',        n:'Uva',                     cl:'simple',  kcal:69,  p:0.7,  c:16.0,f:0.2, fib:0.9, units:[{n:'Racimo (150 g)',g:150}] },
  { id:'fresa',      n:'Fresas',                  cl:'simple',  kcal:32,  p:0.7,  c:6.0, f:0.3, fib:2.0, units:[{n:'Bol (150 g)',g:150}] },
  { id:'sandia',     n:'Sandía',                  cl:'simple',  kcal:30,  p:0.6,  c:7.0, f:0.2, fib:0.4, units:[{n:'Ración (250 g)',g:250}] },
  { id:'melon',      n:'Melón',                   cl:'simple',  kcal:34,  p:0.8,  c:8.0, f:0.2, fib:0.9, units:[{n:'Ración (250 g)',g:250}] },
  { id:'zumo_nar',   n:'Zumo de naranja natural', cl:'simple',  kcal:45,  p:0.7,  c:10.0,f:0.2, units:[{n:'Vaso (250 ml)',g:255}] },
  { id:'aguacate',   n:'Aguacate',                cl:'simple',  kcal:160, p:2.0,  c:1.8, f:15.0,fib:6.7, units:[{n:'Medio (75 g)',g:75},{n:'Entero (150 g)',g:150}] },

  /* ---- Frutos secos y grasas ---- */
  { id:'pistacho',   n:'Pistachos (sin cáscara)', cl:'simple',  kcal:562, p:20.0, c:17.0,f:45.0,fib:10.0,
    units:[{n:'Puñado (25 g)',g:25},{n:'Ración (40 g)',g:40}] },
  { id:'almendra',   n:'Almendras',               cl:'simple',  kcal:580, p:21.0, c:9.0, f:50.0,fib:12.0,units:[{n:'Puñado (25 g)',g:25}] },
  { id:'nuez',       n:'Nueces',                  cl:'simple',  kcal:654, p:15.0, c:7.0, f:65.0,fib:6.7, units:[{n:'Puñado (25 g)',g:25},{n:'Unidad (5 g)',g:5}] },
  { id:'anacardo',   n:'Anacardos',               cl:'simple',  kcal:553, p:18.0, c:27.0,f:44.0,fib:3.3, units:[{n:'Puñado (25 g)',g:25}] },
  { id:'cacahuete',  n:'Cacahuetes',              cl:'simple',  kcal:567, p:26.0, c:16.0,f:49.0,fib:8.5, units:[{n:'Puñado (25 g)',g:25}] },
  { id:'crema_cacah',n:'Crema de cacahuete',      cl:'simple',  kcal:600, p:25.0, c:12.0,f:50.0,fib:6.0, units:[{n:'Cucharada (16 g)',g:16}] },
  { id:'aceite_oliva',n:'Aceite de oliva',        cl:'simple',  kcal:900, p:0,    c:0,   f:100.0,
    units:[{n:'Chorrito (5 g)',g:5},{n:'Cucharada (10 g)',g:10},{n:'Cucharada sopera (14 g)',g:14}] },
  { id:'aceite_gir', n:'Aceite de girasol',       cl:'simple',  kcal:900, p:0,    c:0,   f:100.0,units:[{n:'Cucharada (10 g)',g:10}] },
  { id:'mayonesa',   n:'Mayonesa',                cl:'simple',  kcal:680, p:1.0,  c:1.5, f:75.0,units:[{n:'Cucharada (15 g)',g:15}] },
  { id:'aceituna',   n:'Aceitunas',               cl:'simple',  kcal:145, p:1.0,  c:1.0, f:15.0,fib:3.0, units:[{n:'Unidad (4 g)',g:4},{n:'Ración (50 g)',g:50}] },

  /* ---- Suplementos y bebidas ---- */
  { id:'whey',       n:'Proteína whey en polvo',  cl:'simple',  kcal:390, p:78.0, c:6.0, f:6.0,
    units:[{n:'Cazo (30 g)',g:30},{n:'Cazo grande (35 g)',g:35}] },
  { id:'creatina',   n:'Creatina monohidrato',    cl:'simple',  kcal:0,   p:0,    c:0,   f:0,   units:[{n:'Dosis (5 g)',g:5}] },
  { id:'cafe',       n:'Café solo',               cl:'simple',  kcal:2,   p:0.2,  c:0,   f:0,   units:[{n:'Taza (60 ml)',g:60}] },
  { id:'cafe_leche', n:'Café con leche entera',   cl:'simple',  kcal:45,  p:2.4,  c:3.5, f:2.6, units:[{n:'Taza (200 ml)',g:200}] },
  { id:'cerveza',    n:'Cerveza',                 cl:'simple',  kcal:43,  p:0.5,  c:3.6, f:0,   units:[{n:'Caña (200 ml)',g:200},{n:'Tercio (330 ml)',g:330}] },
  { id:'cerveza_00', n:'Cerveza 0,0',             cl:'simple',  kcal:22,  p:0.4,  c:4.5, f:0,   units:[{n:'Tercio (330 ml)',g:330}] },
  { id:'champan_00', n:'Champán / espumoso 0,0',  cl:'simple',  kcal:25,  p:0.1,  c:5.5, f:0,   units:[{n:'Copa (120 ml)',g:120}] },
  { id:'vino',       n:'Vino',                    cl:'simple',  kcal:83,  p:0.1,  c:2.5, f:0,   units:[{n:'Copa (120 ml)',g:120}] },
  { id:'refresco',   n:'Refresco azucarado',      cl:'simple',  kcal:42,  p:0,    c:10.5,f:0,   units:[{n:'Lata (330 ml)',g:330}] },
  { id:'refresco_0', n:'Refresco zero',           cl:'simple',  kcal:1,   p:0,    c:0,   f:0,   units:[{n:'Lata (330 ml)',g:330}] },

  /* ---- Platos y varios ---- */
  { id:'tortilla_pat',n:'Tortilla de patatas',    cl:'simple',  kcal:190, p:6.5,  c:14.0,f:12.0,units:[{n:'Porción (150 g)',g:150}] },
  { id:'pizza',      n:'Pizza (media)',           cl:'simple',  kcal:265, p:11.0, c:30.0,f:11.0,units:[{n:'Porción (110 g)',g:110},{n:'Pizza entera (400 g)',g:400}] },
  { id:'croqueta',   n:'Croquetas',               cl:'simple',  kcal:230, p:7.0,  c:22.0,f:12.0,units:[{n:'Unidad (30 g)',g:30}] },
  { id:'empanadilla',n:'Empanadilla',             cl:'simple',  kcal:280, p:8.0,  c:28.0,f:15.0,units:[{n:'Unidad (50 g)',g:50}] },
  { id:'chocolate_n',n:'Chocolate negro 70%',     cl:'simple',  kcal:570, p:8.0,  c:33.0,f:42.0,units:[{n:'Onza (10 g)',g:10}] },
  { id:'chocolate_l',n:'Chocolate con leche',     cl:'simple',  kcal:545, p:7.0,  c:57.0,f:31.0,units:[{n:'Onza (10 g)',g:10}] },
  { id:'galleta',    n:'Galletas tipo María',     cl:'simple',  kcal:440, p:7.0,  c:73.0,f:13.0,units:[{n:'Unidad (7 g)',g:7}] },
  { id:'miel',       n:'Miel',                    cl:'simple',  kcal:304, p:0.3,  c:75.0,f:0,   units:[{n:'Cucharada (15 g)',g:15}] },
  { id:'azucar',     n:'Azúcar',                  cl:'simple',  kcal:400, p:0,    c:100.0,f:0,  units:[{n:'Cucharadita (5 g)',g:5}] },
  { id:'sal',        n:'Sal',                     cl:'simple',  kcal:0,   p:0,    c:0,   f:0,   units:[{n:'Pizca (1 g)',g:1}] }
];

/* Índice rápido por id */
const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));

/* Devuelve el mapa de cocciones de un alimento */
function cookOptions(food) {
  return COOK_BY_CLASS[food.cl] || COOK_BY_CLASS.simple;
}

/* ------------------------------------------------------------
   Cálculo de macros de una entrada.
   entry = { foodId|custom, grams, cook, weighedCooked, oilOverride }
   Devuelve { kcal, p, c, f, fib, rawG, oilG }
   ------------------------------------------------------------ */
function computeEntryMacros(food, grams, cookKey, weighedCooked, oilOverride) {
  const opts = cookOptions(food);
  const m = opts[cookKey] || Object.values(opts)[0];
  const rawG = weighedCooked ? grams / (m.y || 1) : grams;
  const factor = rawG / 100;

  const oilG = (oilOverride !== null && oilOverride !== undefined)
    ? oilOverride
    : (m.oil || 0) * factor;

  const base = {
    kcal: (food.kcal || 0) * factor,
    p:    (food.p || 0) * factor,
    c:    (food.c || 0) * factor,
    f:    (food.f || 0) * factor,
    fib:  (food.fib || 0) * factor
  };

  base.kcal += OIL.kcal * oilG / 100;
  base.f    += OIL.f    * oilG / 100;

  return { ...base, rawG, oilG, cookedG: rawG * (m.y || 1) };
}

window.NUTRI_DB = { FOODS, FOOD_BY_ID, COOK_BY_CLASS, OIL, cookOptions, computeEntryMacros };
