import { start } from '../src/FocusedImage';

jest.useFakeTimers();

describe('FocusedImage', () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = jest.fn(() => {
      return {
        width: 120,
        height: 120,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      };
    }) as any;

    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
      get: () => 220,
    });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
      get: () => 300,
    });

    document.body.innerHTML = `
    <body>
      <div class="focused-image-container top-left">
        <img class="focused-image" src="https://picsum.photos/2400/1400" alt="" data-focus-x="0.28" data-focus-y="0.33">
      </div>
    </body>
    `;
  });

  it('should be able to update focus through attrs', () => {
    const img = document.querySelector('.focused-image') as HTMLImageElement;
    start();
    img.setAttribute('data-focus-x', '0.25');
    img.setAttribute('data-focus-y', '0.3');
    expect(img.getAttribute('data-focus-x')).toBe('0.25');
    expect(img.getAttribute('data-focus-y')).toBe('0.3');
    expect(img.getAttribute('style')).toBe('0.3');
  });
});
