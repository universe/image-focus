import { start, FocusPicker, Focus } from "../."

start();

// Get our references to elements
const focusPickerEl = document.getElementById("focus-picker-img") as HTMLImageElement
const imgSrcEl = document.getElementById("image-src") as HTMLInputElement
const coordinates = document.getElementById("coordinates") as HTMLInputElement
const dataAttributes = document.getElementById("data-attributes") as HTMLInputElement
const focusedImageElements = document.querySelectorAll(".focused-image") as NodeListOf<HTMLImageElement>

// Set our starting focus
const focus: Focus = { x: 0.5, y: 0 };

// Instantiate our FocusPicker providing starting focus
// and onChange callback
const focusPicker = new FocusPicker(focusPickerEl, {
  focus,
  onChange: (newFocus: Focus) => {
    const x = newFocus.x.toFixed(2);
    const y = newFocus.y.toFixed(2);
    coordinates.value = `{x: ${x}, y: ${y}}`;
    dataAttributes.value = `data-focus-x="${x}" data-focus-y="${y}"`;
    for (const img of Array.from(focusedImageElements)) {
      img.setAttribute('data-focus-x', x.toString());
      img.setAttribute('data-focus-y', y.toString());
    }
  },
});

// Add event listener for updating image sources
imgSrcEl.addEventListener("input", () => {
  focusPicker.img.src = imgSrcEl.value
  focusedImageElements.forEach(img => (img.src = imgSrcEl.value))
});
