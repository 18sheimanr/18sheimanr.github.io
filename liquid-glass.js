/**
 * Liquid glass — rounded-rect SDF displacement + edge chromatic aberration.
 * kube.io/blog/liquid-glass-css-svg
 */
(function () {
  const BEZEL = 36;
  const EDGE_PAD = 4;
  const DISP_SCALE = 30;
  const CHROMA_SCALE = 8;
  const EDGE_GAMMA = 0.62;
  const MAG_BOOST = 1.1;

  function smootherstep(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function convexProfile(t) {
    return Math.pow(1 - Math.pow(1 - t, 4), 0.25);
  }

  function sdfRoundedRect(px, py, w, h, r) {
    const cx = px - w * 0.5;
    const cy = py - h * 0.5;
    const hx = w * 0.5 - r;
    const hy = h * 0.5 - r;
    const qx = Math.abs(cx) - hx;
    const qy = Math.abs(cy) - hy;
    const ax = Math.max(qx, 0);
    const ay = Math.max(qy, 0);
    return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function blurField(field, w, h, radius) {
    const out = new Float32Array(field.length);
    const r = Math.ceil(radius);
    const sigma = radius / 2;
    const kernel = [];
    let sum = 0;
    for (let i = -r; i <= r; i++) {
      const v = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(v);
      sum += v;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -r; k <= r; k++) {
          const sy = Math.min(h - 1, Math.max(0, y + k));
          v += field[sy * w + x] * kernel[k + r];
        }
        out[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -r; k <= r; k++) {
          const sx = Math.min(w - 1, Math.max(0, x + k));
          v += out[y * w + sx] * kernel[k + r];
        }
        field[y * w + x] = v;
      }
    }
  }

  function buildMaps(width, height) {
    const w = Math.max(4, Math.round(width));
    const h = Math.max(4, Math.round(height));
    const r = Math.min(h * 0.45, 20);
    const dx = new Float32Array(w * h);
    const dy = new Float32Array(w * h);
    const edge = new Float32Array(w * h);
    const eps = 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const onBorder = x < EDGE_PAD || x >= w - EDGE_PAD || y < EDGE_PAD || y >= h - EDGE_PAD;
        if (onBorder) continue;

        const px = x + 0.5;
        const py = y + 0.5;
        const dist = -sdfRoundedRect(px, py, w, h, r);
        if (dist <= 0 || dist > BEZEL) continue;

        const t = dist / BEZEL;
        const mag = convexProfile(1 - t) * smootherstep(1 - t) * MAG_BOOST;

        const gx =
          sdfRoundedRect(px + eps, py, w, h, r) -
          sdfRoundedRect(px - eps, py, w, h, r);
        const gy =
          sdfRoundedRect(px, py + eps, w, h, r) -
          sdfRoundedRect(px, py - eps, w, h, r);
        const glen = Math.hypot(gx, gy) || 1;

        dx[i] = (-gx / glen) * mag;
        dy[i] = (-gy / glen) * mag;
        edge[i] = mag;
      }
    }

    blurField(dx, w, h, 4);
    blurField(dy, w, h, 4);
    blurField(edge, w, h, 3);

    const toDataUrl = (encode) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const j = i * 4;
        encode(img.data, j, i);
      }
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL('image/png');
    };

    const dispUrl = toDataUrl((data, j, i) => {
      data[j] = Math.round(128 + Math.max(-1, Math.min(1, dx[i])) * 127);
      data[j + 1] = Math.round(128 + Math.max(-1, Math.min(1, dy[i])) * 127);
      data[j + 2] = 128;
      data[j + 3] = 255;
    });

    const edgeUrl = toDataUrl((data, j, i) => {
      const v = Math.round(Math.pow(Math.max(0, Math.min(1, edge[i])), EDGE_GAMMA) * 255);
      data[j] = v;
      data[j + 1] = v;
      data[j + 2] = v;
      data[j + 3] = 255;
    });

    return { dispUrl, edgeUrl, w, h };
  }

  function injectFilter() {
    if (document.getElementById('liquid-glass-filter')) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'liquid-glass-filter');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    svg.innerHTML = `
      <defs>
        <filter id="liquid-glass" filterUnits="userSpaceOnUse"
                color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blurred"/>

          <feImage id="liquid-glass-map" href="" x="0" y="0" width="1" height="1"
                   preserveAspectRatio="none" result="disp_raw"/>
          <feGaussianBlur in="disp_raw" stdDeviation="1.2" result="disp_map"/>

          <feImage id="liquid-glass-edge" href="" x="0" y="0" width="1" height="1"
                   preserveAspectRatio="none" result="edge_mask"/>

          <feDisplacementMap in="blurred" in2="disp_map"
            scale="${DISP_SCALE}" xChannelSelector="R" yChannelSelector="G" result="refracted"/>

          <feColorMatrix in="blurred" type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chan_r"/>
          <feDisplacementMap in="chan_r" in2="disp_map"
            scale="${DISP_SCALE - CHROMA_SCALE}" xChannelSelector="R" yChannelSelector="G" result="disp_r"/>

          <feColorMatrix in="blurred" type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chan_g"/>
          <feDisplacementMap in="chan_g" in2="disp_map"
            scale="${DISP_SCALE}" xChannelSelector="R" yChannelSelector="G" result="disp_g"/>

          <feColorMatrix in="blurred" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="chan_b"/>
          <feDisplacementMap in="chan_b" in2="disp_map"
            scale="${DISP_SCALE + CHROMA_SCALE}" xChannelSelector="R" yChannelSelector="G" result="disp_b"/>

          <feComposite in="disp_r" in2="disp_g" operator="arithmetic" k2="1" k3="1" result="rg"/>
          <feComposite in="rg" in2="disp_b" operator="arithmetic" k2="1" k3="1" result="chromatic"/>

          <feComposite in="chromatic" in2="edge_mask" operator="in" result="edge_chromatic_raw"/>
          <feColorMatrix in="edge_chromatic_raw" type="saturate" values="1.85" result="edge_chromatic"/>
          <feComposite in="refracted" in2="edge_mask" operator="out" result="center"/>
          <feComposite in="edge_chromatic" in2="center" operator="over"/>
        </filter>
      </defs>
    `;
    document.body.appendChild(svg);
  }

  function updateMap() {
    const glass = document.querySelector('.nav-glass');
    const feImage = document.getElementById('liquid-glass-map');
    const feEdge = document.getElementById('liquid-glass-edge');
    const filter = document.getElementById('liquid-glass');
    if (!glass || !feImage || !feEdge || !filter) return;

    const { width, height } = glass.getBoundingClientRect();
    const { dispUrl, edgeUrl, w, h } = buildMaps(width, height);

    feImage.setAttribute('href', dispUrl);
    feImage.setAttribute('width', w);
    feImage.setAttribute('height', h);
    feEdge.setAttribute('href', edgeUrl);
    feEdge.setAttribute('width', w);
    feEdge.setAttribute('height', h);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', w);
    filter.setAttribute('height', h);
  }

  function supportsSvgBackdrop() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;backdrop-filter:url(#liquid-glass)';
    document.body.appendChild(probe);
    const ok = getComputedStyle(probe).backdropFilter.includes('url');
    probe.remove();
    return ok;
  }

  function init() {
    const glass = document.querySelector('.nav-glass');
    if (!glass) return;

    injectFilter();
    updateMap();

    if (supportsSvgBackdrop()) {
      glass.classList.add('liquid-glass--refract');
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateMap, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
