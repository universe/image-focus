import { Focus } from './FocusedImage';
import retina from './retina.svg';

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

export class FocusPicker {
  private container: HTMLElement;
  private img: HTMLImageElement;
  private retina: HTMLImageElement;
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
    this.container = imageNode.parentElement;
    this.onChange = options.onChange || null;

    // Create retina element
    this.retina = document.createElement('img');
    this.retina.src = options.retina || retina;
    this.retina.draggable = false;
    Object.assign(this.retina.style, {
      position: 'absolute',
      transform: 'translate(calc(-50% - 0.5px), calc(-50% + 0.5px))',
      pointerEvents: 'none',
    });

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

    // Bind container events
    this.img.addEventListener('mousedown', this.startDragging);
    this.img.addEventListener('touchstart', this.startDragging, {
      passive: true,
    });
    this.img.addEventListener('load', this.updateRetinaPosition);

    this.setFocus(focus);
  }

  public disable() {
    if (!this.isEnabled()) {
      return;
    }
    this.container.removeChild(this.retina);
    this.img.removeEventListener('mousedown', this.startDragging);
    this.img.removeEventListener('touchstart', this.startDragging);
    this.img.removeEventListener('load', this.updateRetinaPosition);
    this.stopDragging();
  }

  public getFocus(): Focus {
    return {
      x: parseFloat(this.img.getAttribute('data-focus-x')) || 0,
      y: parseFloat(this.img.getAttribute('data-focus-y')) || 0,
    };
  }

  public setFocus(focus: Focus) {
    this.img.setAttribute('data-focus-x', focus.x.toString());
    this.img.setAttribute('data-focus-y', focus.y.toString());
    this.updateRetinaPosition();
    this.onChange?.(focus);
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

    // Set our new focus value.
    this.setFocus({
      x: Math.min(Math.max(x, -1), 1),
      y: Math.min(Math.max(y, -1), 1),
    });
  };

  private stopDragging = () => {
    document.body.removeEventListener('mousemove', this.handleMove);
    document.body.removeEventListener('touchmove', this.handleMove);
    document.body.removeEventListener('mouseup', this.stopDragging);
    document.body.removeEventListener('touchend', this.stopDragging);
  };
}
