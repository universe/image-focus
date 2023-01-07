import decodeBlurHash from './decodeBlurHash.js';

const DATA_ATTR = 'data-focus';
const TRANSITION_DURATION = 320;
const TRANSITION_DELAY = 280;
const QUERY_SELECTOR = `img[${DATA_ATTR}]`;
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const enum LoadingState {
  LOADING = 'loading',
  TRANSITIONING = 'transitioning',
  COMPLETE = 'complete',
}

export interface FocusState {
  x: number;
  y: number;
  width: number;
  height: number;
  fit: 'cover' | 'contain';
  blurhash: string | null;
}

// V1 encoding for focus attribute. Version number, x * 100, y * 100, width, height, fit (0/1), blurhash
type EncodedFocusState = [number, number, number, number, number, 0 | 1, string];

export function decode(data: string): FocusState {
  const [ version, x, y, width, height, fit, blurhash ] = JSON.parse(atob(data)) as Partial<EncodedFocusState> || [];
  if (version !== 1) { throw new Error('Unknown focus encoding version.'); }
  return {
    x: x / 100 || 0,
    y: y / 100 || 0,
    width: width || 0,
    height: height || 0,
    fit: fit === 0 ? 'contain' : 'cover',
    blurhash: blurhash || null,
  };
}

export function encode(focus: FocusState, version = 1): string {
  if (version !== 1) { throw new Error('Unknown focus encoding version.'); }
  return btoa(JSON.stringify([
    version,
    Math.round(focus.x * 100),
    Math.round(focus.y * 100),
    focus.width,
    focus.height,
    focus.fit === 'cover' ? 1 : 0,
    focus.blurhash,
  ])).replaceAll('=', '');
}

export function stamp(focus: Partial<FocusState> = {}): FocusState {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    fit: 'cover',
    blurhash: null,
    ...focus,
  };
}

function getBlurHashBackground(canvas: HTMLCanvasElement, focus: FocusState): string {
  if (!focus.blurhash) { return `url(${TRANSPARENT_PIXEL})`; }
  const ctx = canvas.getContext('2d');
  const blurhash = focus.blurhash;
  const imageW = focus.width;
  const imageH = focus.height;
  const smallW = imageW > imageH ? 100 : Math.round(100 * (imageW / imageH));
  const smallH = imageH > imageW ? 100 : Math.round(100 * (imageH / imageW));
  const pixels = decodeBlurHash(blurhash, smallW, smallH);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = smallW;
  canvas.height = smallH;
  const imageData = ctx.createImageData(smallW, smallH);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return `url("${canvas.toDataURL('image/jpeg')}")`;
}

// Calculate the new left/top percentage shift of an image
function calcShift(
  containerSize: number,
  imageSize: number,
  focusSize: number,
  toMinus?: boolean,
) {
  const res =
    50 * focusSize +
    (1 / ((imageSize - containerSize) / containerSize)) * 50 * focusSize;
  return Math.min(Math.max(50 + (toMinus ? -1 : 1) * res, 0), 100);
}

let canvas: HTMLCanvasElement | null = null;
function applyShift(
  img: HTMLImageElement,
  elementW: number,
  elementH: number,
) {
  // Don't run on our focus picker images.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  if ((img as any).__FOCUS_PICKER__) {
    return;
  }

  // Get our focus values.
  const focus = decode(img.getAttribute(DATA_ATTR));
  canvas = canvas || document.createElement('canvas');

  // Grab our updated width and height values. These may be different than
  // the natural width and height values if the image is not loaded yet.
  const imageW = focus.width;
  const imageH = focus.height;

  // Need dimensions to proceed
  if (!(elementW > 0 && elementH > 0 && imageW > 0 && imageH > 0)) {
    return false;
  }

  // Which is over by more?
  const wR = imageW / elementW;
  const hR = imageH / elementH;

  // Amount position will be shifted
  let hShift = 50;
  let vShift = 50;

  if (focus.fit === 'cover') {
    if (wR > hR) {
      hShift = calcShift(elementW, imageW / hR, focus.x);
    }
    else if (wR < hR) {
      vShift = calcShift(elementH, imageH / wR, focus.y, true);
    }
  }
  else if (wR < hR) {
    hShift = (focus.x * 50) + 50;
  }
  else if (wR > hR) {
    vShift = 100 - ((focus.y * 50) + 50);
  }

  // Fetch our current loading state.
  let loadingState: LoadingState | null = img.style.getPropertyValue('--loading') as LoadingState || null;

  // Set all our default values.
  img.style.objectFit = focus.fit;
  img.style.transition = `background-image ${TRANSITION_DURATION}ms ease-in-out ${TRANSITION_DELAY}ms`;
  img.style.backgroundPosition = `${hShift}% ${vShift}%`;
  img.style.backgroundSize = focus.fit;
  img.style.objectFit = focus.fit;
  img.style.backgroundRepeat = 'no-repeat';

  // If our image's src has changed since we were last here, reset everything!
  if (img.src !== img.style.getPropertyValue('--src').slice(1, -1)) {
    img.style.setProperty('--src', `"${img.src}"`);
    img.style.setProperty('--loading', '');
    img.style.setProperty('--blurhash', '');
    loadingState = null;
  }

  // If we haven't encountered this image before, mark it as loading and hide the image for a fade-in effect.
  // We're going to show the blurhash and fade it in using css magic!
  if (!loadingState) {
    img.style.objectPosition = '-1000vw';
    img.style.setProperty('--loading', loadingState = LoadingState.LOADING);
  }

  // If our blurhash value has changed, and we haven't fully revealed the image yet, make sure we set it correctly.
  if (img.style.getPropertyValue('--blurhash').slice(1, -1) !== focus.blurhash && loadingState !== LoadingState.COMPLETE) {
    img.style.setProperty('--blurhash', `"${focus.blurhash}"`);
    img.style.backgroundImage = getBlurHashBackground(canvas, focus);
  }

  // If our image has fully loaded, and we haven't triggered the big reveal yet, fade out our background image.
  if (img.complete && loadingState === LoadingState.LOADING) {
    img.style.setProperty('--loading', LoadingState.TRANSITIONING);
    // We need a slight delay before setting the background image to make sure the browser has actually 
    // rendered the blurhash. If we don't then the full image just pops in instead of transitioning.
    setTimeout(() => {
      img.style.backgroundImage = `url("${img.src}")`;
      // Once the transition is done playing, swap the background image with the real object.
      setTimeout(() => {
        img.style.setProperty('--loading', LoadingState.COMPLETE);
        img.style.objectPosition = `${hShift}% ${vShift}%`;
        img.style.backgroundImage = '';
      }, TRANSITION_DURATION + TRANSITION_DELAY + 10);
    }, 10);
  }

  // If we're fully loaded, simply update the object position so it's focused correctly.
  else if (loadingState === LoadingState.COMPLETE) {
    img.style.objectPosition = `${hShift}% ${vShift}%`;
  }
}

function applyToImg(img: HTMLImageElement) {
  const { width, height } = img.getBoundingClientRect();
  applyShift(img, width, height);
}

function applyToEvent(evt: Event) {
  applyToImg(evt.target as HTMLImageElement);
}

const observing: WeakSet<HTMLImageElement> = new WeakSet();
const resizeObserver: ResizeObserver | null = globalThis.ResizeObserver ? new ResizeObserver(entries => {
  for (const entry of entries) {
    const img = entry.target as HTMLImageElement;
    const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0];
    applyShift(img, width, height);
  }
}) : null;

const mutationObserver: MutationObserver | null = globalThis.MutationObserver ? new MutationObserver(entries => {
  for (const entry of entries) {
    switch (entry.type) {
      case 'childList': {
        for (const el of Array.from(
          entry.removedNodes,
        ) as HTMLImageElement[]) {
          if (!el || !el?.matches?.(QUERY_SELECTOR) || observing.has(el)) { continue; }
          observing.delete(el);
          resizeObserver?.unobserve(el);
          el.removeEventListener('load', applyToEvent);
        }
        for (const el of Array.from(entry.addedNodes) as HTMLImageElement[]) {
          if (!el || !el?.matches?.(QUERY_SELECTOR) || observing.has(el)) { continue; }
          observing.add(el);
          resizeObserver?.observe(el);
          el.addEventListener('load', applyToEvent);
          applyToImg(el);
        }
        break;
      }
      case 'attributes': {
        const el = entry.target as HTMLImageElement;
        if (!el?.matches?.(QUERY_SELECTOR)) { continue; }
        applyToImg(el); // Always run this
        if (observing.has(el)) { continue; }
        observing.add(el);
        resizeObserver?.observe(el);
        el.addEventListener('load', applyToEvent);
        break;
      }
    }
  }
}) : null;

function run() {
  // Observe our document for changes to image elements with a `data-focus` attribute.
  mutationObserver?.observe(document.body, {
    subtree: true,
    childList: true,
    attributeFilter: [ DATA_ATTR, 'src' ],
  });

  // Initialize all existing images with a `data-focus` attribute on the page.
  for (const img of Array.from(document.querySelectorAll<HTMLImageElement>(QUERY_SELECTOR))) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if ((img as any).__FOCUS_PICKER__ || img.tagName !== 'IMG') { continue; }
    img.style.objectPosition = '-1000vw';
    img.style.setProperty('--loading', LoadingState.LOADING);
    if (observing.has(img)) { continue; }
    observing.add(img);
    resizeObserver.observe(img);
    img.addEventListener('load', applyToEvent);
    applyToImg(img);
  }
}

// Call start the run loop once the DOM is ready. 
export function watch() {
  (document.readyState === "complete" || document.readyState === "interactive")
    ? run()
    : document.addEventListener("DOMContentLoaded", run);
}

// Always hide our focused images until we are initialitzed. 
// This is safe to run on module load in the browser becuase 
// we're interacting with the head, not the body. However,
// wrap it in a try/catch in case this is imported in a 
// non-browser environment.
try {
  const style = document.createElement('style');
  style.id = 'image-focus';
  style.innerHTML = `img[${DATA_ATTR}] { object-position: -1000vw; }`;
  document.head.appendChild(style);
}
catch { 1; }
