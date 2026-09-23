import { publicOrderStatus, statusLabels, statusSteps, thaiPhotoTimestamp } from "./order-status";

export type ProgressPhoto = Record<string, string | number>;

export default function ProgressPhotoTimeline({
  photos,
  token,
  orderNumber,
  admin = false,
}: {
  photos: ProgressPhoto[];
  token: string;
  orderNumber: string;
  admin?: boolean;
}) {
  const stageGroups = statusSteps.map((stage, stageIndex) => ({
    stage,
    stageIndex,
    photos: photos.filter((photo) => publicOrderStatus(String(photo.status)) === stage),
  })).filter((group) => group.photos.length > 0);

  return <section className={`progressGalleryCard progressTimelineCard${admin ? " adminProgressTimeline" : ""}`}>
    <header><div><span>PRODUCTION UPDATE</span><h2>ภาพความคืบหน้าแยกตามขั้นตอน</h2><p>รูปใหม่จะเพิ่มต่อจากรูปเดิม ประวัติของขั้นตอนก่อนหน้าจะยังอยู่ครบ</p></div><b>{photos.length} ภาพ</b></header>
    {stageGroups.length ? <div className="progressStageGroups">{stageGroups.map((group) => <section className="progressStageGroup" key={group.stage}>
      <header><i>{group.stageIndex + 1}</i><div><small>ขั้นตอนที่ {group.stageIndex + 1}</small><h3>{statusLabels[group.stage]}</h3></div><b>{group.photos.length} ภาพ</b></header>
      <div className="progressGallery">{group.photos.map((photo, index) => <figure key={String(photo.id)}>
        <a href={`/api/orders/${token}/progress?photo=${photo.id}`} target="_blank" rel="noreferrer" aria-label={`เปิดภาพ ${index + 1} ขั้นตอน${statusLabels[group.stage]}เต็มจอ`}>
          <img src={`/api/orders/${token}/progress?photo=${photo.id}`} alt={`ภาพขั้นตอน${statusLabels[group.stage]} ${index + 1} ของ ${orderNumber}`} loading="lazy" />
          <span className="photoCaptureStamp"><b>ถ่ายโดย {String(photo.created_by_name || "ทีม K2SIGN")}</b><small>{thaiPhotoTimestamp(photo.created_at)}</small></span>
        </a>
        <figcaption><b>{photo.caption || statusLabels[String(photo.status)] || "ภาพความคืบหน้า"}</b><span>{statusLabels[String(photo.status)] || statusLabels[group.stage]}</span><small>{String(photo.created_at)} • {String(photo.created_by_name || "ทีม K2SIGN")}</small></figcaption>
      </figure>)}</div>
    </section>)}</div> : <div className="progressGalleryEmpty"><b>ยังไม่มีรูปความคืบหน้า</b><span>เมื่อทีมงานเพิ่มรูป ระบบจะจัดเรียงตามขั้นตอนให้อัตโนมัติ</span></div>}
  </section>;
}
