import { encode } from 'blurhash';
import { Focus } from './FocusedImage';

/**
 * @param {Focus} focusCoordinates
 * @returns {void}
 */
export type OnFocusChange = (focusCoordinates: Focus) => void;

export interface FocusPickerOptions {
  onChange?: OnFocusChange; // Callback that receives FocusCoordinates on change
  focus?: Focus; // Focus to initialize with
  retina?: string; // The src attribute for the retina
}

const encodeImageToBlurhash = async (image: HTMLImageElement) => {
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

export class FocusPicker {
  readonly img: HTMLImageElement;
  private container: HTMLElement;
  private blurhash: string;
  private prevSrc: string;
  private retina: HTMLButtonElement;
  private fitToggle: HTMLButtonElement;
  private onChange?: OnFocusChange | null;

  constructor(
    imageNode: HTMLImageElement,
    options: Partial<FocusPickerOptions> = {}
  ) {
    if ((imageNode as any).__FOCUS_PICKER__) {
      return (imageNode as any).__FOCUS_PICKER__ as FocusPicker;
    }
    (imageNode as any).__FOCUS_PICKER__ = this;

    // Set up references
    this.img = imageNode;
    this.img.draggable = false;
    this.img.crossOrigin = 'Anonymous';
    this.container = imageNode.parentElement;
    this.onChange = options.onChange || null;

    // Create retina element
    this.retina = document.createElement('button');
    // this.retina.src = options.retina || retina;
    this.retina.draggable = false;
    Object.assign(this.retina.style, {
      position: 'absolute',
      transform: 'translate(calc(-50% - 0.5px), calc(-50% + 0.5px))',
      pointerEvents: 'none',
      backgroundColor: 'black',
      border: '2px solid white',
      opacity: '0.66',
      width: '22px',
      height: '22px',
      borderRadius: '50%',
    });

    // Create fit toggle
    this.fitToggle = document.createElement('button');
    this.fitToggle.innerText = 'Cover';
    this.fitToggle.draggable = false;
    this.fitToggle.addEventListener('click', () => {
      const focus = this.getFocus();
      this.setFit(focus.fit === 'contain' ? 'cover' : 'contain');
    });
    Object.assign(this.fitToggle.style, {
      position: 'absolute',
      bottom: '12px',
      left: '50%',
      transform: 'translate(-50%, 0)',
      transition:
        'background .28s ease-in-out .18s, background-position .18s ease-in-out',
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='fill:white;' viewBox='0 0 448 512'%3E%3Cpath d='M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z'/%3E%3C/svg%3E\"), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'%3E%3Cpath d='M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z'/%3E%3C/svg%3E\")",
      backgroundSize: '14px 14px, 14px 14px, 20px 20px, 20px 20px, 20px 20px',
      backgroundPosition: 'left 9px center, right 9px center',
      backgroundRepeat: 'no-repeat',
      color: 'transparent',
      border: 'none',
      backgroundColor: 'white',
      borderRadius: '18px',
      width: '58px',
      height: '24px',
      cursor: 'pointer',
      opacity: '0.66',
    });

    this.setFit('cover');

    // Assign styles
    Object.assign(this.img.style, {
      touchAction: 'none',
      cursor: 'crosshair',
      objectFit: 'contain',
    }); // Prevent Android refresh on pull down

    Object.assign(this.container.style, {
      position: 'relative',
      display: 'flex',
    });

    // Create and attach the retina focal point, start listeners and attach focus
    this.enable(options.focus || this.getFocus());
  }

  public isEnabled(): boolean {
    return this.container.contains(this.retina);
  }

  public enable(focus?: Focus) {
    if (this.isEnabled()) {
      return;
    }

    // Attach the retina focal point
    this.container.appendChild(this.retina);
    this.container.appendChild(this.fitToggle);

    // Bind container events
    this.img.addEventListener('click', this.toggleFit);
    this.img.addEventListener('mousedown', this.startDragging);
    this.img.addEventListener('touchstart', this.startDragging, {
      passive: true,
    });
    this.img.addEventListener('load', this.ensure.bind(this));

    this.setFocus(focus);
  }

  public async ensure() {
    this.updateRetinaPosition();
    if (this.img && this.prevSrc !== this.img.src) {
      this.blurhash = await encodeImageToBlurhash(this.img);
      this.prevSrc = this.img.src;
    }
    this.onChange?.(this.getFocus());
  }

  public disable() {
    if (!this.isEnabled()) {
      return;
    }
    this.container.removeChild(this.retina);
    this.img.removeEventListener('mousedown', this.startDragging);
    this.img.removeEventListener('touchstart', this.startDragging);
    this.img.removeEventListener('load', this.ensure);
    this.stopDragging();
  }

  public getFocus(): Focus {
    return {
      x: parseFloat(this.img.getAttribute('data-focus-x')) || 0,
      y: parseFloat(this.img.getAttribute('data-focus-y')) || 0,
      width: this.img.naturalWidth,
      height: this.img.naturalHeight,
      blurhash: this.blurhash,
      fit:
        (this.img.getAttribute('data-fit') as 'cover' | 'contain') || 'cover',
    };
  }

  public setFocus(focus: Partial<Focus>) {
    focus.x && this.img.setAttribute('data-focus-x', focus.x.toString());
    focus.y && this.img.setAttribute('data-focus-y', focus.y.toString());
    focus.fit && this.img.setAttribute('data-fit', focus.fit);
    this.updateRetinaPosition();
    this.onChange?.(this.getFocus());
  }

  private retinaAnimationFrame: null | number = null;
  private updateRetinaPosition = () => {
    if (!this.retinaAnimationFrame) {
      this.retinaAnimationFrame = window.requestAnimationFrame(() => {
        this.retinaAnimationFrame = null;
        const { width, height } = this.img.getBoundingClientRect();
        const { naturalWidth, naturalHeight } = this.img;
        const realWidth = height * (naturalWidth / naturalHeight);
        const realHeight = width * (naturalHeight / naturalWidth);
        const isWide = naturalWidth / width > naturalHeight / height;
        const focus = this.getFocus();
        const offsetX = isWide
          ? width * (focus.x / 2 + 0.5)
          : width * (focus.x / 2 + 0.5) * (realWidth / width) +
            (width - realWidth) / 2;
        const offsetY = !isWide
          ? height * (focus.y / -2 + 0.5)
          : height * (focus.y / -2 + 0.5) * (realHeight / height) +
            (height - realHeight) / 2;
        this.retina.style.top = `${offsetY}px`;
        this.retina.style.left = `${offsetX}px`;
      });
    }
  };

  private setFit(fit: 'contain' | 'cover') {
    this.setFocus({ fit });
    this.container.style.setProperty('--fit', fit);
    Object.assign(this.fitToggle.style, {
      backgroundImage: `
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='fill:${
          fit === 'contain' ? 'black' : 'white'
        };' viewBox='0 0 448 512'%3E%3Cpath d='M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z'/%3E%3C/svg%3E"), 
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='fill:${
          fit === 'contain' ? 'white' : 'black'
        };' viewBox='0 0 448 512'%3E%3Cpath d='M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z'/%3E%3C/svg%3E"),
        radial-gradient(farthest-side at 50%, black, black 100%, transparent 100%),
        radial-gradient(farthest-side at 50%, black, black 100%, transparent 100%),
        radial-gradient(farthest-side at 50%, black, black 100%, transparent 100%)
      `,
      backgroundPosition: `
        left 8px center, right 8px center, 
        ${fit === 'contain' ? 'right' : 'left'} 2px top 2px, 
        ${fit === 'contain' ? 'right' : 'left'} 5px top 2px, 
        ${fit === 'contain' ? 'right' : 'left'} 8px top 2px
      `,
    });
  }

  protected isDragging: null | { x: number; y: number } = null;
  private toggleFit = () => {
    if (this.isDragging?.x !== 0 || this.isDragging?.y !== 0) {
      return;
    }
    const focus = this.getFocus();
    this.setFit(focus.fit === 'contain' ? 'cover' : 'contain');
  };

  private startDragging = (e: MouseEvent | TouchEvent) => {
    document.body.addEventListener('mousemove', this.handleMove);
    document.body.addEventListener('touchmove', this.handleMove, {
      passive: true,
    } as any);
    document.body.addEventListener('mouseup', this.stopDragging);
    document.body.addEventListener('touchend', this.stopDragging);
    this.handleMove(e);
  };

  private handleMove = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();

    // Calculate FocusPoint coordinates
    const delta = (this.isDragging = this.isDragging || { x: 0, y: 0 });
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
    window.requestAnimationFrame(() => {
      this.isDragging = null;
    });
    document.body.removeEventListener('mousemove', this.handleMove);
    document.body.removeEventListener('touchmove', this.handleMove);
    document.body.removeEventListener('mouseup', this.stopDragging);
    document.body.removeEventListener('touchend', this.stopDragging);
  };
}
