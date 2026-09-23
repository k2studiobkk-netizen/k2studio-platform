"use client";

import { useEffect, useState } from "react";

export default function QrCodeImage({
  value,
  alt,
  className,
  width = 320,
}: {
  value: string;
  alt: string;
  className?: string;
  width?: number;
}) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(value, {
        width,
        margin: 4,
        errorCorrectionLevel: "H",
        color: { dark: "#000000", light: "#ffffff" },
      }))
      .then((result) => {
        if (active) setSource(result);
      })
      .catch(() => {
        if (active) setSource("");
      });
    return () => { active = false; };
  }, [value, width]);

  return source
    ? <img className={className} src={source} alt={alt} data-k2-qr="ready" />
    : <span className={className} role="img" aria-label={`${alt} กำลังสร้าง`} data-k2-qr="loading" />;
}
