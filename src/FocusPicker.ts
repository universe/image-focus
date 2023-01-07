import { encode } from 'blurhash';

import * as Focus from './runtime';

// Utility type for the native custom event we trigger.
const BaseEvent = globalThis.CustomEvent ? CustomEvent : (Event as unknown as typeof CustomEvent);
export class FocusChangeEvent extends BaseEvent<Focus.FocusState> {
  static type: 'focus-change' = 'focus-change';
  constructor(detail: Focus.FocusState) { super(FocusChangeEvent.type, { detail }); }
}

// Augment the global HTML event map for TS support in addEventListener etc.
declare global {
  interface HTMLElementEventMap {
    [FocusChangeEvent.type]: FocusChangeEvent
  }
}

// Programmatic callback function type.
export type OnFocusChange = (focusCoordinates: Focus.FocusState) => void;

// Init options for the FocusPicker class.
export interface FocusPickerOptions {
  onChange?: OnFocusChange; // Callback that receives FocusCoordinates on change
  focus?: Focus.FocusState; // Focus to initialize with
}

// Runtime type safety utility methods.
const isNumber = (val: unknown): val is number => typeof val === 'number';
const isString = (val: unknown): val is string => typeof val === 'string';
const isNull = (val: unknown): val is null => val === null;
const isFit = (val: unknown): val is 'contain' | 'cover' => val === 'contain' || val === 'cover';

// Given an image element, convert it's contents to a blurhash string.
const encodeImageToBlurhash = async(image: HTMLImageElement) => {
  const size = 200;
  const canvas = document.createElement('canvas');
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  if (!width || !height) {
    return '';
  }

  const smallW = width > height ? size : Math.round(size * (width / height));
  const smallH = height > width ? size : Math.round(size * (height / width));

  canvas.width = smallW;
  canvas.height = smallH;

  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, smallW, smallH);
  const imageData = context.getImageData(0, 0, smallW, smallH);
  return encode(imageData.data, imageData.width, imageData.height, 4, 3);
};

function getFit(img: HTMLImageElement): 'contain' | 'cover' {
  const fit = img.getAttribute('data-focus-fit');
  if (fit !== 'contain' && fit !== 'cover') { return 'cover'; }
  return fit;
}

export class FocusPicker {
  readonly img: HTMLImageElement;
  private focus: Focus.FocusState = Focus.stamp();
  private retina: HTMLButtonElement;
  private fitToggle: HTMLButtonElement;
  private mutationObserver: MutationObserver;
  private onChange?: OnFocusChange | null;

  constructor(
    imageNode: HTMLImageElement,
    options: Partial<FocusPickerOptions> = {},
  ) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if ((imageNode as any).__FOCUS_PICKER__) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      return (imageNode as any).__FOCUS_PICKER__ as FocusPicker;
    }
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (imageNode as any).__FOCUS_PICKER__ = this;

    // Save our change callback if provided.
    this.onChange = options.onChange || null;

    // Set up references
    this.img = imageNode;
    this.img.draggable = false;
    this.img.crossOrigin = 'Anonymous';

    // Fetch our initial values from the HTML or constructor options, if they exist.
    this.focus.x = options.focus?.x || parseFloat(this.img.getAttribute('data-focus-x')) || this.focus.x;
    this.focus.y = options.focus?.y || parseFloat(this.img.getAttribute('data-focus-y')) || this.focus.y;
    this.focus.fit = options.focus?.fit || getFit(this.img);
    this.focus.blurhash = options.focus?.blurhash || this.img.getAttribute('data-focus-blurhash') || null;
    this.focus.width = options.focus?.width || this.img.naturalWidth || this.focus.width;
    this.focus.height = options.focus?.height || this.img.naturalHeight || this.focus.height;

    // Create the retina element
    this.retina = document.createElement('button');
    this.retina.draggable = false;
    Object.assign(this.retina.style, {
      position: 'absolute',
      top: '-100px',
      left: '-100px',
      transform: 'translate3d(calc(-50% - 0.5px), calc(-50% + 0.5px), 0)',
      pointerEvents: 'none',
      backgroundColor: 'black',
      border: '3px solid white',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      boxShadow: `
        0 1px 1px 0px rgba(0, 0, 0, 0.55), 
        0 4px 6px rgba(0, 0, 0, 0.1)
      `,
    });

    // Create fit toggle
    this.fitToggle = document.createElement('button');
    this.fitToggle.innerText = 'Cover';
    this.fitToggle.draggable = false;
    Object.assign(this.fitToggle.style, {
      position: 'absolute',
      top: '-100px',
      left: '-100px',
      transform: 'translate3d(-50%, -38px, 0)',
      transition:
        'background .28s ease-in-out .18s, background-position .18s ease-in-out',
      backgroundImage:
        /* eslint-disable-next-line max-len */
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='fill:white;' viewBox='0 0 448 512'%3E%3Cpath d='M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z'/%3E%3C/svg%3E\"), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath d='M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z'/%3E%3C/svg%3E\")",
      backgroundSize: '14px 14px, 14px 14px, 20px 20px, 20px 20px, 20px 20px',
      backgroundPosition: 'left 9px center, right 9px center',
      backgroundRepeat: 'no-repeat',
      color: 'transparent',
      backgroundColor: 'white',
      borderRadius: '18px',
      width: '60px',
      height: '26px',
      cursor: 'pointer',
      boxSizing: 'border-box',
      border: '1px solid transparent',
      boxShadow: '0 1px 1px 0px rgba(0, 0, 0, 0.55), 0 4px 6px rgba(0, 0, 0, 0.1)',
    });

    // Assign styles
    Object.assign(this.img.style, {
      touchAction: 'none', // Prevent Android refresh on pull down
      cursor: 'crosshair',
      objectFit: 'contain',
    });

    // Create and attach the retina focal point, start listeners and attach focus
    this.enable();
  }

  public isEnabled(): boolean {
    return document.body.contains(this.retina);
  }

  public enable() {
    if (this.isEnabled()) {
      return;
    }

    // Attach the retina focal point
    document.body.appendChild(this.retina);
    document.body.appendChild(this.fitToggle);

    // Bind interaction events
    this.img.addEventListener('mousedown', this.startDragging);
    this.img.addEventListener('touchstart', this.startDragging, { passive: true });
    this.fitToggle.addEventListener('click', this.toggleFit.bind(this));

    // Watch for new images being loaded and ensure our blurhash value
    this.img.addEventListener('load', this.onLoad.bind(this));
    if (this.img.complete) { this.onLoad(); }
  }

  private prevSrc: string;
  private async onLoad() {
    // If nothing has changed since the last onLoad call, no-op.
    if (!this.img || (this.prevSrc === this.img.src && this.focus.blurhash)) { return; }
    this.focus.width = this.img.naturalWidth;
    this.focus.height = this.img.naturalHeight;
    this.focus.blurhash = await encodeImageToBlurhash(this.img);
    this.prevSrc = this.img.src;
    this.setFocus(this.focus, { silent: false });
  }

  public disable() {
    if (!this.isEnabled()) {
      return;
    }
    document.body.removeChild(this.retina);
    document.body.removeChild(this.fitToggle);
    this.img.removeEventListener('mousedown', this.startDragging);
    this.img.removeEventListener('touchstart', this.startDragging);
    this.img.removeEventListener('load', this.onLoad);
    this.fitToggle.removeEventListener('click', this.toggleFit);
    this.stopDragging();
  }

  public getFocus(): Focus.FocusState {
    return JSON.parse(JSON.stringify(this.focus));
  }

  public setFocus(focus: Partial<Focus.FocusState>, options?: { silent?: boolean }) {
    let changed = false;
    if (isNumber(focus.x) && focus.x !== this.focus.x) {
      changed = true;
      this.img.setAttribute('data-focus-x', focus.x.toString());
      this.focus.x = focus.x;
    }
    if (isNumber(focus.y) && focus.y !== this.focus.y) {
      changed = true;
      this.img.setAttribute('data-focus-y', focus.y.toString());
      this.focus.y = focus.y;
    }
    if (isNumber(focus.width) && focus.width !== this.focus.width) {
      changed = true;
      this.img.setAttribute('data-focus-width', focus.width.toString());
      this.focus.width = focus.width;
    }
    if (isNumber(focus.height) && focus.height !== this.focus.height) {
      changed = true;
      this.img.setAttribute('data-focus-height', focus.height.toString());
      this.focus.height = focus.height;
    }
    if ((isNull(focus.blurhash) || isString(focus.blurhash)) && focus.blurhash !== this.focus.blurhash) {
      changed = true;
      this.img.setAttribute('data-focus-blurhash', focus.blurhash || '');
      this.focus.fit = focus.fit;
    }
    if (isFit(focus.fit) && focus.fit !== this.focus.fit) {
      changed = true;
      this.img.setAttribute('data-focus-fit', focus.fit);
      this.focus.fit = focus.fit;
    }

    // Must be outside of change check for setting the initial load style.
    Object.assign(this.fitToggle.style, {
      /* eslint-disable max-len */
      backgroundImage: `
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='fill:${this.focus.fit === 'contain' ? 'black' : 'white'
        };' viewBox='0 0 448 512'%3E%3Cpath d='M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z'/%3E%3C/svg%3E"), 
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='fill:${this.focus.fit === 'contain' ? 'white' : 'black'
        };' viewBox='0 0 448 512'%3E%3Cpath d='M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z'/%3E%3C/svg%3E"),
        radial-gradient(farthest-side at 50%, black, black 100%, transparent 100%),
        radial-gradient(farthest-side at 50%, black, black 100%, transparent 100%),
        radial-gradient(farthest-side at 50%, black, black 100%, transparent 100%)
      `,
      /* eslint-enable max-len */
      backgroundPosition: `
        left 8px center, right 8px center, 
        ${this.focus.fit === 'contain' ? 'right' : 'left'} 2px top 2px, 
        ${this.focus.fit === 'contain' ? 'right' : 'left'} 5px top 2px, 
        ${this.focus.fit === 'contain' ? 'right' : 'left'} 8px top 2px
      `,
    });
    if (!changed && options?.silent !== false) { return; }
    this.updateRetinaPosition();
    options?.silent !== true && this.onChange?.(this.getFocus());
  }

  private retinaAnimationFrame: null | number = null;
  public updateRetinaPosition = () => {
    if (!this.retinaAnimationFrame) {
      this.retinaAnimationFrame = window.requestAnimationFrame(() => {
        this.retinaAnimationFrame = null;
        const { width, height, top, left } = this.img.getBoundingClientRect();
        const realWidth = height * (this.focus.width / this.focus.height);
        const realHeight = width * (this.focus.height / this.focus.width);
        const isWide = this.focus.width / width > this.focus.height / height;
        const offsetX = isWide
          ? width * (this.focus.x / 2 + 0.5)
          : width * (this.focus.x / 2 + 0.5) * (realWidth / width) +
          (width - realWidth) / 2;
        const offsetY = !isWide
          ? height * (this.focus.y / -2 + 0.5)
          : height * (this.focus.y / -2 + 0.5) * (realHeight / height) +
          (height - realHeight) / 2;
        this.retina.style.top = `${offsetY + top}px`;
        this.retina.style.left = `${offsetX + left}px`;
        this.fitToggle.style.top = `${top + (!isWide ? height : height * (realHeight / height) + (height - realHeight) / 2)}px`;
        this.fitToggle.style.left = `${left + (width / 2)}px`;
      });
    }
  };

  protected dragDelta: null | { x: number; y: number } = null;
  private toggleFit = () => {
    this.setFocus({ fit: this.focus.fit === 'contain' ? 'cover' : 'contain' });
  };

  private startDragging = (e: MouseEvent | TouchEvent) => {
    document.body.addEventListener('mousemove', this.handleMove);
    document.body.addEventListener('touchmove', this.handleMove, {
      passive: true,
    });
    document.body.addEventListener('mouseup', this.stopDragging);
    document.body.addEventListener('touchend', this.stopDragging);
    this.handleMove(e);
  };

  private handleMove = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();

    // Calculate FocusPoint coordinates
    const delta = (this.dragDelta = this.dragDelta || { x: 0, y: 0 });
    const focus = this.getFocus();
    const { width, height, left, top } = this.img.getBoundingClientRect();
    const { naturalWidth, naturalHeight } = this.img;
    const realWidth = height * (naturalWidth / naturalHeight);
    const realHeight = width * (naturalHeight / naturalWidth);
    const offsetX =
      (e instanceof MouseEvent ? e.clientX : e.touches[0].clientX) - left;
    const offsetY =
      (e instanceof MouseEvent ? e.clientY : e.touches[0].clientY) - top;
    const isWide = naturalWidth / width > naturalHeight / height;
    const x = (offsetX / width - 0.5) * 2 * (!isWide ? realHeight / height : 1);
    const y = (offsetY / height - 0.5) * -2 * (isWide ? realWidth / width : 1);

    delta.x += x - focus.x;
    delta.y += y - focus.y;

    // Set our new focus value.
    this.setFocus({
      x: Math.min(Math.max(x, -1), 1),
      y: Math.min(Math.max(y, -1), 1),
    });
  };

  private stopDragging = () => {
    window.requestAnimationFrame(() => this.dragDelta = null);
    document.body.removeEventListener('mousemove', this.handleMove);
    document.body.removeEventListener('touchmove', this.handleMove);
    document.body.removeEventListener('mouseup', this.stopDragging);
    document.body.removeEventListener('touchend', this.stopDragging);
  };

  // Live collection of all images will update automatically as DOM is changed.
  private static IMAGES: HTMLCollectionOf<HTMLImageElement> | null = null;
  private static run() {
    FocusPicker.IMAGES || (FocusPicker.IMAGES = document.getElementsByTagName('img'));

    // For each image, if it is a focus picker, ensure it is instantiated, and update the retna position.
    for (let i = 0; i < FocusPicker.IMAGES.length; i++) {
      const img = FocusPicker.IMAGES[i];
      if (!img.hasAttribute('data-focus-picker')) { continue; }
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
      (((img as any).__FOCUS_PICKER__ as FocusPicker) || new FocusPicker(img, {
        onChange: (focus) => img.dispatchEvent(new FocusChangeEvent(focus)),
      })).updateRetinaPosition();
    }
    window.requestAnimationFrame(FocusPicker.run);
  }

  public static watch() {
    // Call init to start the run loop once the DOM is ready. 
    (document.readyState === "complete" || document.readyState === "interactive")
      ? FocusPicker.run()
      : document.addEventListener("DOMContentLoaded", FocusPicker.run);
  }
}
