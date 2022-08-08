import { start, FocusPicker, Focus } from "../."

start();

// Get our references to elements
const focusPickerEl = document.getElementById("focus-picker-img") as HTMLImageElement
const imgSrcEl = document.getElementById("image-src") as HTMLInputElement
const coordinates = document.getElementById("coordinates") as HTMLInputElement
const blurhash = document.getElementById("blurhash") as HTMLInputElement
const dataAttributes = document.getElementById("data-attributes") as HTMLInputElement
const focusedImageElements = document.querySelectorAll(".focused-image") as NodeListOf<HTMLImageElement>

// Set our starting focus
const focus: Focus = { x: 0.56, y: 0.27, width: 0, height: 0, blurhash: '' };

function onChange(newFocus: Focus) {
  const x = newFocus.x.toFixed(2);
  const y = newFocus.y.toFixed(2);
  coordinates.value = `{x: ${x}, y: ${y}}`;
  blurhash.value = newFocus.blurhash;
  dataAttributes.value = `data-focus-x="${x}" data-focus-y="${y}" data-width="${newFocus.width.toFixed(2)}" data-height="${newFocus.height.toFixed(2)}" data-blurhash="${newFocus.blurhash}"`;
  for (const img of Array.from(focusedImageElements)) {
    img.setAttribute('data-focus-x', x.toString());
    img.setAttribute('data-focus-y', y.toString());
    img.setAttribute('data-width', newFocus.width.toString());
    img.setAttribute('data-height', newFocus.height.toString());
    if (img.src !== imgSrcEl.value) {
      img.src = imgSrcEl.value;
      img.setAttribute('data-blurhash', newFocus.blurhash);
    }
  }
}

// Instantiate our FocusPicker providing starting focus
// and onChange callback
const focusPicker = new FocusPicker(focusPickerEl, {
  focus,
  onChange,
});

// Add event listener for updating image sources
imgSrcEl.addEventListener("input", () => {
  focusPicker.img.src = imgSrcEl.value
  if (focusPicker.img.complete) onChange(focusPicker.getFocus());
});
