import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as kit from "../app/sales-kit.mjs";

function load(path, deps) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText;
  runInNewContext(source,{exports,require(name){if(!(name in deps))throw Error(name);return deps[name];},Request,Response,URL,crypto,Uint8Array,TextDecoder,console:{error(){}}});
  return exports;
}
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE staff_users(id INTEGER PRIMARY KEY,active INTEGER DEFAULT 1); INSERT INTO staff_users(id) VALUES(1),(2);");
  db.exec(readFileSync(new URL("../drizzle/0038_sales_enablement.sql",import.meta.url),"utf8"));
  const env = {
    PUBLIC_SITE_URL: "https://order.k2group.site",
    DB: { prepare(sql) {
      return { bind(...p) {
        return { async first() { return db.prepare(sql).get(...p) || null; } };
      } };
    } },
  };
  const auth={user:{id:1},allowed:true};
  const post=load("../app/api/admin/sales/links/route.ts",{"cloudflare:workers":{env},"../../../../staff-auth":{getStaffUser:async()=>auth.user,can:()=>auth.allowed},"../../../../sales-kit.mjs":kit}).POST;
  const get=load("../app/s/[token]/route.ts",{"cloudflare:workers":{env},"../../sales-kit.mjs":kit}).GET;
  const request=(body={},headers={})=>new Request("http://localhost:3000/api/admin/sales/links",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json",...headers},body:JSON.stringify({productId:"keychain",campaign:"Local QA",...body})});
  return {db,auth,post,get,request};
}
test("campaign links persist once per owner, ignore client ownership/redirects, and resolve only allowed products",async()=>{
  const {db,auth,post,get,request}=fixture();
  try{
    const first=await post(request({staff_user_id:2,url:"https://evil.example"}));assert.equal(first.status,200);
    const result=await first.json(), token=result.url.split("/").at(-1);
    assert.match(result.url,/^http:\/\/localhost:3000\/s\/[a-f0-9]{32}$/);assert.equal(result.kind,"campaign_only");
    assert.equal(db.prepare("SELECT staff_user_id FROM sales_share_links").get().staff_user_id,1);
    assert.equal((await (await post(request())).json()).url,result.url);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sales_share_links").get().n,1);
    auth.user={id:2};assert.notEqual((await (await post(request())).json()).url,result.url);
    const response=await get(new Request(result.url),{params:Promise.resolve({token})});
    const destination=new URL(response.headers.get("location"));
    assert.equal(response.status,302);assert.equal(destination.origin,"http://localhost:3000");assert.equal(destination.hash,"#quote");assert.equal(destination.searchParams.get("utm_content"),token);
    db.prepare("UPDATE staff_users SET active=0 WHERE id=1").run();assert.equal((await get(new Request(result.url),{params:Promise.resolve({token})})).status,404);
  }finally{db.close();}
});
test("campaign endpoint rejects unauthenticated, unauthorized, cross-origin and malformed requests",async()=>{
  const {db,auth,post,get,request}=fixture();
  try{
    auth.user=null;assert.equal((await post(request())).status,401);auth.user={id:1};auth.allowed=false;assert.equal((await post(request())).status,403);auth.allowed=true;
    assert.equal((await post(request({}, {origin:"https://evil.example"}))).status,403);
    assert.equal((await post(request({}, {"content-type":"text/plain"}))).status,415);
    for(const body of [{productId:"https://evil.example"},{campaign:"x".repeat(81)},{campaign:"bad\nline"},{productId:null}])assert.equal((await post(request(body))).status,400);
    assert.equal((await post(request({campaign:"x".repeat(3000)}))).status,413);
    assert.equal((await get(new Request("http://localhost:3000/s/bad"),{params:Promise.resolve({token:"../admin"})})).status,404);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sales_share_links").get().n,0);
  }finally{db.close();}
});
test("campaign capacity is enforced without breaking idempotent retrieval",async()=>{
  const {db,post,request}=fixture();
  try{
    const existing=await (await post(request())).json();
    const insert=db.prepare("INSERT INTO sales_share_links(token,staff_user_id,product_id,campaign) VALUES(?,1,'keychain',?)");
    for(let i=1;i<500;i++)insert.run(i.toString(16).padStart(32,"0"),`campaign-${i}`);
    assert.equal((await post(request({campaign:"new over quota"}))).status,409);
    assert.equal((await (await post(request())).json()).url,existing.url);
  }finally{db.close();}
});
