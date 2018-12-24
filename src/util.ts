export type ImageMetaDataTags = {
  Orientation?: string;
  PixelPerUnitX?: number;
  PixelPerUnitY?: number;
  [key: string]: string | number | undefined;
};

export type ImageMetaData = {
  type: string;
  width: number;
  height: number;
  tags: ImageMetaDataTags | null;
};

export type ImageInfo = {
  scaleFactor: number;
  width: number;
  height: number;
};

export enum ImageType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
}

export enum SupportedImageMetaTag {
  XResolution = 'XResolution',
  YResolution = 'YResolution',
  Orientation = 'Orientation',
}

export type FileInfo = {
  file: File;
  src: string;
};

// http://sylvana.net/jpegcrop/exif_orientation.html
export const ExifOrientation: { [key: string]: number } = {
  'top-left': 1, // none
  'top-right': 2, // flip horizontal
  'bottom-right': 3, // rotate 180
  'bottom-left': 4, // flip vertical
  'left-top': 5, // transpose
  'right-top': 6, // rotate 90
  'right-bottom': 7, // transverse
  'left-bottom': 8, // rotate 270
};

const ORIENT_TRANSFORMS: { [key: number]: string } = {
  1: 'none', // Horizontal (normal)
  2: 'rotateY(180deg)', // Mirror horizontal
  3: 'rotate(180deg)', // Rotate 180
  4: 'rotate(180deg) rotateY(180deg)', // Mirror vertical
  5: 'rotate(270deg) rotateY(180deg)', // Mirror horizontal and rotate 270 CW
  6: 'rotate(90deg)', // Rotate 90 CW
  7: 'rotate(90deg) rotateY(180deg)', // Mirror horizontal and rotate 90 CW
  8: 'rotate(270deg)', // Rotate 270 CW
};

export type PNGMetaData = {
  iTXt: string; // the XML metadata, needs to be parsed by ./parsePNGXMP.ts
  pHYs: { PixelPerUnitX?: number; PixelPerUnitY?: number }; // DPI info (if present)
};

export type PNGChunk = {
  name: string;
  data: Uint8Array;
};

const { Orientation, XResolution, YResolution } = SupportedImageMetaTag;
let pngChunksExtract: any;
let loadImage: any;

function fileToArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const array = new Uint8Array(reader.result as ArrayBuffer);
      resolve(array);
    });
    reader.addEventListener('error', reject);
    reader.readAsArrayBuffer(file);
  });
}

function readJPEGExifMetaData(file: File): Promise<ImageMetaDataTags> {
  return new Promise(async (resolve, reject) => {
    if (!loadImage) {
      const module = await import('blueimp-load-image');
      loadImage = module.default || module;
    }

    loadImage.parseMetaData(file, (data: any) => {
      try {
        const tags: ImageMetaDataTags =
          data && data.exif ? data.exif.getAll() : {};
        Object.keys(tags).forEach(key => {
          const value = tags[key];
          if (
            typeof value === 'object' &&
            (key === XResolution || key === YResolution) &&
            'numerator' in value
          ) {
            // some test images had this structure, so just take the numerator value to simplify returned value
            tags[key] = (value as any).numerator;
          }
          if (typeof tags[key] === 'number') {
            // in case numbers types were auto-converted, keep everything the same between jpeg & png we keep as strings
            tags[key] = `${tags[key]}`;
          }
        });
        resolve(tags);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function readPNGXMPMetaData(file: File): Promise<PNGMetaData> {
  if (!pngChunksExtract) {
    const module = await import('png-chunks-extract');
    pngChunksExtract = module.default || module;
  }

  const buffer = await fileToArrayBuffer(file);
  const chunks = pngChunksExtract(buffer);

  return await parsePNGChunks(chunks);
}

async function parsePNGChunks(chunks: PNGChunk[]): Promise<PNGMetaData> {
  let iTXt = '';
  let pHYs = {};
  /**
   * http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.Summary-of-standard-chunks
   * Order of every chunk is not guaranteed.
   * And both iTXt and pHYs are Ancillary chunks.
   */
  for (let i = 0; i < chunks.length; ++i) {
    const chunk = chunks[i];

    // Must be last
    if (chunk.name === 'IEND') {
      break;
    }

    /**
     * http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.Anc-text
     * iTXt contains the useful XMP/XML string data of meta tags
     */
    if (chunk.name === 'iTXt') {
      iTXt = String.fromCharCode.apply(null, chunk.data);
    }
    /**
     * http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.pHYs
     * Pixels per unit, X axis: 4 bytes (unsigned integer)
     * Pixels per unit, Y axis: 4 bytes (unsigned integer)
     * Unit specifier:          1 byte  (0: unit is unknown 1: unit is the meter)
     */
    if (chunk.name === 'pHYs') {
      const dv = new DataView(chunk.data.buffer);
      const unitSpecifier = dv.getUint8(8);
      // meter
      if (unitSpecifier === 1) {
        const PixelPerUnitX = dv.getUint32(0);
        const PixelPerUnitY = dv.getUint32(4);
        pHYs = { PixelPerUnitX, PixelPerUnitY };
      }
    }
  }

  return { iTXt, pHYs };
}


function parseXMPMetaData(xmpMetaData: string): ImageMetaDataTags {
  const metadata: ImageMetaDataTags = {};
  const tags = xmpMetaData.match(/<(tiff|exif):.+>/gi);
  if (tags) {
    tags.forEach((tag: string) => {
      const match = tag.match(/<(tiff|exif):([^>]+)>([^<]+)/i);
      if (match) {
        const name = match[2];
        metadata[name] = match[3];
      }
    });
  }
  return metadata;
}


async function readImageMetaTags(
  file: File,
): Promise<ImageMetaDataTags | null> {
  const type = file.type;
  try {
    if (type === ImageType.PNG) {
      // http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.Summary-of-standard-chunks
      // iTXt = XML text with metadata
      // pHYs = Physical pixel dimensions
      const { iTXt, pHYs } = await readPNGXMPMetaData(file);
      const xmpMetaData = { ...parseXMPMetaData(iTXt), ...pHYs };
      return xmpMetaData;
    } else if (file.type === ImageType.JPEG) {
      return await readJPEGExifMetaData(file);
    }
  } catch (e) {
    // problem parsing metadata
  }
  return null;
}

export const getCssFromImageOrientation = (orientation: number): string => {
  return ORIENT_TRANSFORMS[orientation];
};

export async function getOrientation(file: File): Promise<number> {
  const tags = await readImageMetaTags(file);
  if (tags && tags[Orientation]) {
    const tagValue = tags[Orientation];
    if (tagValue) {
      const numericValue = parseInt(tagValue, 10);
      if (isNaN(numericValue)) {
        return ExifOrientation[tagValue];
      }
      return numericValue;
    }
  }
  
  return 1;
}