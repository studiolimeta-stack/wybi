'use client';

import { useState } from 'react';
import { toThumbUrl } from '../lib/images.js';

/** A compact, respondent-friendly gallery for the product visuals in a test. */
export function ProductImageGallery({ images, presentations = [] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex] || images[0];
  const selectedPresentation = presentations[selectedIndex];

  return (
    <div>
      {/* Fixed 4:3 frame — matches typical product photography, so most images
        * fill it edge-to-edge. object-contain means nothing is ever cropped:
        * an off-ratio photo just letterboxes on the brand-tint background
        * instead of losing content (a cropped product logo is worse than a
        * padded frame). */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-ink bg-[#f4f1ff]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={selectedImage}
          alt=""
          className="h-full w-full object-contain transition-transform duration-200"
          style={selectedPresentation}
        />
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2" aria-label="Product images">
          {images.map((image, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-white sm:h-14 sm:w-14 ${
                  isSelected ? 'border-ink' : 'border-line'
                }`}
                aria-label={`View product image ${index + 1} of ${images.length}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(index)}
              >
                {/* Thumbnails are purely a selector — the full, uncropped photo is
                  * always one click away in the main frame above, so a small
                  * square crop here is low-stakes and keeps the row uniform. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toThumbUrl(image)}
                  alt=""
                  className="h-full w-full object-cover"
                  style={presentations[index]}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
