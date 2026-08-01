"use client";

import { useEffect, useState } from "react";

/** Minimal image loader hook (avoids pulling in the `use-image` package
 * for a single call site). Returns null until the image has loaded. */
export function useImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = src;
    return () => {
      img.onload = null;
      setImage((current) => (current === img ? null : current));
    };
  }, [src]);

  return image;
}
