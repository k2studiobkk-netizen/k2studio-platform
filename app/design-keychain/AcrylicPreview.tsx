"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { acrylicContours, signedArea, containsPoint } from "./acrylic-geometry.mjs";
import type { Artwork } from "./image-tools";
import styles from "./designer.module.css";
type Props={art:Artwork;back:Artwork|null;w:number;h:number;hole:{x:number;y:number};sides:1|2};
type View="front"|"back"|"edge"|"reset";
function whiteMask(art:Artwork,w:number,h:number){
 const c=document.createElement("canvas");c.width=Math.ceil(w*6);c.height=Math.ceil(h*6);const ctx=c.getContext("2d")!;ctx.drawImage(art.canvas,0,0,c.width,c.height);
 const data=ctx.getImageData(0,0,c.width,c.height),alpha=new Uint8Array(c.width*c.height),horizontal=new Uint8Array(alpha.length),r=2;
 for(let i=0;i<alpha.length;i++)alpha[i]=data.data[i*4+3];
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let a=255;for(let d=-r;d<=r;d++)a=Math.min(a,x+d<0||x+d>=c.width?0:alpha[y*c.width+x+d]);horizontal[y*c.width+x]=a}
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let a=255;for(let d=-r;d<=r;d++)a=Math.min(a,y+d<0||y+d>=c.height?0:horizontal[(y+d)*c.width+x]);const i=(y*c.width+x)*4;data.data[i]=data.data[i+1]=data.data[i+2]=255;data.data[i+3]=a}
 ctx.putImageData(data,0,0);return c;
}
function backCanvas(art:Artwork,back:Artwork){
 const c=document.createElement("canvas");c.width=art.width;c.height=art.height;const ctx=c.getContext("2d")!,scale=Math.min(c.width/back.width,c.height/back.height);
 ctx.drawImage(back.canvas,(c.width-back.width*scale)/2,(c.height-back.height*scale)/2,back.width*scale,back.height*scale);
 ctx.globalCompositeOperation="destination-in";ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(art.canvas,0,0);return c;
}
export default function AcrylicPreview({art,back,w,h,hole,sides}:Props){
 const host=useRef<HTMLDivElement>(null),actions=useRef<{view:(v:View)=>void;zoom:(factor:number)=>void;save:()=>void}|null>(null),autoRef=useRef(false);
 const [auto,setAuto]=useState(false),[quality,setQuality]=useState("high"),[error,setError]=useState(""),[ready,setReady]=useState(false),[pieces,setPieces]=useState(1);
 useEffect(()=>{autoRef.current=auto},[auto]);
 useEffect(()=>{
  if(!host.current)return;const container=host.current;let disposed=false,frame=0,renderer:THREE.WebGLRenderer|undefined,controls:OrbitControls|undefined,observer:ResizeObserver|undefined,visibility:IntersectionObserver|undefined;
  const scene=new THREE.Scene(),textures:THREE.Texture[]=[],materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[];
  setReady(false);setError("");
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:"low-power"});renderer.setPixelRatio(quality==="high"?Math.min(2.5,Math.max(2,window.devicePixelRatio||1)):Math.min(window.devicePixelRatio||1,1.25));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
   renderer.domElement.setAttribute("aria-label","พวงกุญแจอะคริลิก 3D ลากเพื่อหมุน ใช้ปุ่มด้านล่างเพื่อเปลี่ยนมุมหรือซูม");renderer.domElement.setAttribute("role","img");container.appendChild(renderer.domElement);
   scene.background=new THREE.Color("#eeeae4");
   const model=new THREE.Group();scene.add(model);
   const loops=acrylicContours(art.mask,w,h,hole,quality==="high"?8:5),outers=loops.filter((p:{x:number;y:number}[])=>signedArea(p)<0),holes=loops.filter((p:{x:number;y:number}[])=>signedArea(p)>0);setPieces(outers.length);
   if(!outers.length)throw Error("สร้างรูปทรงจากภาพนี้ไม่ได้ กรุณาลองภาพ PNG โปร่งใส");
   const shapes=outers.map((points:{x:number;y:number}[])=>{const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,p.y)));for(const loop of holes)if(containsPoint(points,loop[0]))shape.holes.push(new THREE.Path(loop.map((p:{x:number;y:number})=>new THREE.Vector2(p.x,p.y))));return shape});
   const geometry=new THREE.ExtrudeGeometry(shapes,{depth:2.5,bevelEnabled:false,steps:1,curveSegments:12});geometry.translate(0,0,-1.25);geometries.push(geometry);
   // Unlit preview: no environment, specular reflection, refraction or lighting passes.
   const acrylic=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.012,depthWrite:false,toneMapped:false});
   const edge=new THREE.MeshBasicMaterial({color:0xc5d0d5,transparent:true,opacity:.14,depthWrite:false,toneMapped:false});
   materials.push(acrylic,edge);model.add(new THREE.Mesh(geometry,[acrylic,edge]));
   const plane=new THREE.PlaneGeometry(w,h);geometries.push(plane);
   function print(canvas:HTMLCanvasElement,z:number,reverse=false){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(quality==="high"?16:4,renderer!.capabilities.getMaxAnisotropy());textures.push(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.05,side:THREE.DoubleSide,toneMapped:false});materials.push(material);const mesh=new THREE.Mesh(plane,material);mesh.position.z=z;if(reverse)mesh.rotation.y=Math.PI;model.add(mesh);
   }
   // Both print faces live behind the same 2.5 mm acrylic plate, not on opposite acrylic surfaces.
   print(art.canvas,-1.26);print(whiteMask(art,w,h),-1.28);if(sides===2&&back)print(backCanvas(art,back),-1.30,true);
   const camera=new THREE.PerspectiveCamera(35,1,.1,2000),target=new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
   controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.09;controls.autoRotateSpeed=.65;controls.minPolarAngle=.05;controls.maxPolarAngle=Math.PI-.05;
   let distance=100,dirty=true,visible=true,last=performance.now();const invalidate=()=>{dirty=true};controls.addEventListener("change",invalidate);
   const setView=(view:View)=>{const direction=view==="front"?new THREE.Vector3(0,0,1):view==="back"?new THREE.Vector3(0,0,-1):view==="edge"?new THREE.Vector3(1,0,.035):new THREE.Vector3(.38,.18,1).normalize();camera.position.copy(target).addScaledVector(direction,distance);controls!.target.copy(target);controls!.update();dirty=true};
   const resize=()=>{const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);renderer!.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();distance=Math.max(w/camera.aspect,h+12)/(2*Math.tan(THREE.MathUtils.degToRad(17.5)))*1.35;controls!.minDistance=distance*.4;controls!.maxDistance=distance*2.2;setView("reset")};
   resize();observer=new ResizeObserver(resize);observer.observe(container);visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;dirty=true});visibility.observe(container);
   actions.current={view:setView,zoom:factor=>{camera.position.sub(target).multiplyScalar(factor).clampLength(controls!.minDistance,controls!.maxDistance).add(target);controls!.update();dirty=true},save:()=>{renderer!.render(scene,camera);renderer!.domElement.toBlob(blob=>{if(!blob||disposed)return;const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="K2-keychain-3D-mockup.png";link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)},"image/png")}};
   const lost=(e:Event)=>{e.preventDefault();setError("การแสดงผล 3D หยุดชั่วคราว กดกลับไปจัดแบบ 2D แล้วเปิด 3D อีกครั้ง")};renderer.domElement.addEventListener("webglcontextlost",lost);
   const animate=(now:number)=>{if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;if(!visible||document.hidden)return;controls!.autoRotate=autoRef.current;const changed=controls!.update(dt);if(dirty||changed||autoRef.current){renderer!.render(scene,camera);dirty=false}};frame=requestAnimationFrame(animate);renderer.render(scene,camera);setReady(true);
  }catch(e){setError(e instanceof Error?e.message:"อุปกรณ์นี้เปิดภาพ 3D ไม่ได้ กรุณาใช้ภาพตัวอย่าง 2D")}
  return()=>{disposed=true;cancelAnimationFrame(frame);actions.current=null;observer?.disconnect();visibility?.disconnect();controls?.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer?.dispose();renderer?.domElement.remove()};
 },[art,back,w,h,hole.x,hole.y,sides,quality]);
 const changeView=(view:View)=>{setAuto(false);autoRef.current=false;actions.current?.view(view)};
 return <div className={styles.preview3d}><div className={styles.mockupLabel}><b>อะคริลิกใส · 2.5 มม.</b><span>3D · ไม่มีแสงสะท้อน</span></div><div ref={host} className={styles.canvas3d}/>{!ready&&!error&&<p role="status" className={styles.loading3d}>กำลังสร้างชิ้นงาน 3D…</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}<div className={styles.viewButtons} aria-label="ควบคุมภาพสามมิติ">{([["front","ด้านหน้า"],["back","ด้านหลัง"],["edge","ด้านข้าง"],["reset","มุมเริ่มต้น"]] as const).map(([view,label])=><button type="button" key={view} disabled={!ready||!!error} onClick={()=>changeView(view)}>{label}</button>)}<button type="button" disabled={!ready||!!error} onClick={()=>actions.current?.zoom(.8)} aria-label="ซูมเข้า">＋</button><button type="button" disabled={!ready||!!error} onClick={()=>actions.current?.zoom(1.25)} aria-label="ซูมออก">−</button></div><div className={styles.mockupOptions}><label><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} disabled={!ready||!!error}/> หมุนอัตโนมัติ</label><label>คุณภาพ<select value={quality} onChange={e=>setQuality(e.target.value)}><option value="balanced">สมดุล / มือถือ</option><option value="high">คมชัดสูง</option></select></label><button type="button" disabled={!ready||!!error} onClick={()=>actions.current?.save()}>บันทึกภาพ 3D</button></div><small>ลากเพื่อหมุน 360° · ใช้สองนิ้วหรือปุ่ม + / − เพื่อซูม</small>{pieces>1&&<small className={styles.notice}>รูปนี้มีส่วนที่แยกจากกัน ให้กราฟิกตรวจการเชื่อมชิ้นงานก่อนผลิต</small>}{sides===2&&!back&&<small className={styles.notice}>ยังไม่มีภาพด้านหลัง กรุณาอัปโหลดหรือเลือกใช้ภาพเดียวกัน</small>}<small>โหมดดูภาพชัด ปิดแสงสะท้อนและเงาจำลอง · สีอาจต่างจากชิ้นงานจริง</small></div>
}
