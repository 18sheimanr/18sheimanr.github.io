/* SVG refraction filter — based on LogRocket "Liquid Glass" (feDisplacementMap pipeline) */
(function injectLiquidGlassFilter() {
  if (document.getElementById('blog-liquid-glass-filter')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'blog-liquid-glass-filter');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';

  svg.innerHTML = `
    <defs>
      <filter id="blog-liquid-glass" x="-5%" y="-20%" width="110%" height="140%"
              color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blurred_source"/>

        <feTurbulence type="fractalNoise" baseFrequency="0.01 0.055" numOctaves="2" seed="6" result="noise"/>
        <feGaussianBlur in="noise" stdDeviation="2.2" result="displacement_map"/>

        <feDisplacementMap in="blurred_source" in2="displacement_map"
          scale="12" xChannelSelector="R" yChannelSelector="G" result="displaced"/>

        <feColorMatrix in="displaced" type="saturate" values="2.1" result="displaced_saturated"/>

        <feColorMatrix in="displaced_saturated" type="matrix"
          values="1.08 0.02 0    0 0
                  0    1.04 0.02 0 0
                  0.02 0    1.12 0 0
                  0    0    0    1 0" result="chromatic"/>

        <feBlend in="chromatic" in2="displaced" mode="normal"/>
      </filter>
    </defs>
  `;

  document.body.appendChild(svg);
})();

(function enableSvgBackdrop() {
  const glass = document.querySelector('.nav-glass');
  if (!glass) return;

  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;backdrop-filter:url(#blog-liquid-glass)';
  document.body.appendChild(probe);
  const supports = getComputedStyle(probe).backdropFilter.includes('url');
  probe.remove();

  if (supports) glass.classList.add('liquid-glass--refract');
})();

document.querySelector('.nav-toggle')?.addEventListener('click', function () {
  document.querySelector('.nav-links')?.classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelector('.nav-links')?.classList.remove('open');
  });
});
