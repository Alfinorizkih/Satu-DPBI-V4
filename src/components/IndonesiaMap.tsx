import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  computeCollectionBBox,
  computeFeatureSvgCenter,
  geometryToSvgPath,
  INDONESIA_BBOX,
  type GeoJsonCollection,
} from '../lib/geojson';
import type { ProvinceRecord, ProvinceStatus, RegencyRecord } from '../lib/types';
import { StatusIndicator } from './ui/Primitives';

interface ProvFeatureProps {
  id?: string;
  KODE_PROV?: string;
  PROVINSI?: string;
}

interface KabFeatureProps {
  KDPKAB?: string;
  KDPPUM?: string;
  WADMKK?: string;
  WADMPR?: string;
}

const STATUS_FILL: Record<ProvinceStatus, string> = {
  aktif: 'fill-[#0EA5E9] hover:fill-[#38BDF8]',
  dalam_pengembangan: 'fill-sky-300 dark:fill-sky-700 hover:fill-sky-400',
  dalam_pembinaan: 'fill-amber-400 dark:fill-amber-600 hover:fill-amber-300',
  belum_terbentuk: 'fill-slate-300 dark:fill-slate-700 hover:fill-slate-400',
  tidak_aktif: 'fill-rose-300 dark:fill-rose-800 hover:fill-rose-400',
};

const SVG_BOUNDS = { width: 960, height: 390, padding: 14 };

export function IndonesiaMap({
  provinces,
  selectedCode,
  onSelect,
  drillProvinceCode,
  onChangeDrillProvince,
  regencies = [],
  selectedRegencyCode = null,
  onSelectRegency,
  compact = false,
}: {
  provinces: ProvinceRecord[];
  selectedCode: string | null;
  onSelect: (province: ProvinceRecord) => void;
  drillProvinceCode?: string | null;
  onChangeDrillProvince?: (code: string | null) => void;
  regencies?: RegencyRecord[];
  selectedRegencyCode?: string | null;
  onSelectRegency?: (regency: RegencyRecord) => void;
  compact?: boolean;
}) {
  const [provGeo, setProvGeo] = useState<GeoJsonCollection<ProvFeatureProps> | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [internalDrillCode, setInternalDrillCode] = useState<string | null>(null);
  const [kabGeo, setKabGeo] = useState<GeoJsonCollection<KabFeatureProps> | null>(null);
  const [kabLoading, setKabLoading] = useState(false);
  const [hoveredProvCode, setHoveredProvCode] = useState<string | null>(null);
  const [hoveredKabCode, setHoveredKabCode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const activeDrillCode = drillProvinceCode !== undefined ? drillProvinceCode : internalDrillCode;

  const setDrillCode = (code: string | null) => {
    setZoom(1);
    setHoveredKabCode(null);
    if (onChangeDrillProvince) {
      onChangeDrillProvince(code);
    } else {
      setInternalDrillCode(code);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/maps/indonesia-38-provinces.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat peta GeoJSON 38 provinsi.');
        return res.json() as Promise<GeoJsonCollection<ProvFeatureProps>>;
      })
      .then((data) => {
        if (active) {
          setProvGeo(data);
          setGeoError(null);
        }
      })
      .catch((err) => {
        if (active) setGeoError(err instanceof Error ? err.message : 'Gagal memuat peta.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeDrillCode) {
      setKabGeo(null);
      return;
    }
    let active = true;
    setKabLoading(true);
    fetch(`/maps/kabupaten/${activeDrillCode}.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error('Batas kabupaten/kota untuk provinsi ini tidak tersedia.');
        return res.json() as Promise<GeoJsonCollection<KabFeatureProps>>;
      })
      .then((data) => {
        if (active) {
          setKabGeo(data);
          setKabLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setKabGeo(null);
          setKabLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [activeDrillCode]);

  const provinceMap = useMemo(() => {
    const m = new Map<string, ProvinceRecord>();
    for (const p of provinces) m.set(p.code, p);
    return m;
  }, [provinces]);

  const regencyMap = useMemo(() => {
    const m = new Map<string, RegencyRecord>();
    for (const r of regencies) m.set(r.code, r);
    return m;
  }, [regencies]);

  const nationalPaths = useMemo(() => {
    if (!provGeo) return [];
    return provGeo.features.map((feat) => {
      const code = String(feat.properties.KODE_PROV || feat.properties.id || '').trim();
      const name = String(feat.properties.PROVINSI || code);
      const d = geometryToSvgPath(feat.geometry, INDONESIA_BBOX, SVG_BOUNDS);
      const [cx, cy] = computeFeatureSvgCenter(feat.geometry, INDONESIA_BBOX, SVG_BOUNDS);
      return { code, name, d, cx, cy };
    });
  }, [provGeo]);

  const kabPaths = useMemo(() => {
    if (!kabGeo || !kabGeo.features?.length) return [];
    const bbox = computeCollectionBBox(kabGeo.features);
    return kabGeo.features.map((feat) => {
      const code = String(feat.properties.KDPKAB || '').trim();
      const name = String(feat.properties.WADMKK || code);
      const d = geometryToSvgPath(feat.geometry, bbox, SVG_BOUNDS);
      const [cx, cy] = computeFeatureSvgCenter(feat.geometry, bbox, SVG_BOUNDS);
      return { code, name, d, cx, cy };
    });
  }, [kabGeo]);

  const activeProvince = (hoveredProvCode ? provinceMap.get(hoveredProvCode) : null) ||
    (selectedCode ? provinceMap.get(selectedCode) : null);

  const drillProvince = activeDrillCode ? provinceMap.get(activeDrillCode) : null;
  const activeRegency =
    (hoveredKabCode ? regencyMap.get(hoveredKabCode) : null) ||
    (selectedRegencyCode ? regencyMap.get(selectedRegencyCode) : null);

  const hoveredKabFeatureName = hoveredKabCode
    ? kabPaths.find((k) => k.code === hoveredKabCode)?.name
    : null;

  return (
    <div className="space-y-3">
      {/* Legend & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3.5 text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#0EA5E9] inline-block shrink-0" /> Aktif
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-sky-300 dark:bg-sky-700 inline-block shrink-0" /> Dalam Pengembangan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-amber-400 dark:bg-amber-600 inline-block shrink-0" /> Dalam Pembinaan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-300 dark:fill-slate-700 dark:bg-slate-700 inline-block shrink-0" /> Belum Terbentuk
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeDrillCode ? (
            <button
              type="button"
              onClick={() => setDrillCode(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold hover:border-[#0EA5E9] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Peta Indonesia
            </button>
          ) : (
            selectedCode && (
              <button
                type="button"
                onClick={() => setDrillCode(selectedCode)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0EA5E9] text-white font-semibold hover:bg-sky-600 whitespace-nowrap shrink-0"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Drilldown Kab/Kota
              </button>
            )
          )}
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.35) * 100) / 100))}
              aria-label="Perkecil peta"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.1, Math.round((z + 0.35) * 100) / 100))}
              aria-label="Perbesar peta"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom peta"
                className="p-1.5 border-l border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive GeoJSON Canvas */}
      <div className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-sky-50/50 to-slate-100/70 dark:from-slate-900 dark:to-slate-950 p-3 overflow-hidden">
        {activeDrillCode && drillProvince && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/70 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">
              Peta Kabupaten/Kota · {drillProvince.name}
            </span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {kabPaths.length} wilayah administratif
            </span>
          </div>
        )}

        <div className="overflow-auto">
          {geoError ? (
            <div className="py-12 text-center text-xs text-rose-600 dark:text-rose-400">{geoError}</div>
          ) : !provGeo ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Memuat poligon resmi 38 provinsi Indonesia...
            </div>
          ) : activeDrillCode && kabLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Memuat batas Kabupaten/Kota untuk {drillProvince?.name || activeDrillCode}...
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${SVG_BOUNDS.width} ${SVG_BOUNDS.height}`}
              style={{ width: `${Math.round(zoom * 100)}%` }}
              className={`min-w-full h-auto ${compact ? 'max-h-[300px]' : 'max-h-[410px]'} select-none transition-all duration-150`}
              role="img"
              aria-label={
                activeDrillCode
                  ? `Peta Kabupaten dan Kota Provinsi ${drillProvince?.name || activeDrillCode}`
                  : 'Peta interaktif 38 provinsi Indonesia SATU DPBI'
              }
            >
              {/* Equator & meridian reference lines */}
              <line
                x1="0"
                y1={SVG_BOUNDS.height / 2}
                x2={SVG_BOUNDS.width}
                y2={SVG_BOUNDS.height / 2}
                className="stroke-sky-200/40 dark:stroke-slate-800/70"
                strokeDasharray="4 4"
              />
              <line
                x1={SVG_BOUNDS.width / 2}
                y1="0"
                x2={SVG_BOUNDS.width / 2}
                y2={SVG_BOUNDS.height}
                className="stroke-sky-200/40 dark:stroke-slate-800/70"
                strokeDasharray="4 4"
              />

              {activeDrillCode && kabPaths.length > 0
                ? kabPaths.map((kab) => {
                    const reg = regencyMap.get(kab.code);
                    const status: ProvinceStatus = reg?.status ?? drillProvince?.status ?? 'belum_terbentuk';
                    const isSelected = selectedRegencyCode === kab.code;
                    return (
                      <g
                        key={kab.code || kab.name}
                        data-regency-code={kab.code}
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`${kab.name}, status ${status.replace(/_/g, ' ')}`}
                        onMouseEnter={() => setHoveredKabCode(kab.code)}
                        onMouseLeave={() => setHoveredKabCode(null)}
                        onClick={() => {
                          if (reg && onSelectRegency) {
                            onSelectRegency(reg);
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && reg && onSelectRegency) {
                            e.preventDefault();
                            onSelectRegency(reg);
                          }
                        }}
                      >
                        <path
                          d={kab.d}
                          strokeWidth={isSelected ? 2 : 0.9}
                          className={`${STATUS_FILL[status]} transition-colors duration-150 ${
                            isSelected
                              ? 'stroke-slate-950 dark:stroke-white'
                              : 'stroke-white dark:stroke-slate-900'
                          }`}
                        />
                      </g>
                    );
                  })
                : nationalPaths.map((prov) => {
                    const rec = provinceMap.get(prov.code);
                    const status: ProvinceStatus = rec?.status ?? 'belum_terbentuk';
                    const isSelected = selectedCode === prov.code;
                    return (
                      <g
                        key={prov.code}
                        data-province-code={prov.code}
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`Provinsi ${rec?.name || prov.name}, status ${status.replace(/_/g, ' ')}`}
                        onMouseEnter={() => setHoveredProvCode(prov.code)}
                        onMouseLeave={() => setHoveredProvCode(null)}
                        onClick={() => rec && onSelect(rec)}
                        onDoubleClick={() => {
                          if (rec) {
                            onSelect(rec);
                            setDrillCode(rec.code);
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && rec) {
                            e.preventDefault();
                            onSelect(rec);
                          }
                        }}
                      >
                        <path
                          d={prov.d}
                          strokeWidth={isSelected ? 1.8 : 0.75}
                          className={`${STATUS_FILL[status]} transition-colors duration-150 ${
                            isSelected
                              ? 'stroke-slate-950 dark:stroke-white'
                              : 'stroke-white/90 dark:stroke-slate-900'
                          }`}
                        />
                      </g>
                    );
                  })}
            </svg>
          )}
        </div>

        {/* Live hover or selected summary strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs">
          {activeDrillCode ? (
            activeRegency ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">{activeRegency.name}</span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{activeRegency.code}</span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <StatusIndicator status={activeRegency.status} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300 tabular-nums">
                  <span>Koordinator: {activeRegency.coordinatorName || 'Belum ditetapkan'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeRegency.domicileDutaCount ?? 0} Domisili</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeRegency.assignmentDutaCount ?? 0} Penugasan</span>
                </div>
              </>
            ) : hoveredKabFeatureName ? (
              <p className="text-slate-700 dark:text-slate-200 font-medium">{hoveredKabFeatureName}</p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Arahkan kursor atau klik Kabupaten/Kota di {drillProvince?.name || 'provinsi'} untuk melihat keterwakilan daerah.
              </p>
            )
          ) : activeProvince ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">{activeProvince.name}</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400">{activeProvince.island}</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <StatusIndicator status={activeProvince.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300 tabular-nums">
                <span>
                  {activeProvince.activeRegencyCount ?? 0}/{activeProvince.regencyCount ?? 0} Kab/Kota aktif
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeProvince.lklCount ?? 0} LKL</span>
                <span aria-hidden="true">·</span>
                <span>{activeProvince.proposalCount ?? 0} Proposal</span>
              </div>
            </>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">
              Klik salah satu dari 38 provinsi untuk memeriksa detail wilayah atau klik dua kali untuk drilldown Kabupaten/Kota.
            </p>
          )}
        </div>

        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          Sumber batas administratif: GeoJSON 38 Provinsi &amp; Kabupaten/Kota Indonesia (BIG/BPS · Lisensi MIT / CC BY 4.0)
        </p>
      </div>
    </div>
  );
}
