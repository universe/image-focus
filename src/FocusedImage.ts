/* eslint-disable @typescript-eslint/no-unused-expressions */
import decodeBlurHash from './decodeBlurHash.js';

const QUERY_SELECTOR = 'img[data-focus-x][data-focus-y]';
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export interface Focus {
  x: number;
  y: number;
}

export function start() {
  const observing: WeakSet<HTMLImageElement> = new WeakSet();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Calculate the new left/top percentage shift of an image
  function calcShift(
    containerSize: number,
    imageSize: number,
    focusSize: number,
    toMinus?: boolean
  ) {
    const res =
      50 * focusSize +
      (1 / ((imageSize - containerSize) / containerSize)) * 50 * focusSize;
    return Math.min(Math.max(50 + (toMinus ? -1 : 1) * res, 0), 100);
  }

  function applyShift(
    img: HTMLImageElement,
    elementW: number,
    elementH: number
  ) {
    if ((img as any).__FOCUS_PICKER__) {
      return;
    }

    // Fetch the natural size of the image (not the rendered size).
    let { naturalWidth: imageW, naturalHeight: imageH } = img;

    // Test if the image is still loading.
    const isLoading = img.src === TRANSPARENT_PIXEL || !imageW || !imageH;

    if (!isLoading && img.hasAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    }

    // If we're offered width and height values as data attributes from the user, grab them.
    if (!imageW && img.hasAttribute('data-width')) {
      imageW = parseFloat(img.getAttribute('data-width'));
    }
    if (!imageH && img.hasAttribute('data-height')) {
      imageH = parseFloat(img.getAttribute('data-height'));
    }

    // Get our focus values.
    const focus: Focus = {
      x: parseFloat(img.getAttribute('data-focus-x')) || 0,
      y: parseFloat(img.getAttribute('data-focus-y')) || 0,
    };

    // Amount position will be shifted
    let hShift = 50;
    let vShift = 50;

    // Need dimensions to proceed
    if (!(elementW > 0 && elementH > 0 && imageW > 0 && imageH > 0)) {
      return false;
    }

    // Which is over by more?
    const wR = imageW / elementW;
    const hR = imageH / elementH;

    if (wR > hR) {
      hShift = calcShift(elementW, imageW / hR, focus.x);
    } else if (wR < hR) {
      vShift = calcShift(elementH, imageH / wR, focus.y, true);
    }

    img.style.objectFit = 'cover';
    img.style.objectPosition = `${hShift}% ${vShift}%`;

    if (img.hasAttribute('data-blurhash')) {
      if (isLoading && img.src !== TRANSPARENT_PIXEL) {
        img.setAttribute('data-src', img.src);
        img.src = TRANSPARENT_PIXEL;
      }
      const blurhash = img.getAttribute('data-blurhash');
      const pixels = decodeBlurHash(blurhash, imageW, imageH);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = imageW;
      canvas.height = imageH;
      const imageData = ctx.createImageData(imageW, imageH);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
      img.style.background = `url("${canvas.toDataURL(
        'image/jpeg'
      )}") ${hShift}%/${vShift}% no-repeat`;
      img.style.backgroundSize = 'cover';
    }
  }

  function applyToEvent(evt: Event) {
    const img = evt.target as HTMLImageElement;
    const { width, height } = img.getBoundingClientRect();
    applyShift(img, width, height);
  }

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const img = entry.target as HTMLImageElement;
      const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0];
      applyShift(img, width, height);
    }
  });

  const mutations = new MutationObserver(entries => {
    for (const entry of entries) {
      switch (entry.type) {
        case 'childList': {
          for (const el of Array.from(
            entry.removedNodes
          ) as HTMLImageElement[]) {
            if (!el || !el.matches || !el.matches(QUERY_SELECTOR)) {
              continue;
            }
            if (observing.has(el)) {
              observing.delete(el);
              observer.unobserve(el);
              el.removeEventListener('load', applyToEvent);
            }
          }
          for (const el of Array.from(entry.addedNodes) as HTMLImageElement[]) {
            if (!el || !el.matches || !el.matches(QUERY_SELECTOR)) {
              continue;
            }
            if (!observing.has(el)) {
              observing.add(el);
              observer.observe(el);
              el.addEventListener('load', applyToEvent);
            }
          }
          break;
        }
        case 'attributes': {
          const img = entry.target as HTMLImageElement;
          const { width, height } = img.getBoundingClientRect();
          applyShift(img, width, height);
          break;
        }
      }
    }
  });

  for (const img of Array.from(
    document.querySelectorAll(QUERY_SELECTOR)
  ) as HTMLImageElement[]) {
    const { width, height } = img.getBoundingClientRect();
    if (!observing.has(img)) {
      observing.add(img);
      observer.observe(img);
      img.addEventListener('load', applyToEvent);
    }
    applyShift(img, width, height);
  }

  mutations.observe(document.body, {
    subtree: true,
    childList: true,
    attributeFilter: [
      'data-focus-x',
      'data-focus-y',
      'data-blurhash',
      'data-width',
      'data-height',
    ],
  });
}
