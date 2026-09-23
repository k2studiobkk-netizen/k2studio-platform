"use client";

import { useMemo, useState } from "react";

export type InsightPeriod = "today" | "month" | "previous_month";
export type ProductSalesRow = { period:InsightPeriod; category:string; quantity:number; sales:number };
export type PerformanceRow = { period:InsightPeriod; kind:"salesperson"|"channel"; salesOwnerId:number; label:string; sales:number; received:number; outstanding:number; orders:number; commissionRate?:number; commission?:number; commissionTier?:string };
export type CustomerInsightRow = { name:string; identifier:string; salesOwner:string; channel:string; orders:number; sales:number; received:number; outstanding:number; lastOrder:string };

const periods = [{key:"today",label:"วันนี้"},{key:"month",label:"เดือนนี้"},{key:"previous_month",label:"เดือนก่อน"}] as const;
const channelLabels:Record<string,string>={facebook_k2sign:"Facebook K2SIGN",facebook_sweetdesign:"Facebook Sweetdesign",line_k2sign:"LINE K2SIGN",line_k2studio:"LINE K2STUDIO",line:"LINE (ข้อมูลเดิม)",other:"อื่น ๆ",unassigned:"ยังไม่ระบุช่องทาง"};
const number=(value:number)=>value.toLocaleString("th-TH",{maximumFractionDigits:0});

export default function ProductSalesInsights({rows,performanceRows,customerRows}:{rows:ProductSalesRow[];performanceRows:PerformanceRow[];customerRows:CustomerInsightRow[]}){
 const[view,setView]=useState<"product"|"salesperson"|"channel"|"customer"|null>(null);
 const[period,setPeriod]=useState<InsightPeriod>("month");
 const productRows=useMemo(()=>rows.filter(row=>row.period===period).sort((a,b)=>b.sales-a.sales),[period,rows]);
 const rankedRows=useMemo(()=>performanceRows.filter(row=>row.period===period&&row.kind===view).sort((a,b)=>b.sales-a.sales),[period,performanceRows,view]);
 const monthSales=rows.filter(row=>row.period==="month").reduce((sum,row)=>sum+row.sales,0);
 const previousMonthSales=rows.filter(row=>row.period==="previous_month").reduce((sum,row)=>sum+row.sales,0);
 const monthChange=previousMonthSales>0?((monthSales-previousMonthSales)/previousMonthSales)*100:null;
 const buttons=[{key:"salesperson",label:"อันดับเซลล์",icon:"★"},{key:"product",label:"สินค้าขายดี",icon:"↗"},{key:"channel",label:"ช่องทางขาย",icon:"◉"},{key:"customer",label:"วิเคราะห์ลูกค้า",icon:"◎"}] as const;
 const titles={salesperson:["SALES RANKING","อันดับยอดขายเซลล์"],product:["PRODUCT MIX","สัดส่วนสินค้าขายดี"],channel:["SALES CHANNEL","ยอดขายแยกตามช่องทาง"],customer:["CUSTOMER INSIGHTS","วิเคราะห์ลูกค้า"]} as const;
 const title=view?titles[view]:null;
 const toggle=(key:NonNullable<typeof view>)=>setView(current=>current===key?null:key);

 return <section className={`productSalesInsights ${view?"open":""}`}>
  <div className="businessInsightToggles" aria-label="เมนูวิเคราะห์ยอดขาย">{buttons.map(button=><button key={button.key} className="productInsightsToggle" type="button" onClick={()=>toggle(button.key)} aria-expanded={view===button.key} aria-controls="business-insight-panel"><span aria-hidden="true">{button.icon}</span><b>{button.label}</b><i aria-hidden="true">{view===button.key?"−":"+"}</i></button>)}</div>
  {view&&title&&<div id="business-insight-panel" className="productInsightsPanel">
   <header><div><span>{title[0]}</span><h2>{title[1]}</h2><p>{view==="customer"?"รวมประวัติการซื้อและยอดค้างของลูกค้า":"ยอดขายตามวันที่สร้างใบงาน • ไม่รวมงานยกเลิก"}</p></div>{view!=="customer"&&<div className="productPeriodTabs" role="tablist" aria-label="ช่วงเวลายอดขาย">{periods.map(item=><button key={item.key} type="button" role="tab" aria-selected={period===item.key} onClick={()=>setPeriod(item.key)}>{item.label}</button>)}</div>}</header>
   {view==="product"&&period==="month"&&monthChange!==null&&<p className={`productMonthChange ${monthChange>=0?"positive":"negative"}`}><b>{monthChange>=0?"+":""}{monthChange.toFixed(1)}%</b> เทียบยอดขายเดือนก่อน</p>}
   {view==="product"&&<ProductRows rows={productRows}/>}
   {(view==="salesperson"||view==="channel")&&<PerformanceRows rows={rankedRows} channel={view==="channel"}/>}
   {view==="customer"&&<CustomerRows rows={customerRows}/>}
  </div>}
 </section>;
}

function ProductRows({rows}:{rows:ProductSalesRow[]}){
 const totalSales=rows.reduce((sum,row)=>sum+row.sales,0),totalQuantity=rows.reduce((sum,row)=>sum+row.quantity,0);
 if(!rows.length)return <Empty/>;
 return <div className="productMixRows">{rows.map((row,index)=>{const salesPercent=totalSales?row.sales/totalSales*100:0,quantityPercent=totalQuantity?row.quantity/totalQuantity*100:0;return <article key={row.category}><div className="productMixHeading"><span>{index+1}</span><b>{row.category}</b><strong>฿{number(row.sales)}</strong></div><div className="productMixBar"><i style={{width:`${Math.max(salesPercent,2)}%`}}/></div><div className="productMixMeta"><span>ยอดขาย <b>{salesPercent.toFixed(1)}%</b></span><span>จำนวน {number(row.quantity)} ชิ้น <b>{quantityPercent.toFixed(1)}%</b></span></div></article>})}</div>;
}

function PerformanceRows({rows,channel}:{rows:PerformanceRow[];channel:boolean}){
 const total=rows.reduce((sum,row)=>sum+row.sales,0);
 if(!rows.length)return <Empty/>;
 return <div className="productMixRows performanceRows">{rows.map((row,index)=>{const percent=total?row.sales/total*100:0;return <article key={`${row.label}-${row.salesOwnerId}`}><div className="productMixHeading"><span>{index+1}</span><b>{channel?(channelLabels[row.label]||row.label):row.label}</b><strong>฿{number(row.sales)}</strong></div><div className="productMixBar"><i style={{width:`${Math.max(percent,2)}%`}}/></div><div className="productMixMeta"><span>สัดส่วน <b>{percent.toFixed(1)}%</b> • {number(row.orders)} งาน</span><span>รับแล้ว ฿{number(row.received)} • ค้าง <b>฿{number(row.outstanding)}</b></span></div>{!channel&&<div className="commissionEstimate"><span>คอมมิชชั่นประมาณการ</span>{row.commissionRate?<b>฿{number(row.commission||0)} <small>{row.commissionTier} • {row.commissionRate}%</small></b>:<a href="/admin/sales-settings">ยังไม่ตั้งเรต</a>}</div>}</article>})}</div>;
}

function CustomerRows({rows}:{rows:CustomerInsightRow[]}){
 if(!rows.length)return <Empty/>;
 return <div className="customerInsightGrid">{rows.map((row,index)=><article key={`${row.identifier}-${index}`}><header><span>{row.orders>1?"ซื้อซ้ำ":"ลูกค้าใหม่"}</span><b>{row.name}</b><strong>฿{number(row.sales)}</strong></header><p>{row.identifier} • เซลล์ {row.salesOwner||"ยังไม่ระบุ"}</p><div><span>{row.orders} ใบงาน</span><span>{channelLabels[row.channel]||row.channel}</span><span>ล่าสุด {row.lastOrder}</span></div>{row.outstanding>0&&<small>ค้างชำระ ฿{number(row.outstanding)}</small>}</article>)}</div>;
}

function Empty(){return <div className="productMixEmpty"><b>ยังไม่มีข้อมูลในช่วงนี้</b><span>เมื่อสร้างใบงาน ระบบจะสรุปให้อัตโนมัติ</span></div>}
