export type Artwork = {url:string;name:string;original:File;processed:Blob;canvas:HTMLCanvasElement;width:number;height:number;mask:ImageData};
const blob=(canvas:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("สร้างภาพไม่ได้")),"image/png"));
export async function finishArt(canvas:HTMLCanvasElement, original:File):Promise<Artwork> {
 const ctx=canvas.getContext("2d")!;const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels.data[(y*canvas.width+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
 if(right<left)throw Error("ภาพถูกลบทั้งหมด กรุณาคืนภาพเดิมแล้วลองอีกครั้ง");
 const cropped=document.createElement("canvas");cropped.width=right-left+1;cropped.height=bottom-top+1;cropped.getContext("2d")!.drawImage(canvas,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
 const maskCanvas=document.createElement("canvas");maskCanvas.width=240;maskCanvas.height=Math.max(1,Math.round(240*cropped.height/cropped.width));maskCanvas.getContext("2d")!.drawImage(cropped,0,0,maskCanvas.width,maskCanvas.height);
 const processed=await blob(cropped);return {url:URL.createObjectURL(processed),name:original.name,original,processed,canvas:cropped,width:cropped.width,height:cropped.height,mask:maskCanvas.getContext("2d")!.getImageData(0,0,maskCanvas.width,maskCanvas.height)};
}
export async function openArt(file:File):Promise<Artwork> {
 if(!["image/png","image/jpeg"].includes(file.type)||file.size>15*1024*1024)throw Error("เลือก PNG หรือ JPG ขนาดไม่เกิน 15 MB");
 const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(image.width*image.height>40000000)throw Error("ภาพใหญ่เกิน 40 ล้านพิกเซล");if(image.width/image.height<.1||image.width/image.height>10)throw Error("ภาพแคบหรือยาวเกินไป กรุณาครอปภาพก่อน");const scale=Math.min(1,1600/Math.max(image.width,image.height));const canvas=document.createElement("canvas");canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext("2d")!.drawImage(image,0,0,canvas.width,canvas.height);return await finishArt(canvas,file)}finally{URL.revokeObjectURL(url)}
}
export async function removeEdgeBackground(art:Artwork,tolerance=45):Promise<Artwork> {
 const c=document.createElement("canvas");c.width=art.width;c.height=art.height;const ctx=c.getContext("2d")!;ctx.drawImage(art.canvas,0,0);const img=ctx.getImageData(0,0,c.width,c.height),data=img.data,n=c.width*c.height;
 const seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
 const corners=[0,c.width-1,(c.height-1)*c.width,n-1].map(i=>[data[i*4],data[i*4+1],data[i*4+2]]);
 function enqueue(i:number){if(i<0||i>=n||seen[i])return;seen[i]=1;const p=i*4;if(data[p+3]===0||corners.some(color=>Math.hypot(data[p]-color[0],data[p+1]-color[1],data[p+2]-color[2])<=tolerance)){queue[tail++]=i;data[p+3]=0}}
 for(let x=0;x<c.width;x++){enqueue(x);enqueue((c.height-1)*c.width+x)}for(let y=0;y<c.height;y++){enqueue(y*c.width);enqueue(y*c.width+c.width-1)}
 while(head<tail){const i=queue[head++];if(i%c.width)enqueue(i-1);if(i%c.width<c.width-1)enqueue(i+1);enqueue(i-c.width);enqueue(i+c.width)}
 ctx.putImageData(img,0,0);return finishArt(c,art.original);
}
export function holeOnSilhouette(art:Artwork|null,w:number,h:number,angle:number) {
 const a=angle*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),limit=Math.hypot(w,h)/2;
 if(art){for(let d=limit;d>=0;d-=.12){const x=w/2+d*dx,y=h/2+d*dy;const px=Math.floor(x/w*art.mask.width),py=Math.floor(y/h*art.mask.height);if(px>=0&&py>=0&&px<art.mask.width&&py<art.mask.height&&art.mask.data[(py*art.mask.width+px)*4+3]>128)return{x:x+3*dx,y:y+3*dy,valid:true}}return{x:w/2,y:0,valid:false}}
 return{x:w/2,y:-3,valid:false};
}
async function dataUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob)})}
export async function exportProof(svgs:SVGSVGElement[],description:string):Promise<Blob> {
 const canvas=document.createElement("canvas");canvas.width=1000*svgs.length;canvas.height=1130;const ctx=canvas.getContext("2d")!;ctx.fillStyle="#f4f6f7";ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const [index,svg] of svgs.entries()){
  const clone=svg.cloneNode(true) as SVGSVGElement;clone.setAttribute("xmlns","http://www.w3.org/2000/svg");clone.setAttribute("width","1000");clone.setAttribute("height","1000");
  for(const element of Array.from(clone.querySelectorAll("image"))){const href=element.getAttribute("href");if(href&&!href.startsWith("data:"))element.setAttribute("href",await dataUrl(await(await fetch(href)).blob()))}
  const source=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml"}));
  try{const img=new Image();img.src=source;await img.decode();ctx.drawImage(img,index*1000,0,1000,1000);ctx.fillStyle="#152a33";ctx.font="24px sans-serif";ctx.fillText(index===0?"FRONT":"BACK",index*1000+40,1030)}finally{URL.revokeObjectURL(source)}
 }
 ctx.font="20px sans-serif";ctx.fillText(description,40,1080);return blob(canvas);
}
