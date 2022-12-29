import { start, FocusPicker, Focus, encodeFocus } from "../."

// Get our references to elements
const focusPickerEl = document.getElementById("focus-picker-img") as HTMLImageElement
const imgSrcEl = document.getElementById("image-src") as HTMLInputElement
const coordinates = document.getElementById("coordinates") as HTMLInputElement
const blurhash = document.getElementById("blurhash") as HTMLInputElement
const objectFit = document.getElementById("fit") as HTMLInputElement
const dataAttributes = document.getElementById("data-attributes") as HTMLInputElement
const focusedImageElements = document.querySelectorAll(".focused-image") as NodeListOf<HTMLImageElement>

// Set our starting focus
const focus: Focus = { x: 0.56, y: 0.27, width: 2400, height: 1400, blurhash: 'L:Lg-B%2Rjay?wkBf6j[XUM{oLf6', fit: 'cover' };
for (const img of Array.from(document.querySelectorAll('.focused-image'))) {
  img.setAttribute('data-focus', (JSON.stringify(focus)));
}

function onChange(newFocus: Focus) {
  newFocus.x = parseFloat(newFocus.x.toFixed(2));
  newFocus.y = parseFloat(newFocus.y.toFixed(2));
  coordinates.value = `{x: ${Math.round(newFocus.x * 100)}, y: ${Math.round(newFocus.y * 100)}, w: ${newFocus.width}, h: ${newFocus.height}}`;
  blurhash.value = newFocus.blurhash || '';
  objectFit.value = newFocus.fit;
  dataAttributes.value = encodeFocus(newFocus);
  for (const img of Array.from(focusedImageElements)) {
    img.setAttribute('data-focus', encodeFocus(newFocus));
    if (img.src !== imgSrcEl.value) { img.src = imgSrcEl.value; }
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

start();
