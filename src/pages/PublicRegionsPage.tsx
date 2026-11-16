import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { apiGet, apiUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { ProvinceRecord, RegencyRecord } from '../lib/types';
import { IndonesiaMap } from '../components/IndonesiaMap';
import { PublicFooter, PublicNavbar } from '../components/public/PublicChrome';
import { GlassCard, SearchBar, StatusIndicator } from '../components/ui/Primitives';

interface PublicRegencyRow {
  code: string;
  provinceCode: string;
  name: string;
  kind: 'kabupaten' | 'kota';
  status: ProvinceRecord['status'];
  hasCoordinator: boolean;
}

interface PublicOverviewProvincesPayload {
  provinces: (ProvinceRecord & { approvedLklCount?: number })[];
}

export function PublicRegionsPage({ initialCode }: { initialCode?: string }) {
  const { navigate } = useAuth();
  const [provinces, setProvinces] = useState<(ProvinceRecord & { approvedLklCount?: number })[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>(initialCode || '31');
  const [drillCode, setDrillCode] = useState<string | null>(initialCode || null);
  const [regencies, setRegencies] = useState<PublicRegencyRow[]>([]);
  const [provinceDetail, setProvinceDetail] = useState<
    (ProvinceRecord & { approvedLklCount?: number }) | null
  >(null);
  const [searchProv, setSearchProv] = useState('');
  const [islandFilter, setIslandFilter] = useState('');
  const [searchReg, setSearchReg] = useState('');

  useEffect(() => {
    apiGet<PublicOverviewProvincesPayload>('/api/public/overview', true)
      .then((d) => {
        setProvinces(d.provinces || []);
        if (initialCode) {
          setSelectedCode(initialCode);
        } else if (d.provinces?.length && !d.provinces.some((p) => p.code === selectedCode)) {
          setSelectedCode(d.provinces[0].code);
        }
      })
      .catch(() => {});
  }, [initialCode]);

  useEffect(() => {
    if (!selectedCode) return;
    apiGet<{ province: ProvinceRecord & { approvedLklCount?: number }; regencies: PublicRegencyRow[] }>(
      `/api/public/provinces/${selectedCode}`,
      true
    )
      .then((d) => {
        setProvinceDetail(d.province);
        setRegencies(d.regencies || []);
      })
      .catch(() => {});
  }, [selectedCode]);

  const islands = useMemo(
    () => Array.from(new Set(provinces.map((p) => p.island))).sort(),
    [provinces]
  );

  const filteredProvinces = useMemo(() => {
    const q = searchProv.trim().toLowerCase();
    return provinces.filter((p) => {
      if (islandFilter && p.island !== islandFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.code.includes(q)) return false;
      return true;
    });
  }, [provinces, searchProv, islandFilter]);

  const filteredRegencies = useMemo(() => {
    const q = searchReg.trim().toLowerCase();
    return regencies.filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.includes(q));
  }, [regencies, searchReg]);

  const mapRegencies: RegencyRecord[] = useMemo(
    () =>
      regencies.map((r) => ({
        code: r.code,
        provinceCode: r.provinceCode,
        name: r.name,
        kind: r.kind,
        status: r.status,
        coordinatorName: r.hasCoordinator ? 'Koordinator Daerah Terdaftar' : null,
        coachingNote: null,
        domicileDutaCount: 0,
        assignmentDutaCount: 0,
        lklCount: 0,
        proposalCount: 0,
      })),
    [regencies]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
      <PublicNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0EA5E9]">
              Keterbukaan Informasi Wilayah
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5">
              Persebaran 38 Provinsi &amp; Kabupaten/Kota DPBI
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Data wilayah bersifat agregat administratif dan tidak menampilkan informasi pribadi peserta didik.
            </p>
          </div>
          {initialCode && (
            <button
              type="button"
              onClick={() => {
                setDrillCode(null);
                navigate('/wilayah');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9] shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Semua 38 Provinsi
            </button>
          )}
        </div>

        {/* Interactive Map + Selected Province Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <GlassCard className="lg:col-span-8 p-4 sm:p-5">
            <IndonesiaMap
              provinces={provinces}
              selectedCode={selectedCode}
              onSelect={(p) => {
                setSelectedCode(p.code);
                setDrillCode(null);
              }}
              drillProvinceCode={drillCode}
              onChangeDrillProvince={setDrillCode}
              regencies={mapRegencies}
              onSelectRegency={(r) => setSearchReg(r.name)}
            />
          </GlassCard>

          <GlassCard className="lg:col-span-4 p-5 space-y-4">
            {provinceDetail ? (
              <>
                <div className="flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  {provinceDetail.logoFileId ? (
                    <img
                      src={apiUrl(`/api/public/files/${provinceDetail.logoFileId}`)}
                      alt={`Logo Provinsi ${provinceDetail.name}`}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-[#0EA5E9] flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-mono text-slate-500">
                      Provinsi {provinceDetail.code} · {provinceDetail.island}
                    </p>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {provinceDetail.name}
                    </h2>
                    <div className="mt-1">
                      <StatusIndicator status={provinceDetail.status} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <p className="text-slate-500 dark:text-slate-400">Kab/Kota Aktif</p>
                    <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {provinceDetail.activeRegencyCount ?? 0}/{provinceDetail.regencyCount ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <p className="text-slate-500 dark:text-slate-400">Kegiatan LKL</p>
                    <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {provinceDetail.approvedLklCount ?? 0}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {provinceDetail.description ||
                    'Informasi resmi cakupan wilayah dan aktivitas pelajar DPBI pada tingkat provinsi serta kabupaten/kota.'}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setDrillCode(drillCode === provinceDetail.code ? null : provinceDetail.code)
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold transition-colors"
                >
                  {drillCode === provinceDetail.code
                    ? 'Tutup Drilldown Kab/Kota'
                    : 'Buka Peta Kabupaten/Kota'}
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-500">Memuat ringkasan provinsi...</p>
            )}
          </GlassCard>
        </div>

        {/* Accessible Two-Column Directory: Provinces + Regencies */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <GlassCard className="lg:col-span-5 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Daftar 38 Provinsi Indonesia
            </h2>
            <div className="flex flex-wrap gap-2">
              <SearchBar
                value={searchProv}
                onChange={setSearchProv}
                placeholder="Cari provinsi..."
                className="flex-1 min-w-[160px]"
              />
              <select
                aria-label="Filter kepulauan"
                value={islandFilter}
                onChange={(e) => setIslandFilter(e.target.value)}
                className="pl-3 pr-8 py-2 min-w-[175px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Semua Kepulauan</option>
                {islands.map((isl) => (
                  <option key={isl} value={isl}>
                    {isl}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProvinces.map((p) => {
                const active = p.code === selectedCode;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => {
                      setSelectedCode(p.code);
                      setSearchReg('');
                    }}
                    className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      active
                        ? 'bg-sky-50 dark:bg-sky-950/60'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {p.activeRegencyCount ?? 0}/{p.regencyCount ?? 0} Kab/Kota · {p.approvedLklCount ?? 0} LKL
                      </p>
                    </div>
                    <StatusIndicator status={p.status} />
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="lg:col-span-7 p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Daftar Kabupaten / Kota · {provinceDetail?.name || ''}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {regencies.length} wilayah administratif tercatat
                </p>
              </div>
              <SearchBar
                value={searchReg}
                onChange={setSearchReg}
                placeholder="Cari kabupaten/kota..."
                className="w-full sm:w-60"
              />
            </div>

            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 px-2">Kode</th>
                    <th className="py-2 px-2">Kabupaten / Kota</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Koordinator Daerah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRegencies.map((r) => (
                    <tr key={r.code}>
                      <td className="py-2.5 px-2 font-mono tabular-nums text-slate-500">{r.code}</td>
                      <td className="py-2.5 px-2 font-medium text-slate-900 dark:text-white">{r.name}</td>
                      <td className="py-2.5 px-2">
                        <StatusIndicator status={r.status} />
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">
                        {r.hasCoordinator ? 'Sudah Ditetapkan' : 'Dalam Penjajakan'}
                      </td>
                    </tr>
                  ))}
                  {filteredRegencies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Tidak ada kabupaten/kota yang cocok dengan pencarian Anda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
