export type GeoCoord = [number, number]; // [lng, lat]

export interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: GeoCoord[][] | GeoCoord[][][];
}

export interface GeoJsonFeature<P = Record<string, unknown>> {
  type: 'Feature';
  id?: string | number;
  properties: P;
  geometry: GeoJsonGeometry;
}

export interface GeoJsonCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: GeoJsonFeature<P>[];
}

export interface GeoBBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export const INDONESIA_BBOX: GeoBBox = {
  minLng: 94.8,
  maxLng: 141.3,
  minLat: -11.2,
  maxLngPadding: undefined,
  maxLat: 6.2,
} as GeoBBox;

export interface SvgBounds {
  width: number;
  height: number;
  padding?: number;
}

function walkCoords(geometry: GeoJsonGeometry, cb: (coord: GeoCoord) => void): void {
  if (!geometry || !geometry.coordinates) return;
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as GeoCoord[][];
    for (const ring of rings) {
      for (const c of ring) {
        if (Array.isArray(c) && c.length >= 2) cb(c);
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as GeoCoord[][][];
    for (const poly of polys) {
      for (const ring of poly) {
        for (const c of ring) {
          if (Array.isArray(c) && c.length >= 2) cb(c);
        }
      }
    }
  }
}

export function computeCollectionBBox<P = Record<string, unknown>>(features: GeoJsonFeature<P>[]): GeoBBox {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const f of features) {
    walkCoords(f.geometry, ([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  }
  if (!Number.isFinite(minLng)) return INDONESIA_BBOX;
  const dLng = Math.max(0.05, (maxLng - minLng) * 0.06);
  const dLat = Math.max(0.05, (maxLat - minLat) * 0.06);
  return {
    minLng: minLng - dLng,
    maxLng: maxLng + dLng,
    minLat: minLat - dLat,
    maxLat: maxLat + dLat,
  };
}

export function projectPoint(
  lng: number,
  lat: number,
  bbox: GeoBBox,
  bounds: SvgBounds
): [number, number] {
  const pad = bounds.padding ?? 12;
  const innerW = bounds.width - pad * 2;
  const innerH = bounds.height - pad * 2;
  const spanLng = Math.max(0.0001, bbox.maxLng - bbox.minLng);
  const spanLat = Math.max(0.0001, bbox.maxLat - bbox.minLat);

  // Preserve geographic aspect ratio centered in viewport
  const scaleX = innerW / spanLng;
  const scaleY = innerH / spanLat;
  const scale = Math.min(scaleX, scaleY);

  const usedW = spanLng * scale;
  const usedH = spanLat * scale;
  const offsetX = pad + (innerW - usedW) / 2;
  const offsetY = pad + (innerH - usedH) / 2;

  const x = offsetX + (lng - bbox.minLng) * scale;
  const y = offsetY + (bbox.maxLat - lat) * scale;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function ringToPath(ring: GeoCoord[], bbox: GeoBBox, bounds: SvgBounds): string {
  if (!ring || ring.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const [x, y] = projectPoint(lng, lat, bbox, bounds);
    parts.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

export function geometryToSvgPath(
  geometry: GeoJsonGeometry,
  bbox: GeoBBox,
  bounds: SvgBounds
): string {
  if (!geometry || !geometry.coordinates) return '';
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as GeoCoord[][];
    return rings.map((r) => ringToPath(r, bbox, bounds)).filter(Boolean).join(' ');
  }
  const polys = geometry.coordinates as GeoCoord[][][];
  const segments: string[] = [];
  for (const poly of polys) {
    for (const r of poly) {
      const p = ringToPath(r, bbox, bounds);
      if (p) segments.push(p);
    }
  }
  return segments.join(' ');
}

export function computeFeatureSvgCenter(
  geometry: GeoJsonGeometry,
  bbox: GeoBBox,
  bounds: SvgBounds
): [number, number] {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  walkCoords(geometry, ([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  if (!Number.isFinite(minLng)) return [bounds.width / 2, bounds.height / 2];
  return projectPoint((minLng + maxLng) / 2, (minLat + maxLat) / 2, bbox, bounds);
}
