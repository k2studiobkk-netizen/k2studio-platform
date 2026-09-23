import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import ts from "typescript";
import * as design from "../app/customer-design.mjs";
const root=new URL("../",import.meta.url),require=createRequire(import.meta.url);
function load(relative,deps){const js=ts.transpileModule(readFileSync(new URL(relative,root),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext(js,{module,exports:module.exports,require:id=>id in deps?deps[id]:require(id),Response,Request,File,FormData,URL,crypto,console,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,Date,Error},{filename:relative});return module.exports}
const pricing=load("app/pricing-config.ts",{});
function fixture(){
 const db=new DatabaseSync(":memory:");db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,public_token TEXT,order_number TEXT,order_status TEXT,production_released_at TEXT); CREATE TABLE work_orders(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT); CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_type TEXT,thickness_mm TEXT); CREATE TABLE order_status_history(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE hardware_prices(hardware_code TEXT,price TEXT); INSERT INTO orders VALUES(1,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','K2-TEST','waiting_for_artwork_review',''); INSERT INTO orders VALUES(2,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','K2-OTHER','waiting_for_artwork_review',''); INSERT INTO work_orders VALUES(1,1,'draft'); INSERT INTO order_items VALUES(10,1,'acrylic_keychain','2.5'); INSERT INTO hardware_prices VALUES('B','7');`);
 const D1={prepare(sql){const args=[];return {bind(...values){args.push(...values);return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}}}};
 const objects=new Map();let failStorage=false;
 const bucket={async put(key,value){if(failStorage)throw Error("storage unavailable");objects.set(key,value)},async delete(keys){for(const key of typeof keys==="string"?[keys]:keys)objects.delete(key)},async get(key){const value=objects.get(key);return value===undefined?null:{body:value,async json(){return JSON.parse(value)}}}};
 const route=load("app/api/orders/[token]/customer-design/route.ts",{"cloudflare:workers":{env:{DB:D1,ORDER_FILES:bucket}},"../../../../pricing-config":pricing,"../../../../customer-design.mjs":design});
 return {db,objects,route,setFail(value){failStorage=value}};
}
const token="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spec={schemaVersion:1,itemId:10,material:"clear_acrylic",thicknessMm:2.5,sizeMm:40,aspect:1,quantity:100,sides:1,hardwareCode:"B",hardwareColor:"เงิน",hole:{x:20,y:-3}};
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=","base64");
function request(overrides={},id=crypto.randomUUID(),orderToken=token){const form=new FormData();form.set("submission_id",id);form.set("confirmed","1");form.set("spec",JSON.stringify({...spec,...overrides}));for(const name of ["original_front","front","preview"])form.set(name,new File([png],`${name}.png`,{type:"image/png"}));return new Request(`https://order.k2group.site/api/orders/${orderToken}/customer-design`,{method:"POST",body:form,headers:{origin:"https://order.k2group.site"}})}
const params=(t=token)=>({params:Promise.resolve({token:t})});
test("submission stores original and proof, uses central prices, leaves production untouched",async()=>{const f=fixture();try{const response=await f.route.POST(request(),params());assert.equal(response.status,201);const saved=[...f.objects].find(([key])=>key.endsWith("manifest.json"));const m=JSON.parse(saved[1]);assert.equal(m.pricing.hardware,7);assert.equal(m.productionReady,false);assert.equal(m.artworkOrientation,"customer_view_unmirrored");assert.equal(m.status,"waiting_for_graphic_review");assert.equal(f.db.prepare("SELECT status FROM work_orders").get().status,"draft");assert.equal(f.db.prepare("SELECT COUNT(*) n FROM order_status_history").get().n,1);assert.equal(m.assets.length,3)}finally{f.db.close()}});
test("retry is idempotent and cannot overwrite approved snapshot",async()=>{const f=fixture(),id=crypto.randomUUID();try{const first=await f.route.POST(request({},id),params());assert.equal(first.status,201);const original=[...f.objects];const second=await f.route.POST(request({quantity:999},id),params());assert.equal(second.status,200);assert.equal((await second.json()).duplicate,true);assert.deepEqual([...f.objects],original);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM order_status_history").get().n,1)}finally{f.db.close()}});
test("a token cannot submit a different order's item",async()=>{const f=fixture();try{const response=await f.route.POST(request({},crypto.randomUUID(),"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),params("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));assert.equal(response.status,400);assert.equal(f.objects.size,0)}finally{f.db.close()}});
test("production and pending graphic approval reject changes",async()=>{for(const status of ["waiting_for_production","in_production","artwork_approval_pending"]){const f=fixture();try{f.db.prepare("UPDATE orders SET order_status=? WHERE id=1").run(status);assert.equal((await f.route.POST(request(),params())).status,409);assert.equal(f.objects.size,0)}finally{f.db.close()}}});
test("double-sided artwork requires back source and processed file",async()=>{const f=fixture();try{assert.equal((await f.route.POST(request({sides:2}),params())).status,400);assert.equal(f.objects.size,0)}finally{f.db.close()}});
test("invalid choices and nonfinite geometry are rejected",()=>{for(const value of [{hardwareCode:"ZZ"},{hardwareColor:"bogus"},{quantity:1.5},{sizeMm:NaN},{hole:{x:999,y:0}}])assert.throws(()=>design.validateDesignSpec({...spec,...value},pricing.HARDWARE,pricing.HARDWARE_VARIANTS))});
test("storage failure cannot record a successful receipt",async()=>{const f=fixture();try{f.setFail(true);assert.equal((await f.route.POST(request(),params())).status,503);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM order_status_history").get().n,0)}finally{f.db.close()}});
test("new revisions preserve old files",async()=>{const f=fixture();try{await f.route.POST(request(),params());const first=[...f.objects];await f.route.POST(request({quantity:200}),params());for(const [k,v] of first)assert.equal(f.objects.get(k),v);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM order_status_history").get().n,2)}finally{f.db.close()}});

// Golden values transcribed from the customer's 2.5 mm retail rate card.
test("all 54 retail cells and both ends of every quantity tier match the supplied rate card",()=>{
 const expected=[[79,84,89,94,99,104,109,114,119],[29,34,39,44,49,54,59,64,69],[25,29,33,37,41,45,49,53,57],[20,24,28,32,36,40,44,48,52],[17,19,22,25,28,31,34,37,40],[14,16,19,22,25,28,31,34,37]];
 const ranges=[[1,10],[11,29],[30,49],[50,199],[200,499],[500,999]],extra=[3,3,5,5,5,10,10,20,20];
 ranges.forEach((range,row)=>range.forEach(quantity=>expected[row].forEach((base,i)=>{
  for(const sides of [1,2]){const result=pricing.calculatePrice({thickness:"2.5",width:i+2,height:i+2,quantity,sides,hardwareCode:"A",packaging:"standard"});assert.equal(result.base,base);assert.equal(result.print,sides===2?extra[i]:0);assert.equal(result.unit,base+(sides===2?extra[i]:0));assert.equal(result.total,result.unit*quantity)}
 })));
});
