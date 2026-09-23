"use client";

import { useEffect, useState } from "react";

const portfolioItems = [
  ["1SOxD8Mu7VHXjFC1oaZN75D6C_1KUWy8N", "K2SIGN-POST-308"],
  ["1VTPNgYzFJ9LO8gH8JzxdWw07XL7QwJXt", "K2SIGN-POST-307"],
  ["1FljoPf529sQtx6lq8hpY2-HPjhg9N6wG", "K2SIGN-POST-306"],
  ["1bxL-HlG66lJnkvw92wD4oTd1xRxJk4g4", "K2SIGN-POST-305"],
  ["1d4S-XszBMumvwUjkoBKR5U_W4DmjsAbI", "K2SIGN-POST-304"],
  ["1uiOAfgkiqpYDcBPwKWVrM9UVzn0WUcUo", "K2SIGN-POST-303"],
  ["1N0pGGwUcc6eYMowQlPySDaxDaYuHCqEl", "K2SIGN-POST-302"],
  ["1E9htZXIwDuUjTULJLJp3cOz4au61Dc3K", "K2SIGN-POST-301"],
  ["1iA8N_xMEkCxCs2n54sWDw8ZHRXM5wVLh", "K2SIGN-POST-300"],
  ["1Vp0eqOg2zcMjVLGWa6xwjSh2L6pJghEK", "K2SIGN-POST-299"],
  ["1AyfB6o0ZKSiadMICFvffaIeHVOIZ3zZb", "K2SIGN-POST-298"],
  ["1m03wrgbwPAtkpo82FT95Fkl4wUj_8n6n", "K2SIGN-POST-297"],
  ["1wlLnn7Sao8rzZzpqCD1ts0g9jgEULOTa", "K2SIGN-POST-296"],
  ["1aldXRip2edt7CJk8xt4NkkLYwZ2afjZ4", "K2SIGN-POST-295"],
  ["1RQRr8Ai-eaHzYosaPX_KMXJBHsGFhng4", "K2SIGN-POST-294"],
  ["1WMNJ40ebS3fQfbsEpG_Ea-WB-nFcf2ps", "K2SIGN-POST-293"],
  ["10WYKfawlf13MM29fcKWqFaEfAkmPseTW", "K2SIGN-POST-292"],
  ["1Do1w1d1A6Iu_mhBPBkgKqsttZqY7TUYZ", "K2SIGN-POST-291"],
  ["1OmCcTRYt0knwwOkEveg1Z2R6XTOqbdME", "K2SIGN-POST-290"],
  ["1J0vGPdqh6z99DUGz_o0EcJXw4RBqmjiu", "K2SIGN-POST-289"],
  ["1pIuP4AiJ5Vno6MPWWfRf37Fwy7IUp2Zl", "K2SIGN-POST-288"],
  ["1sYbhAQAQZHevV7QZd48MezAXQFWO0FCM", "K2SIGN-POST-287"],
  ["1X0f2k9InHk7FLAmlntt5j8X7cd8p5c5o", "K2SIGN-POST-286"],
  ["1OOcQzpSH6rWaT5Bem0vm2778WRY51mpJ", "K2SIGN-POST-285"],
  ["1bQAnMP-28WnCSJ7BTxYioyJmFTwdwTxb", "K2SIGN-POST-284"],
  ["1bfCd7v2FEX_OumNuHmNHQRzboBbRv_Uj", "K2SIGN-POST-283"],
  ["19LP0YjytfRjGvNeurV3Xoy0riFpfl9LO", "K2SIGN-POST-282"],
  ["1apchncA2KxBosdtmmYyZZxkxgnLJ3yYb", "K2SIGN-POST-281"],
  ["1DsikcV01aaNIVayQKuQOZCdKJdjBL6S1", "K2SIGN-POST-280"],
  ["112fWukhrcn1jQBQ7pqyaPSGLap8y-RC7", "K2SIGN-POST-279"],
] as const;

const thumbnailUrl = (id: string, width = 900) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;

export default function PortfolioGallery() {
  const [visibleCount, setVisibleCount] = useState(15);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("portfolioLightboxOpen");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("portfolioLightboxOpen");
    };
  }, [activeIndex]);

  const activeItem = activeIndex === null ? null : portfolioItems[activeIndex];
  const move = (step: number) => {
    setActiveIndex((current) => {
      if (current === null) return null;
      return (current + step + portfolioItems.length) % portfolioItems.length;
    });
  };

  return (
    <section className="studioPortfolio" id="portfolio" aria-labelledby="portfolio-title">
      <header className="portfolioHead">
        <div>
          <span>REAL WORK · K2SIGN</span>
          <h2 id="portfolio-title">ผลงานจริง<br />จากลูกค้าของเรา</h2>
        </div>
        <p>รวมตัวอย่างงานพวงกุญแจหลากหลายแบบจากโฟลเดอร์ผลงาน K2SIGN</p>
      </header>

      <div className="portfolioInstagramGrid">
        {portfolioItems.slice(0, visibleCount).map(([id, title], index) => (
          <button
            type="button"
            className="portfolioTile"
            key={id}
            onClick={() => setActiveIndex(index)}
            aria-label={`เปิดดูผลงาน ${index + 1}`}
          >
            <img
              src={thumbnailUrl(id)}
              alt={`ตัวอย่างผลงานพวงกุญแจ K2SIGN ลำดับที่ ${index + 1}`}
              loading={index < 6 ? "eager" : "lazy"}
              decoding="async"
            />
            <span aria-hidden="true">ดูภาพ</span>
            <small>{title}</small>
          </button>
        ))}
      </div>

      <div className="portfolioActions">
        {visibleCount < portfolioItems.length ? (
          <button type="button" onClick={() => setVisibleCount(portfolioItems.length)}>
            ดูผลงานเพิ่มเติม ({portfolioItems.length - visibleCount})
          </button>
        ) : (
          <a href="https://drive.google.com/drive/folders/1kCCFqH3aqERy1bMNTQNuKw167dDst7AN" target="_blank" rel="noreferrer">
            เปิดโฟลเดอร์ผลงานทั้งหมด
          </a>
        )}
      </div>

      {activeItem && activeIndex !== null && (
        <div className="portfolioLightbox" role="dialog" aria-modal="true" aria-label={`ผลงาน ${activeIndex + 1}`} onClick={() => setActiveIndex(null)}>
          <button className="portfolioClose" type="button" onClick={() => setActiveIndex(null)} aria-label="ปิดภาพ">×</button>
          <button className="portfolioPrevious" type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label="ภาพก่อนหน้า">‹</button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={thumbnailUrl(activeItem[0], 1600)} alt={`ผลงานพวงกุญแจ K2SIGN ลำดับที่ ${activeIndex + 1}`} />
            <figcaption><b>K2SIGN WORK #{activeIndex + 1}</b><span>{activeItem[1]}</span></figcaption>
          </figure>
          <button className="portfolioNext" type="button" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label="ภาพถัดไป">›</button>
        </div>
      )}
    </section>
  );
}
