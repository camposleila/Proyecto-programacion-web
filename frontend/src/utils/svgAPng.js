// react-pdf no acepta SVG. Se rasteriza el logo en el navegador (canvas) y se
// devuelve un data-URL PNG. Se guarda en caché para no repetir el trabajo.
let cache = null;

export function svgAPng(urlSvg, tamano = 360) {
  if (cache) return Promise.resolve(cache);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = tamano;
      canvas.height = tamano;
      canvas.getContext('2d').drawImage(img, 0, 0, tamano, tamano);
      cache = canvas.toDataURL('image/png');
      resolve(cache);
    };
    img.onerror = () => resolve(null); // sin logo el PDF igual se genera
    img.src = urlSvg;
  });
}
