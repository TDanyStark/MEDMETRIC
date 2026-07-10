export interface ChileComuna {
  name: string
}

export interface ChileProvincia {
  name: string
  comunas: string[]
}

export interface ChileRegion {
  name: string
  provincias: ChileProvincia[]
}

export const CHILE_COUNTRIES = ['Chile']

export const CHILE_REGIONS: ChileRegion[] = [
  {
    name: 'Arica y Parinacota',
    provincias: [
      { name: 'Arica', comunas: ['Arica', 'Camarones'] },
      { name: 'Parinacota', comunas: ['Putre', 'General Lagos'] },
    ],
  },
  {
    name: 'Tarapacá',
    provincias: [
      { name: 'Iquique', comunas: ['Iquique', 'Alto Hospicio'] },
      {
        name: 'Tamarugal',
        comunas: ['Pozo Almonte', 'Camiña', 'Colchane', 'Huara', 'Pica'],
      },
    ],
  },
  {
    name: 'Antofagasta',
    provincias: [
      {
        name: 'Antofagasta',
        comunas: ['Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal'],
      },
      { name: 'El Loa', comunas: ['Calama', 'Ollagüe', 'San Pedro de Atacama'] },
      { name: 'Tocopilla', comunas: ['Tocopilla', 'María Elena'] },
    ],
  },
  {
    name: 'Atacama',
    provincias: [
      { name: 'Copiapó', comunas: ['Copiapó', 'Caldera', 'Tierra Amarilla'] },
      { name: 'Chañaral', comunas: ['Chañaral', 'Diego de Almagro'] },
      {
        name: 'Huasco',
        comunas: ['Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco'],
      },
    ],
  },
  {
    name: 'Coquimbo',
    provincias: [
      {
        name: 'Elqui',
        comunas: ['La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paiguano', 'Vicuña'],
      },
      {
        name: 'Limarí',
        comunas: ['Ovalle', 'Combarbalá', 'Monte Patria', 'Punitaqui', 'Río Hurtado'],
      },
      {
        name: 'Choapa',
        comunas: ['Illapel', 'Canela', 'Los Vilos', 'Salamanca'],
      },
    ],
  },
  {
    name: 'Valparaíso',
    provincias: [
      {
        name: 'Valparaíso',
        comunas: [
          'Valparaíso',
          'Casablanca',
          'Concón',
          'Juan Fernández',
          'Puchuncaví',
          'Quintero',
          'Viña del Mar',
        ],
      },
      { name: 'Isla de Pascua', comunas: ['Isla de Pascua'] },
      {
        name: 'Los Andes',
        comunas: ['Los Andes', 'Calle Larga', 'Rinconada', 'San Esteban'],
      },
      {
        name: 'Petorca',
        comunas: ['La Ligua', 'Cabildo', 'Papudo', 'Petorca', 'Zapallar'],
      },
      {
        name: 'Quillota',
        comunas: ['Quillota', 'Calera', 'Hijuelas', 'La Cruz', 'Nogales'],
      },
      {
        name: 'San Antonio',
        comunas: ['San Antonio', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo', 'Santo Domingo'],
      },
      {
        name: 'San Felipe de Aconcagua',
        comunas: ['San Felipe', 'Catemu', 'Llaillay', 'Panquehue', 'Putaendo', 'Santa María'],
      },
      {
        name: 'Marga Marga',
        comunas: ['Quilpué', 'Limache', 'Olmué', 'Villa Alemana'],
      },
    ],
  },
  {
    name: 'Metropolitana de Santiago',
    provincias: [
      {
        name: 'Santiago',
        comunas: [
          'Santiago',
          'Cerrillos',
          'Cerro Navia',
          'Conchalí',
          'El Bosque',
          'Estación Central',
          'Huechuraba',
          'Independencia',
          'La Cisterna',
          'La Florida',
          'La Granja',
          'La Pintana',
          'La Reina',
          'Las Condes',
          'Lo Barnechea',
          'Lo Espejo',
          'Lo Prado',
          'Macul',
          'Maipú',
          'Ñuñoa',
          'Pedro Aguirre Cerda',
          'Peñalolén',
          'Providencia',
          'Pudahuel',
          'Quilicura',
          'Quinta Normal',
          'Recoleta',
          'Renca',
          'San Joaquín',
          'San Miguel',
          'San Ramón',
          'Vitacura',
        ],
      },
      { name: 'Cordillera', comunas: ['Puente Alto', 'Pirque', 'San José de Maipo'] },
      { name: 'Chacabuco', comunas: ['Colina', 'Lampa', 'Tiltil'] },
      { name: 'Maipo', comunas: ['San Bernardo', 'Buin', 'Calera de Tango', 'Paine'] },
      {
        name: 'Melipilla',
        comunas: ['Melipilla', 'Alhué', 'Curacaví', 'María Pinto', 'San Pedro'],
      },
      {
        name: 'Talagante',
        comunas: ['Talagante', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor'],
      },
    ],
  },
  {
    name: "Libertador General Bernardo O'Higgins",
    provincias: [
      {
        name: 'Cachapoal',
        comunas: [
          'Rancagua',
          'Codegua',
          'Coinco',
          'Coltauco',
          'Doñihue',
          'Graneros',
          'Las Cabras',
          'Machalí',
          'Malloa',
          'Mostazal',
          'Olivar',
          'Peumo',
          'Pichidegua',
          'Quinta de Tilcoco',
          'Rengo',
          'Requínoa',
          'San Vicente',
        ],
      },
      {
        name: 'Cardenal Caro',
        comunas: ['Pichilemu', 'La Estrella', 'Litueche', 'Marchihue', 'Navidad', 'Paredones'],
      },
      {
        name: 'Colchagua',
        comunas: [
          'San Fernando',
          'Chépica',
          'Chimbarongo',
          'Lolol',
          'Nancagua',
          'Palmilla',
          'Peralillo',
          'Placilla',
          'Pumanque',
          'Santa Cruz',
        ],
      },
    ],
  },
  {
    name: 'Maule',
    provincias: [
      {
        name: 'Talca',
        comunas: [
          'Talca',
          'Constitución',
          'Curepto',
          'Empedrado',
          'Maule',
          'Pelarco',
          'Pencahue',
          'Río Claro',
          'San Clemente',
          'San Rafael',
        ],
      },
      { name: 'Cauquenes', comunas: ['Cauquenes', 'Chanco', 'Pelluhue'] },
      {
        name: 'Curicó',
        comunas: [
          'Curicó',
          'Hualañé',
          'Licantén',
          'Molina',
          'Rauco',
          'Romeral',
          'Sagrada Familia',
          'Teno',
          'Vichuquén',
        ],
      },
      {
        name: 'Linares',
        comunas: [
          'Linares',
          'Colbún',
          'Longaví',
          'Parral',
          'Retiro',
          'San Javier',
          'Villa Alegre',
          'Yerbas Buenas',
        ],
      },
    ],
  },
  {
    name: 'Ñuble',
    provincias: [
      {
        name: 'Diguillín',
        comunas: [
          'Chillán',
          'Bulnes',
          'Chillán Viejo',
          'El Carmen',
          'Pemuco',
          'Pinto',
          'Quillón',
          'San Ignacio',
          'Yungay',
        ],
      },
      {
        name: 'Itata',
        comunas: ['Quirihue', 'Cobquecura', 'Coelemu', 'Ninhue', 'Portezuelo', 'Ránquil', 'Treguaco'],
      },
      {
        name: 'Punilla',
        comunas: ['San Carlos', 'Coihueco', 'Ñiquén', 'San Fabián', 'San Nicolás'],
      },
    ],
  },
  {
    name: 'Biobío',
    provincias: [
      {
        name: 'Concepción',
        comunas: [
          'Concepción',
          'Coronel',
          'Chiguayante',
          'Florida',
          'Hualqui',
          'Lota',
          'Penco',
          'San Pedro de la Paz',
          'Santa Juana',
          'Talcahuano',
          'Tomé',
          'Hualpén',
        ],
      },
      {
        name: 'Arauco',
        comunas: ['Lebu', 'Arauco', 'Cañete', 'Contulmo', 'Curanilahue', 'Los Álamos', 'Tirúa'],
      },
      {
        name: 'Biobío',
        comunas: [
          'Los Ángeles',
          'Antuco',
          'Cabrero',
          'Laja',
          'Mulchén',
          'Nacimiento',
          'Negrete',
          'Quilaco',
          'Quilleco',
          'San Rosendo',
          'Santa Bárbara',
          'Tucapel',
          'Yumbel',
          'Alto Biobío',
        ],
      },
    ],
  },
  {
    name: 'La Araucanía',
    provincias: [
      {
        name: 'Cautín',
        comunas: [
          'Temuco',
          'Carahue',
          'Cholchol',
          'Cunco',
          'Curarrehue',
          'Freire',
          'Galvarino',
          'Gorbea',
          'Lautaro',
          'Loncoche',
          'Melipeuco',
          'Nueva Imperial',
          'Padre Las Casas',
          'Perquenco',
          'Pitrufquén',
          'Pucón',
          'Saavedra',
          'Teodoro Schmidt',
          'Toltén',
          'Vilcún',
          'Villarrica',
        ],
      },
      {
        name: 'Malleco',
        comunas: [
          'Angol',
          'Collipulli',
          'Curacautín',
          'Ercilla',
          'Lonquimay',
          'Los Sauces',
          'Lumaco',
          'Purén',
          'Renaico',
          'Traiguén',
          'Victoria',
        ],
      },
    ],
  },
  {
    name: 'Los Ríos',
    provincias: [
      {
        name: 'Valdivia',
        comunas: [
          'Valdivia',
          'Corral',
          'Lanco',
          'Los Lagos',
          'Máfil',
          'Mariquina',
          'Paillaco',
          'Panguipulli',
        ],
      },
      { name: 'Ranco', comunas: ['La Unión', 'Futrono', 'Lago Ranco', 'Río Bueno'] },
    ],
  },
  {
    name: 'Los Lagos',
    provincias: [
      {
        name: 'Llanquihue',
        comunas: [
          'Puerto Montt',
          'Calbuco',
          'Cochamó',
          'Fresia',
          'Frutillar',
          'Llanquihue',
          'Los Muermos',
          'Maullín',
          'Puerto Varas',
        ],
      },
      {
        name: 'Chiloé',
        comunas: [
          'Castro',
          'Ancud',
          'Chonchi',
          'Curaco de Vélez',
          'Dalcahue',
          'Puqueldón',
          'Queilén',
          'Quellón',
          'Quemchi',
          'Quinchao',
        ],
      },
      {
        name: 'Osorno',
        comunas: [
          'Osorno',
          'Puerto Octay',
          'Purranque',
          'Puyehue',
          'Río Negro',
          'San Juan de la Costa',
          'San Pablo',
        ],
      },
      { name: 'Palena', comunas: ['Chaitén', 'Futaleufú', 'Hualaihué', 'Palena'] },
    ],
  },
  {
    name: 'Aysén del General Carlos Ibáñez del Campo',
    provincias: [
      { name: 'Coyhaique', comunas: ['Coyhaique', 'Lago Verde'] },
      { name: 'Aysén', comunas: ['Aysén', 'Cisnes', 'Guaitecas'] },
      { name: 'General Carrera', comunas: ['Chile Chico', 'Río Ibáñez'] },
      { name: 'Capitán Prat', comunas: ['Cochrane', "O'Higgins", 'Tortel'] },
    ],
  },
  {
    name: 'Magallanes y de la Antártica Chilena',
    provincias: [
      {
        name: 'Magallanes',
        comunas: ['Punta Arenas', 'Laguna Blanca', 'Río Verde', 'San Gregorio'],
      },
      { name: 'Última Esperanza', comunas: ['Puerto Natales', 'Torres del Paine'] },
      { name: 'Tierra del Fuego', comunas: ['Porvenir', 'Primavera', 'Timaukel'] },
      { name: 'Antártica Chilena', comunas: ['Cabo de Hornos', 'Antártica'] },
    ],
  },
]

export function getProvinciasByRegion(regionName: string | null | undefined): string[] {
  if (!regionName) return []
  const region = CHILE_REGIONS.find(r => r.name === regionName)
  return region ? region.provincias.map(p => p.name) : []
}

export function getComunasByProvincia(
  regionName: string | null | undefined,
  provinciaName: string | null | undefined,
): string[] {
  if (!regionName || !provinciaName) return []
  const region = CHILE_REGIONS.find(r => r.name === regionName)
  const provincia = region?.provincias.find(p => p.name === provinciaName)
  return provincia ? provincia.comunas : []
}
