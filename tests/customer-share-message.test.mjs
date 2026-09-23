import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as messages from "../app/customer-share-message.mjs";

const props={orderNumber:"TEST-1234",trackingUrl:"https://order.k2group.site/track/test-token"};
const source=readFileSync(new URL("../app/CustomerShareMessage.tsx",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(react=React,globals={}) {
  const exports={};
  const deps={react,"react/jsx-runtime":jsx,"./customer-share-message.mjs":messages,"./K2Icon":{default:()=>React.createElement("svg",{"aria-hidden":true})}};
  runInNewContext(js,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];},...globals});
  return exports.default;
}
test("first customer message contains the confirmed LINE account, job number and unchanged tracking link",()=>{
  const message=messages.buildCustomerShareMessage(props);
  assert.match(message,/@k2studio/);
  assert.ok(message.includes(messages.CUSTOMER_LINE_URL));
  assert.ok(message.includes("ส่งเลขใบงาน TEST-1234"));
  assert.ok(message.includes(props.trackingUrl));
  assert.doesNotMatch(message,/@k2sign|\/admin\/|ชำระครบ|ชำระเต็มจำนวน/);
});
test("design message retains version and the same customer link",()=>{
  const message=messages.buildCustomerShareMessage({...props,phase:"design",designVersion:3});
  assert.match(message,/TEST-1234 V3/); assert.match(message,/อนุมัติแบบและยืนยันผลิต/);
  assert.ok(message.endsWith(props.trackingUrl));
});
test("server-rendered component exposes the full text, copy button and manual-send guidance",()=>{
  const html=renderToStaticMarkup(React.createElement(load(),props));
  assert.match(html,/ส่งให้ลูกค้าแอด LINE และติดตามงาน/);
  assert.match(html,/readonly=""/i);
  assert.match(html,/type="button"/);
  assert.match(html,/คัดลอกข้อความพร้อมลิงก์/);
  assert.match(html,/ระบบไม่ได้ส่งข้อความอัตโนมัติ/);
  assert.ok(html.includes(messages.CUSTOMER_LINE_URL));
  assert.ok(html.includes(props.trackingUrl));
});
function findButton(element) {
  if (!element) return null;
  if(Array.isArray(element)) return element.map(findButton).find(Boolean);
  if(element.type==="button") return element;
  return findButton(element.props?.children);
}
for(const scenario of ["clipboard","fallback","blocked","throws"]) {
  test(`copy reports actual result: ${scenario}`,async()=>{
    const statuses=[], copied=[], selected=[];
    const textarea={focus(){},select(){selected.push(true);},setSelectionRange(start,end){assert.equal(start,0);assert.equal(end,messages.buildCustomerShareMessage(props).length);}};
    const hooks={...React,useState:initial=>[initial,value=>statuses.push(value)],useMemo:fn=>fn(),useEffect:()=>{},useRef:()=>({current:textarea})};
    const globals={navigator:{clipboard:{writeText:async text=>{if(scenario!=="clipboard")throw Error("denied");copied.push(text);}}},document:{execCommand:command=>{assert.equal(command,"copy");if(scenario==="throws")throw Error("unavailable");return scenario==="fallback";}}};
    const tree=load(hooks,globals)(props);
    await findButton(tree).props.onClick();
    assert.equal(statuses.at(-1),["clipboard","fallback"].includes(scenario)?"copied":"error");
    if(scenario==="clipboard")assert.deepEqual(copied,[messages.buildCustomerShareMessage(props)]);
    else assert.equal(selected.length,1,"visible message stays selected for manual copy");
  });
}
test("new checkout success and existing orders both expose the message without a disclosure",()=>{
  const builder=readFileSync(new URL("../app/StaffOrderBuilder.tsx",import.meta.url),"utf8");
  assert.match(builder,/<CustomerShareMessage orderNumber=\{orderNo\} trackingUrl=\{customerTrackingUrl\}/);
  assert.match(builder,/new URL\(`\/track\/\$\{result.publicToken\}`, window.location.origin\)\.href/);
  assert.ok(builder.indexOf("<CustomerShareMessage")>builder.indexOf("id=\"staff-order-result\""));
  const order=readFileSync(new URL("../app/admin/orders/[id]/page.tsx",import.meta.url),"utf8");
  assert.match(order,/<div id="customer-tools"><CustomerShareMessage/);
  assert.doesNotMatch(order,/<details[^>]+id="customer-tools"/);
});
