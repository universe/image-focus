/* eslint-disable @typescript-eslint/no-unused-expressions */
import decodeBlurHash from './decodeBlurHash.js';

const QUERY_SELECTOR = 'img[data-focus-x][data-focus-y]';
// const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export interface Focus {
  x: number;
  y: number;
  blurhash: string;
  width: number;
  height: number;
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
    const isLoading = !imageW || !imageH;

    // if (!isLoading && img.hasAttribute('data-src')) {
    //   img.src = img.getAttribute('data-src');
    //   img.removeAttribute('data-src');
    // }

    // Get our focus values.
    const focus: Focus = {
      x: parseFloat(img.getAttribute('data-focus-x')) || 0,
      y: parseFloat(img.getAttribute('data-focus-y')) || 0,
      // If we're offered width and height values as data attributes from the user, grab them.
      width: imageW || parseFloat(img.getAttribute('data-width')) || 0,
      height: imageH || parseFloat(img.getAttribute('data-height')) || 0,
      blurhash: img.getAttribute('data-blurhash') || '',
    };

    imageW = focus.width;
    imageH = focus.height;

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
    if (isLoading && focus.blurhash && imageW && imageH) {
      if (img.style.background) {
        return;
      }
      const blurhash = focus.blurhash;
      const smallW =
        imageW > imageH ? 100 : Math.round(100 * (imageW / imageH));
      const smallH =
        imageH > imageW ? 100 : Math.round(100 * (imageH / imageW));
      const pixels = decodeBlurHash(blurhash, smallW, smallH);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = smallW;
      canvas.height = smallH;
      const imageData = ctx.createImageData(smallW, smallH);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
      img.style.background = `url("${canvas.toDataURL(
        'image/jpeg'
      )}") ${hShift}%/${vShift}% no-repeat`;
      img.style.backgroundSize = 'cover';
      img.style.objectFit = 'cover';
      img.style.objectPosition = '-100vw'; // Hide the actual image, we're going to be showing the blurhas and fading it out using css!
    } else if (focus.blurhash) {
      if (img.style.transition) {
        return;
      }
      // We need a slight delay to make sure the browser has rendered the new image into our element. Any less and it just flashes instead of transitioning.
      img.style.transition = 'background-image .333s ease-in-out 1s';
      window.requestAnimationFrame(() => {
        /* eslint-disable-next-line */
        img.style.background = `url("${img.getAttribute('data-src') || img.src}") ${hShift}% ${vShift}% / cover no-repeat, ${img.style.background}`;
        setTimeout(() => {
          img.style.transition = '';
          img.style.objectPosition = `${hShift}% ${vShift}%`;
          img.removeAttribute('data-blurhash');
        }, 1333);
      });
    } else {
      img.style.objectPosition = `${hShift}% ${vShift}%`;
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
