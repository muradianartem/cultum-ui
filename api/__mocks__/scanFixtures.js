// Test fixtures for the scan flow — imported by the screen/helper tests as
// stubbed API responses. Shapes mirror the real OpenAPI responses.

// POST /scans → ScanResult
export const MOCK_SCAN = {
  id: '00000000-0000-0000-0000-000000000001',
  status: 'completed',
  created_at: '2026-08-26T12:00:00Z',
  candidates: [
    {
      id: '00000000-0000-0000-0000-0000000000a1',
      rank: 1,
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
      scientific_name: 'Philodendron bipinnatifidum',
      common_name: 'Tree philodendron',
      probability: 0.23,
      provider_ref: '5312',
      reference_image_url: null,
    },
    {
      id: '00000000-0000-0000-0000-0000000000a3',
      rank: 3,
      scientific_name: 'Epipremnum aureum',
      common_name: 'Golden pothos',
      probability: 0.11,
      provider_ref: '3126',
      reference_image_url: null,
    },
  ],
};

// GET /plants/search → PlantSummary[]
export const MOCK_SEARCH = [
  {
    id: null,
    common_name: 'Monstera',
    scientific_name: 'Monstera deliciosa',
    watering_frequency_days: 7,
    soil_change_months: 12,
    brief: 'A climbing aroid whose mature leaves split and fenestrate.',
    image_url:
      'https://perenual.com/storage/species_image/2868_Monstera_deliciosa/regular/monstera.jpg',
    source: 'perenual',
    source_id: '2868',
  },
  {
    id: null,
    common_name: 'Monstera adansonii',
    scientific_name: 'Monstera adansonii',
    watering_frequency_days: 6,
    soil_change_months: 12,
    brief: null,
    image_url: null,
    source: 'perenual',
    source_id: '2867',
  },
];

// GET /plants/{source_id} → PlantDetail
export const MOCK_DETAIL = {
  id: null,
  common_name: 'Monstera',
  scientific_name: 'Monstera deliciosa',
  watering_frequency_days: 7,
  soil_change_months: 12,
  brief: 'A climbing aroid whose mature leaves split and fenestrate with light.',
  image_url:
    'https://perenual.com/storage/species_image/2868_Monstera_deliciosa/regular/monstera.jpg',
  source: 'perenual',
  source_id: '2868',
  other_names: ['Swiss cheese plant', 'Split-leaf philodendron'],
  family: 'Araceae',
  characteristics: null,
};
