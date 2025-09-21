const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 100;

export function createCanvas(width: number, height: number) {
  const data = new Uint8ClampedArray(Math.max(1, width) * Math.max(1, height) * 4);
  return {
    width,
    height,
    getContext: (_type: string) => {
      return {
        antialias: 'default',
        font: '',
        fillStyle: '',
        textBaseline: 'top' as const,
        textAlign: 'left' as const,
        measureText: (text: string) => {
          const safeWidth = Math.max(1, text.length * 8);
          return {
            width: safeWidth,
            actualBoundingBoxAscent: 8,
            actualBoundingBoxDescent: 2,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: safeWidth,
          };
        },
        fillText: () => {
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
          }
        },
        getImageData: () => ({ width: Math.max(1, width) || DEFAULT_WIDTH, height: Math.max(1, height) || DEFAULT_HEIGHT, data }),
      };
    },
  };
}

export function registerFont() {
  // noop in tests
}
