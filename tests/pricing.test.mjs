import test from "node:test";
import assert from "node:assert/strict";
import {calculatePrice,pricingSize,PRICE_TABLES,HARDWARE,HARDWARE_VARIANTS,hardwareImagePath} from "../app/pricing-config.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const q=(overrides={})=>calculatePrice({thickness:"2.5",width:3,height:3,quantity:100,sides:1,hardwareCode:"A",packaging:"standard",...overrides});
test("2.5mm 3cm x 100",()=>assert.deepEqual([q().unit,q().total],[24,2400]));
test("3mm 3cm x 100",()=>assert.deepEqual([q({thickness:"3"}).unit,q({thickness:"3"}).total],[28,2800]));
test("2.5mm 5cm x 1000",()=>assert.deepEqual([q({width:5,height:5,quantity:1000}).unit,q({width:5,height:5,quantity:1000}).total],[20,20000]));
test("factory double sided",()=>assert.equal(q({width:5,height:5,quantity:1000,sides:2}).unit,23));
test("3mm factory orders require confirmed pricing",()=>assert.equal(q({thickness:"3",width:7,height:7,quantity:1000,sides:2}).manual,true));
test("rounding",()=>assert.equal(pricingSize(3,4.2),5));
test("4000 uses 3000 tier",()=>assert.equal(q({width:5,height:5,quantity:4000}).unit,18));
test("manual estimate",()=>{assert.equal(q({width:11}).manual,true);assert.equal(q({packaging:"custom"}).manual,true)});
test("hardware B follows the supplied catalog at +3 baht",()=>assert.deepEqual([q({hardwareCode:"B"}).hardware,q({hardwareCode:"B"}).unit],[3,27]));
test("hardware catalog covers every code A–Q, separates variants, and has images",()=>{
  assert.deepEqual(HARDWARE.map(item=>item.code),"ABCDEFGHIJKLMNOPQ".split(""));
  assert.deepEqual(HARDWARE.map(item=>item.price),[0,3,8,8,10,8,8,10,5,8,8,10,2,2,5,10,8]);
  for(const item of HARDWARE){
    assert.ok(HARDWARE_VARIANTS[item.code]?.length>0,`missing variants for ${item.code}`);
    assert.ok(existsSync(join(process.cwd(),"public",hardwareImagePath(item.code))),`missing image for ${item.code}`);
  }
  assert.equal(hardwareImagePath("P","ห่วงกลมสีหรือห่วงลาย"),"/assets/hardware-generated-v2/P.png");
  const staff=readFileSync(new URL("../app/StaffOrderBuilder.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(staff,/HARDWARE\.slice\(0,\s*8\)/);
});
test("admin hardware override supports the 99 + 3 + 50 case",()=>{
  const item=q({width:6,height:6,quantity:10,hardwareCode:"B",hardwarePrice:3});
  assert.deepEqual([item.base,item.hardware,item.unit,item.unit+50],[99,3,102,152]);
});
test("new 2.5mm retail table matches supplied price sheet",()=>assert.deepEqual(PRICE_TABLES.retail["2.5"],[
  [79,84,89,94,99,104,109,114,119],[29,34,39,44,49,54,59,64,69],[25,29,33,37,41,45,49,53,57],
  [20,24,28,32,36,40,44,48,52],[17,19,22,25,28,31,34,37,40],[14,16,19,22,25,28,31,34,37]
]));
test("new 2.5mm factory table matches supplied price sheet",()=>assert.deepEqual(PRICE_TABLES.factory["2.5"],[
  [12,14,17,20,23,26,29,32,35],[11,12,15,18,21,24,27,30,33],[10,11,14,17,20,23,26,29,32],
  [8,9,12,15,18,21,24,27,30],[7,8,11,14,17,20,23,26,29],[6.5,7.5,10.5,13.5,16.5,19.5,22.5,25.5,28.5]
]));
test("new print-side surcharges match supplied price sheet",()=>assert.deepEqual(PRICE_TABLES.doublePrint,{retail:[3,3,5,5,5,10,10,20,20],factory:[2,2,3,3,3,5,5,15,15]}));
test("unverified 3mm factory prices are never displayed as numbers",()=>assert.ok(PRICE_TABLES.factory["3"].flat().every(value=>value===null)));
