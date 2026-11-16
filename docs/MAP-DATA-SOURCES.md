# Sumber Data Geografis & Atribusi Peta — SATU DPBI

Peta interaktif 38 provinsi dan *drilldown* batas Kabupaten/Kota pada halaman `/wilayah` (baik Website Publik maupun Portal Internal) menggunakan aset GeoJSON nyata yang tersimpan lokal di `public/maps/` tanpa ketergantungan pada API peta eksternal berbayar.

---

## 1. Daftar Berkas Peta Lokal (`public/maps/`)

| Lokasi / Berkas | Deskripsi | Jumlah Fitur |
| :--- | :--- | :--- |
| `public/maps/indonesia-38-provinces.geojson` | Batas poligon resmi seluruh 38 provinsi di Indonesia (termasuk pemekaran Papua) | 38 fitur provinsi |
| `public/maps/kabupaten/<code>.geojson` | 38 berkas GeoJSON batas Kabupaten/Kota per kode provinsi BPS (mis. `31.geojson`, `32.geojson`, `91.geojson`) | 517 poligon kabupaten/kota |
| `public/maps/regencies-index.json` | Indeks kode BPS, nama kabupaten/kota, kode provinsi induk, dan klasifikasi `kabupaten`/`kota` untuk *seeding* & dropdown bertingkat | ~514+ entri aktif |
| `public/maps/metadata.json` | Metadata sumber dataset & tanggal pemrosesan | — |

---

## 2. Atribusi & Lisensi Resmi (Sesuai `public/maps/metadata.json`)

1. **Dataset 38 Provinsi Indonesia**:
   - **Nama**: Indonesia GeoJSON & TopoJSON Maps (38 Provinces)
   - **Sumber**: `https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces`
   - **Lisensi**: `MIT / CC BY 4.0`
2. **Dataset Kabupaten/Kota (38 Provinsi)**:
   - **Nama**: GeoJson Indonesia 38 Provinsi (Kabupaten/Kota)
   - **Sumber**: `https://github.com/ardian28/GeoJson-Indonesia-38-Provinsi`
   - **Lisensi**: `MIT (derived from Badan Informasi Geospasial / BIG)`
3. **Tanggal Pemrosesan Paket**: `2026-11-16`

---

## 3. Catatan Teknis Proyeksi & Kinerja (`src/lib/geojson.ts`)

- Proyeksi koordinat menggunakan proyeksi ekuirektangular terskala berdasarkan *bounding box* dinamis dataset Indonesia (`minLng..maxLng`, `minLat..maxLat`) dengan pembulatan presisi path SVG dan penanganan multi-poligon kepulauan (`Polygon` & `MultiPolygon`).
- Berkas batas kabupaten/kota dimuat secara malas (*lazy-loaded*) hanya ketika pengguna mengeklik atau memilih satu provinsi tertentu, sehingga beban awal beranda tetap ringan.
- Aksesibilitas non-peta selalu tersedia berdampingan dalam bentuk daftar kartu/tabel yang dapat dicari dan disaring per pulau maupun status pembinaan.
