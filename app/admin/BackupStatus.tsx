"use client";
import { useEffect, useState } from "react";

type BackupRun = { backup_date:string;status:string;order_count:number;file_count:number;google_drive_url:string;google_sheet_url:string;error_message:string;completed_at:string };

export default function BackupStatus({ initial, canRun }: { initial: BackupRun | null; canRun: boolean }) {
  const [run,setRun]=useState(initial);const [working,setWorking]=useState(false);const [message,setMessage]=useState("");
  useEffect(()=>{if(!working)return;const timer=setInterval(async()=>{const response=await fetch("/api/admin/backups",{cache:"no-store"});if(!response.ok)return;const data=await response.json() as {latest:BackupRun|null};setRun(data.latest);if(data.latest&&data.latest.status!=="running"){setWorking(false);setMessage(data.latest.status==="success"?"สำรองข้อมูลสำเร็จ":"สำรองข้อมูลไม่ครบ กรุณาดูรายละเอียด")}},2500);return()=>clearInterval(timer)},[working]);
  async function start(){setWorking(true);setMessage("");const response=await fetch("/api/admin/backups",{method:"POST"});const data=await response.json() as {error?:string};if(!response.ok){setWorking(false);setMessage(data.error||"เริ่มสำรองไม่สำเร็จ")}}
  const label=run?({success:"สำเร็จ",partial:"สำเร็จเฉพาะ Cloudflare",failed:"ไม่สำเร็จ",running:"กำลังสำรอง"} as Record<string,string>)[run.status]||run.status:"ยังไม่มีประวัติ";
  return <section className="adminBackup" id="backups"><div><span>DAILY BACKUP</span><h2>ระบบสำรองข้อมูล</h2><p>Cloudflare R2 + Google Drive + Google Sheet รายเดือน + PDF ใบงาน</p></div><div className="adminBackupState"><b className={`backup-${run?.status||"none"}`}>{label}</b>{run&&<small>{run.backup_date} • {run.order_count} ใบงาน • {run.file_count} ไฟล์</small>}{run?.error_message&&<em>{run.error_message}</em>}<nav>{run?.google_sheet_url&&<a href={run.google_sheet_url} target="_blank" rel="noreferrer">เปิด Sheet</a>}{run?.google_drive_url&&<a href={run.google_drive_url} target="_blank" rel="noreferrer">เปิด Drive</a>}{canRun&&<button type="button" onClick={start} disabled={working}>{working?"กำลังสำรอง…":"สำรองตอนนี้"}</button>}</nav>{message&&<small>{message}</small>}</div></section>
}
