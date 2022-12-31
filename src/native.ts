import { Focus } from "./FocusedImage.js";
import { FocusPicker } from "./FocusPicker.js";

const IMAGES = document.getElementsByTagName('img');
export type FocusChangeEvent = CustomEvent<Focus>;

export function run() {
  debugger;
  for (let i = 0; i < IMAGES.length; i++) {
    const img = IMAGES[i];
    if (!img.hasAttribute('data-focus-editable')) { continue; }
    let focusPicker: FocusPicker = (img as any).__FOCUS_PICKER__;
    if (focusPicker) {
      focusPicker.updateRetinaPosition();
      continue;
    }
    focusPicker = new FocusPicker(img, {
      onChange: (focus) => {
        img.dispatchEvent(new CustomEvent<Focus>('focus-change', { detail: focus }));
      }
    });
  }
  window.requestAnimationFrame(run);
}

run();