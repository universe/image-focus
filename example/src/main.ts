import "./style.css";

import { Focus, FocusChangeEvent,FocusPicker, FocusState } from "../..";

// Get our references to elements
const focusPickerEl = document.getElementById("focus-picker-img") as HTMLImageElement;
const imgSrcEl = document.getElementById("image-src") as HTMLInputElement;
const coordinates = document.getElementById("coordinates") as HTMLInputElement;
const blurhash = document.getElementById("blurhash") as HTMLInputElement;
const objectFit = document.getElementById("fit") as HTMLInputElement;
const dataAttributes = document.getElementById("data-attributes") as HTMLInputElement;
const focusedImageElements = document.querySelectorAll(".focused-image") as NodeListOf<HTMLImageElement>;

// Set our starting focus
function onChange(newFocus: FocusState) {
  newFocus.x = parseFloat(newFocus.x.toFixed(2));
  newFocus.y = parseFloat(newFocus.y.toFixed(2));
  coordinates.value = `{x: ${Math.round(newFocus.x * 100)}, y: ${Math.round(newFocus.y * 100)}, w: ${newFocus.width}, h: ${newFocus.height}}`;
  blurhash.value = newFocus.blurhash || '';
  objectFit.value = newFocus.fit;
  dataAttributes.value = Focus.encode(newFocus);
  for (const img of Array.from(focusedImageElements)) {
    img.setAttribute('data-focus', Focus.encode(newFocus));
    if (img.src !== imgSrcEl.value) { img.src = imgSrcEl.value; }
  }
}

Focus.watch();

if (window.location.search.includes('native')) {
  console.log('Loading Natvie Listener');
  focusPickerEl.addEventListener('focus-change', (evt: FocusChangeEvent) => {
    onChange(evt.detail);
  });
  FocusPicker.watch();
}
else {
  console.log('Loading Manual Listener');
  // Instantiate our FocusPicker providing onChange callback
  new FocusPicker(focusPickerEl, { onChange });
}

// Add event listener for updating image sources
imgSrcEl.addEventListener("input", () => focusPickerEl.src = imgSrcEl.value);
