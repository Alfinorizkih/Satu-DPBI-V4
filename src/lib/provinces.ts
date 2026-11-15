export interface ProvinceSeed {
  code: string;
  name: string;
  island: 'Sumatra' | 'Jawa' | 'Kalimantan' | 'Sulawesi' | 'Bali & Nusa Tenggara' | 'Maluku' | 'Papua';
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
  // Simplified normalized SVG coordinates on 1000x420 Indonesia canvas for interactive map rendering
  svgPath: string;
  labelX: number;
  labelY: number;
}

// All 38 official provinces of the Republic of Indonesia (including 4 new Papua provinces)
export const INDONESIA_PROVINCES: ProvinceSeed[] = [
  {
    code: '11',
    name: 'Aceh',
    island: 'Sumatra',
    minLat: 2.0, maxLat: 6.1, minLng: 95.0, maxLng: 98.3, centerLat: 4.6951, centerLng: 96.7494,
    svgPath: 'M32,46 L68,40 L86,58 L72,82 L44,72 Z', labelX: 58, labelY: 61,
  },
  {
    code: '12',
    name: 'Sumatera Utara',
    island: 'Sumatra',
    minLat: 0.5, maxLat: 4.2, minLng: 97.5, maxLng: 100.5, centerLat: 2.1154, centerLng: 99.5451,
    svgPath: 'M72,82 L86,58 L118,86 L108,118 L82,110 Z', labelX: 95, labelY: 92,
  },
  {
    code: '13',
    name: 'Sumatera Barat',
    island: 'Sumatra',
    minLat: -3.5, maxLat: 0.9, minLng: 98.5, maxLng: 101.8, centerLat: -0.7399, centerLng: 100.8000,
    svgPath: 'M82,110 L108,118 L120,152 L96,158 L78,136 Z', labelX: 98, labelY: 136,
  },
  {
    code: '14',
    name: 'Riau',
    island: 'Sumatra',
    minLat: -1.1, maxLat: 2.6, minLng: 100.0, maxLng: 103.8, centerLat: 0.2933, centerLng: 101.7068,
    svgPath: 'M108,118 L142,108 L156,142 L120,152 Z', labelX: 131, labelY: 131,
  },
  {
    code: '21',
    name: 'Kepulauan Riau',
    island: 'Sumatra',
    minLat: -0.9, maxLat: 4.8, minLng: 103.2, maxLng: 109.2, centerLat: 3.9456, centerLng: 108.1429,
    svgPath: 'M164,104 L188,100 L194,124 L168,128 Z', labelX: 179, labelY: 114,
  },
  {
    code: '15',
    name: 'Jambi',
    island: 'Sumatra',
    minLat: -2.8, maxLat: -0.7, minLng: 101.1, maxLng: 104.5, centerLat: -1.6101, centerLng: 103.6131,
    svgPath: 'M120,152 L156,142 L166,174 L132,182 Z', labelX: 144, labelY: 163,
  },
  {
    code: '17',
    name: 'Bengkulu',
    island: 'Sumatra',
    minLat: -5.4, maxLat: -2.2, minLng: 101.0, maxLng: 103.8, centerLat: -3.7928, centerLng: 102.2608,
    svgPath: 'M96,158 L120,152 L132,182 L140,214 L118,214 Z', labelX: 118, labelY: 185,
  },
  {
    code: '16',
    name: 'Sumatera Selatan',
    island: 'Sumatra',
    minLat: -4.9, maxLat: -1.6, minLng: 102.0, maxLng: 106.2, centerLat: -3.3194, centerLng: 103.9144,
    svgPath: 'M132,182 L176,176 L186,210 L140,214 Z', labelX: 158, labelY: 196,
  },
  {
    code: '19',
    name: 'Kepulauan Bangka Belitung',
    island: 'Sumatra',
    minLat: -3.4, maxLat: -1.4, minLng: 105.1, maxLng: 108.4, centerLat: -2.7411, centerLng: 106.4406,
    svgPath: 'M186,162 L212,158 L216,184 L190,188 Z', labelX: 201, labelY: 173,
  },
  {
    code: '18',
    name: 'Lampung',
    island: 'Sumatra',
    minLat: -6.1, maxLat: -3.7, minLng: 103.5, maxLng: 106.0, centerLat: -4.5586, centerLng: 105.4068,
    svgPath: 'M140,214 L186,210 L192,248 L156,252 Z', labelX: 168, labelY: 231,
  },
  {
    code: '36',
    name: 'Banten',
    island: 'Jawa',
    minLat: -7.1, maxLat: -5.8, minLng: 105.1, maxLng: 106.8, centerLat: -6.4058, centerLng: 106.0640,
    svgPath: 'M198,258 L226,256 L228,284 L196,284 Z', labelX: 212, labelY: 270,
  },
  {
    code: '31',
    name: 'DKI Jakarta',
    island: 'Jawa',
    minLat: -6.4, maxLat: -5.9, minLng: 106.6, maxLng: 107.0, centerLat: -6.2088, centerLng: 106.8456,
    svgPath: 'M226,254 L242,254 L242,268 L226,268 Z', labelX: 234, labelY: 261,
  },
  {
    code: '32',
    name: 'Jawa Barat',
    island: 'Jawa',
    minLat: -7.9, maxLat: -5.9, minLng: 106.3, maxLng: 108.9, centerLat: -7.0909, centerLng: 107.6689,
    svgPath: 'M228,268 L268,264 L274,296 L228,294 Z', labelX: 250, labelY: 280,
  },
  {
    code: '33',
    name: 'Jawa Tengah',
    island: 'Jawa',
    minLat: -8.3, maxLat: -6.4, minLng: 108.5, maxLng: 111.7, centerLat: -7.1510, centerLng: 110.1403,
    svgPath: 'M268,264 L318,266 L316,298 L274,296 Z', labelX: 294, labelY: 281,
  },
  {
    code: '34',
    name: 'DI Yogyakarta',
    island: 'Jawa',
    minLat: -8.2, maxLat: -7.5, minLng: 110.0, maxLng: 110.8, centerLat: -7.8754, centerLng: 110.4262,
    svgPath: 'M286,298 L308,298 L308,312 L286,312 Z', labelX: 297, labelY: 305,
  },
  {
    code: '35',
    name: 'Jawa Timur',
    island: 'Jawa',
    minLat: -8.8, maxLat: -6.7, minLng: 111.0, maxLng: 114.7, centerLat: -7.5361, centerLng: 112.2384,
    svgPath: 'M318,266 L378,274 L376,308 L316,298 Z', labelX: 347, labelY: 286,
  },
  {
    code: '51',
    name: 'Bali',
    island: 'Bali & Nusa Tenggara',
    minLat: -8.9, maxLat: -8.0, minLng: 114.4, maxLng: 115.7, centerLat: -8.4095, centerLng: 115.1889,
    svgPath: 'M384,292 L412,292 L410,312 L382,312 Z', labelX: 397, labelY: 302,
  },
  {
    code: '52',
    name: 'Nusa Tenggara Barat',
    island: 'Bali & Nusa Tenggara',
    minLat: -9.1, maxLat: -8.1, minLng: 115.8, maxLng: 119.2, centerLat: -8.6529, centerLng: 117.3616,
    svgPath: 'M418,292 L464,294 L462,316 L416,314 Z', labelX: 440, labelY: 304,
  },
  {
    code: '53',
    name: 'Nusa Tenggara Timur',
    island: 'Bali & Nusa Tenggara',
    minLat: -11.1, maxLat: -8.0, minLng: 118.9, maxLng: 125.2, centerLat: -8.6574, centerLng: 121.0794,
    svgPath: 'M470,296 L562,298 L556,334 L468,324 Z', labelX: 515, labelY: 313,
  },
  {
    code: '61',
    name: 'Kalimantan Barat',
    island: 'Kalimantan',
    minLat: -3.1, maxLat: 2.1, minLng: 108.6, maxLng: 114.2, centerLat: -0.2788, centerLng: 111.4753,
    svgPath: 'M252,118 L310,116 L312,184 L256,184 Z', labelX: 282, labelY: 150,
  },
  {
    code: '62',
    name: 'Kalimantan Tengah',
    island: 'Kalimantan',
    minLat: -3.6, maxLat: 0.8, minLng: 110.7, maxLng: 115.9, centerLat: -1.6815, centerLng: 113.3824,
    svgPath: 'M312,148 L364,148 L364,206 L306,204 Z', labelX: 336, labelY: 176,
  },
  {
    code: '63',
    name: 'Kalimantan Selatan',
    island: 'Kalimantan',
    minLat: -4.2, maxLat: -1.3, minLng: 114.3, maxLng: 116.6, centerLat: -3.0926, centerLng: 115.2838,
    svgPath: 'M364,174 L394,176 L392,216 L362,212 Z', labelX: 378, labelY: 194,
  },
  {
    code: '64',
    name: 'Kalimantan Timur',
    island: 'Kalimantan',
    minLat: -2.4, maxLat: 2.6, minLng: 113.8, maxLng: 119.0, centerLat: 0.5387, centerLng: 116.4194,
    svgPath: 'M356,102 L412,102 L408,174 L364,174 L356,148 Z', labelX: 384, labelY: 136,
  },
  {
    code: '65',
    name: 'Kalimantan Utara',
    island: 'Kalimantan',
    minLat: 1.1, maxLat: 4.4, minLng: 114.5, maxLng: 117.9, centerLat: 3.0731, centerLng: 116.0414,
    svgPath: 'M356,66 L408,68 L412,102 L356,102 Z', labelX: 383, labelY: 84,
  },
  {
    code: '71',
    name: 'Sulawesi Utara',
    island: 'Sulawesi',
    minLat: 0.3, maxLat: 4.8, minLng: 123.1, maxLng: 127.2, centerLat: 0.6247, centerLng: 123.9750,
    svgPath: 'M518,108 L572,102 L572,126 L518,132 Z', labelX: 545, labelY: 117,
  },
  {
    code: '75',
    name: 'Gorontalo',
    island: 'Sulawesi',
    minLat: 0.3, maxLat: 1.1, minLng: 121.1, maxLng: 123.6, centerLat: 0.6999, centerLng: 122.4467,
    svgPath: 'M482,116 L518,108 L518,132 L482,136 Z', labelX: 500, labelY: 123,
  },
  {
    code: '72',
    name: 'Sulawesi Tengah',
    island: 'Sulawesi',
    minLat: -3.6, maxLat: 1.4, minLng: 119.4, maxLng: 124.2, centerLat: -1.4300, centerLng: 121.4456,
    svgPath: 'M460,136 L514,136 L512,178 L460,174 Z', labelX: 486, labelY: 156,
  },
  {
    code: '76',
    name: 'Sulawesi Barat',
    island: 'Sulawesi',
    minLat: -3.6, maxLat: -0.9, minLng: 118.7, maxLng: 119.9, centerLat: -2.8441, centerLng: 119.2321,
    svgPath: 'M442,164 L464,164 L464,202 L442,202 Z', labelX: 453, labelY: 183,
  },
  {
    code: '73',
    name: 'Sulawesi Selatan',
    island: 'Sulawesi',
    minLat: -7.5, maxLat: -1.9, minLng: 118.7, maxLng: 121.8, centerLat: -3.6688, centerLng: 119.9741,
    svgPath: 'M454,196 L486,196 L486,252 L454,248 Z', labelX: 470, labelY: 223,
  },
  {
    code: '74',
    name: 'Sulawesi Tenggara',
    island: 'Sulawesi',
    minLat: -5.8, maxLat: -2.8, minLng: 120.9, maxLng: 124.6, centerLat: -4.1449, centerLng: 122.1746,
    svgPath: 'M486,184 L526,184 L524,240 L486,236 Z', labelX: 506, labelY: 211,
  },
  {
    code: '82',
    name: 'Maluku Utara',
    island: 'Maluku',
    minLat: -2.4, maxLat: 2.6, minLng: 124.3, maxLng: 129.6, centerLat: 1.5710, centerLng: 127.8088,
    svgPath: 'M606,116 L650,116 L646,166 L604,164 Z', labelX: 626, labelY: 140,
  },
  {
    code: '81',
    name: 'Maluku',
    island: 'Maluku',
    minLat: -8.4, maxLat: -2.7, minLng: 125.7, maxLng: 134.9, centerLat: -3.2385, centerLng: 130.1453,
    svgPath: 'M604,186 L670,186 L666,240 L602,238 Z', labelX: 635, labelY: 212,
  },
  {
    code: '96',
    name: 'Papua Barat Daya',
    island: 'Papua',
    minLat: -2.2, maxLat: 0.6, minLng: 129.6, maxLng: 133.2, centerLat: -0.9500, centerLng: 131.5000,
    svgPath: 'M700,144 L744,142 L742,174 L698,176 Z', labelX: 721, labelY: 159,
  },
  {
    code: '92',
    name: 'Papua Barat',
    island: 'Papua',
    minLat: -4.4, maxLat: -1.1, minLng: 132.0, maxLng: 135.2, centerLat: -1.3361, centerLng: 133.1747,
    svgPath: 'M744,148 L788,152 L784,192 L742,188 Z', labelX: 765, labelY: 170,
  },
  {
    code: '94',
    name: 'Papua Tengah',
    island: 'Papua',
    minLat: -5.3, maxLat: -2.3, minLng: 134.8, maxLng: 138.2, centerLat: -3.6500, centerLng: 136.5000,
    svgPath: 'M788,184 L842,184 L838,226 L784,224 Z', labelX: 813, labelY: 205,
  },
  {
    code: '91',
    name: 'Papua',
    island: 'Papua',
    minLat: -3.9, maxLat: -1.0, minLng: 135.4, maxLng: 141.0, centerLat: -2.5337, centerLng: 140.7181,
    svgPath: 'M814,142 L912,146 L908,186 L812,184 Z', labelX: 861, labelY: 164,
  },
  {
    code: '95',
    name: 'Papua Pegunungan',
    island: 'Papua',
    minLat: -5.2, maxLat: -3.2, minLng: 138.0, maxLng: 141.0, centerLat: -4.0800, centerLng: 139.2000,
    svgPath: 'M842,186 L910,186 L908,232 L840,228 Z', labelX: 875, labelY: 208,
  },
  {
    code: '93',
    name: 'Papua Selatan',
    island: 'Papua',
    minLat: -9.1, maxLat: -4.9, minLng: 137.4, maxLng: 141.0, centerLat: -7.5000, centerLng: 139.7000,
    svgPath: 'M832,230 L908,232 L904,296 L830,282 Z', labelX: 868, labelY: 260,
  },
];

export const PROVINCE_BY_CODE = new Map(INDONESIA_PROVINCES.map((p) => [p.code, p]));
