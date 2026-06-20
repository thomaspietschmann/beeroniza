// @ts-nocheck
/*
 * Vendored pico.js — a face-detection library in ~200 lines of JavaScript.
 *
 * Source:  https://github.com/tehnokv/picojs  (MIT License)
 * Cascade: public/face/facefinder from https://github.com/nenadmarkus/pico (MIT)
 *
 * Adapted for ES modules: the original assigns a global `pico` and uses
 * `module.exports`; here it is a const with named exports, and a couple of
 * implicit globals (`idx`, loop `i`) are declared so the module is strict-safe.
 * Algorithm body is otherwise verbatim.
 */

export function unpack_cascade(bytes) {
  const dview = new DataView(new ArrayBuffer(4));
  // skip the first 8 bytes (version + learning metadata)
  let p = 8;
  // depth of each tree (int32)
  dview.setUint8(0, bytes[p + 0]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
  const tdepth = dview.getInt32(0, true);
  p = p + 4;
  // number of trees (int32)
  dview.setUint8(0, bytes[p + 0]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
  const ntrees = dview.getInt32(0, true);
  p = p + 4;

  let tcodes = [];
  let tpreds = [];
  let thresh = [];
  for (let t = 0; t < ntrees; ++t) {
    let i;
    Array.prototype.push.apply(tcodes, [0, 0, 0, 0]);
    Array.prototype.push.apply(tcodes, bytes.slice(p, p + 4 * Math.pow(2, tdepth) - 4));
    p = p + 4 * Math.pow(2, tdepth) - 4;
    for (i = 0; i < Math.pow(2, tdepth); ++i) {
      dview.setUint8(0, bytes[p + 0]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
      tpreds.push(dview.getFloat32(0, true));
      p = p + 4;
    }
    dview.setUint8(0, bytes[p + 0]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
    thresh.push(dview.getFloat32(0, true));
    p = p + 4;
  }
  tcodes = new Int8Array(tcodes);
  tpreds = new Float32Array(tpreds);
  thresh = new Float32Array(thresh);

  function classify_region(r, c, s, pixels, ldim) {
    r = 256 * r;
    c = 256 * c;
    let o = 0.0;
    const pow2tdepth = Math.pow(2, tdepth) >> 0;
    let root = 0;

    for (let i = 0; i < ntrees; ++i) {
      let idx = 1;
      for (let j = 0; j < tdepth; ++j)
        idx = 2 * idx + (pixels[((r + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 1] * s) >> 8)] <= pixels[((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 3] * s) >> 8)]);

      o = o + tpreds[pow2tdepth * i + idx - pow2tdepth];

      if (o <= thresh[i]) return -1;

      root += 4 * pow2tdepth;
    }
    return o - thresh[ntrees - 1];
  }

  return classify_region;
}

export function run_cascade(image, classify_region, params) {
  const pixels = image.pixels;
  const nrows = image.nrows;
  const ncols = image.ncols;
  const ldim = image.ldim;

  const shiftfactor = params.shiftfactor;
  const minsize = params.minsize;
  const maxsize = params.maxsize;
  const scalefactor = params.scalefactor;

  let scale = minsize;
  const detections = [];

  while (scale <= maxsize) {
    const step = Math.max(shiftfactor * scale, 1) >> 0;
    const offset = (scale / 2 + 1) >> 0;

    for (let r = offset; r <= nrows - offset; r += step)
      for (let c = offset; c <= ncols - offset; c += step) {
        const q = classify_region(r, c, scale, pixels, ldim);
        if (q > 0.0) detections.push([r, c, scale, q]);
      }

    scale = scale * scalefactor;
  }

  return detections;
}

export function cluster_detections(dets, iouthreshold) {
  dets = dets.sort(function (a, b) {
    return b[3] - a[3];
  });

  function calculate_iou(det1, det2) {
    const r1 = det1[0], c1 = det1[1], s1 = det1[2];
    const r2 = det2[0], c2 = det2[1], s2 = det2[2];
    const overr = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
    const overc = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
    return overr * overc / (s1 * s1 + s2 * s2 - overr * overc);
  }

  const assignments = new Array(dets.length).fill(0);
  const clusters = [];
  for (let i = 0; i < dets.length; ++i) {
    if (assignments[i] == 0) {
      let r = 0.0, c = 0.0, s = 0.0, q = 0.0, n = 0;
      for (let j = i; j < dets.length; ++j)
        if (calculate_iou(dets[i], dets[j]) > iouthreshold) {
          assignments[j] = 1;
          r = r + dets[j][0];
          c = c + dets[j][1];
          s = s + dets[j][2];
          q = q + dets[j][3];
          n = n + 1;
        }
      clusters.push([r / n, c / n, s / n, q]);
    }
  }

  return clusters;
}
