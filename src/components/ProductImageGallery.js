'use client';

import { useState } from 'react';

/** A compact, respondent-friendly gallery for the product visuals in a test. */
export function ProductImageGallery({ images, presentations = [] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex] || images[0];
  const selectedPresentation = presentations[selectedIndex];

  return (
    <div>
      <div className="aspect-[4/3] w-full rounded-xl border-2 border-ink bg-white">
        {/* Uploads are normalised on the server, so this avoids another image-processing pass. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={selectedImage}
          alt=""
          className="h-full w-full object-contain transition-transform duration-200"
          style={selectedPresentation}
        />
      </div>

      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2" aria-label="Product images">
          {images.map((image, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`aspect-square overflow-hidden rounded-lg border-2 bg-white ${
                  isSelected ? 'border-ink' : 'border-line'
                }`}
                aria-label={`View product image ${index + 1} of ${images.length}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt=""
                  className="h-full w-full object-contain"
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
