// Test fixtures for the scan flow — imported by the screen/helper tests as
// stubbed API responses. Shapes mirror the real OpenAPI responses
// (ScanResult / ScanCandidateOut / SpeciesSummary / SpeciesDetail).

// GET /plants/{species_key} → SpeciesDetail
export const MOCK_DETAIL = {
  species_key: 'monstera-deliciosa',
  scientific_name: 'Monstera deliciosa',
  common_name: 'Monstera',
  difficulty: 'Easy',
  toxicity: 'Toxic',
  image_url:
    'https://perenual.com/storage/species_image/2868_Monstera_deliciosa/regular/monstera.jpg',
  image_thumb_url:
    'https://perenual.com/storage/species_image/2868_Monstera_deliciosa/thumbnail/monstera.jpg',
  genus: 'Monstera',
  family: 'Araceae',
  common_names: ['Swiss cheese plant', 'Split-leaf philodendron'],
  about: 'A climbing aroid whose mature leaves split and fenestrate with light.',
  toxic_to: ['cats', 'dogs'],
  water_interval_days_min: 7,
  water_interval_days_max: 10,
  water_note: 'Let the top 5cm dry out first.',
  sun_level: 'bright_indirect',
  sun_label: 'Bright, indirect',
  temp_min_c: 18,
  temp_max_c: 27,
  humidity_level: 'medium',
  humidity_label: 'Average home is fine',
  soil_type: 'Well-draining aroid mix',
  fertilize_interval_days: 30,
  repot_interval_months: 24,
  growth_rate: 'fast',
};

// POST /scans → ScanResult. `care` is the full SpeciesDetail for the top match.
export const MOCK_SCAN = {
  id: '00000000-0000-0000-0000-000000000001',
  status: 'completed',
  created_at: '2026-08-26T12:00:00Z',
  candidates: [
    {
      id: '00000000-0000-0000-0000-0000000000a1',
      rank: 1,
      species_key: 'monstera-deliciosa',
      scientific_name: 'Monstera deliciosa',
      common_name: 'Swiss cheese plant',
      probability: 0.52,
      provider_ref: '2868',
      reference_image_url:
        'https://perenual.com/storage/species_image/2868_Monstera_deliciosa/regular/monstera.jpg',
    },
    {
      id: '00000000-0000-0000-0000-0000000000a2',
      rank: 2,
      species_key: 'monstera-adansonii',
      scientific_name: 'Monstera adansonii',
      common_name: 'Swiss cheese vine',
      probability: 0.23,
      provider_ref: '2867',
      reference_image_url: null,
    },
    {
      id: '00000000-0000-0000-0000-0000000000a3',
      rank: 3,
      species_key: 'epipremnum-aureum',
      scientific_name: 'Epipremnum aureum',
      common_name: 'Golden pothos',
      probability: 0.11,
      provider_ref: '3126',
      reference_image_url: null,
    },
  ],
  care: MOCK_DETAIL,
};

// GET /plants/search → SpeciesSummary[]
export const MOCK_SEARCH = [
  {
    species_key: 'monstera-deliciosa',
    scientific_name: 'Monstera deliciosa',
    common_name: 'Monstera',
    difficulty: 'Easy',
    toxicity: 'Toxic',
    image_url:
      'https://perenual.com/storage/species_image/2868_Monstera_deliciosa/regular/monstera.jpg',
    image_thumb_url:
      'https://perenual.com/storage/species_image/2868_Monstera_deliciosa/thumbnail/monstera.jpg',
  },
  {
    species_key: 'monstera-adansonii',
    scientific_name: 'Monstera adansonii',
    common_name: 'Swiss cheese vine',
    difficulty: 'Easy',
    toxicity: null,
    image_url: null,
    image_thumb_url: null,
  },
];
