// A bounded raster contour for display only. Coordinates are millimetres.
// Fill enclosed transparent artwork areas with acrylic, then subtract the ring hole.
export function acrylicContours(mask, width, height, hole, pixelsPerMm = 5) {
 const scale=pixelsPerMm, pad=5, x0=Math.min(-pad,hole.x-pad), y0=Math.min(-pad,hole.y-pad);
 const cols=Math.ceil((Math.max(width+pad,hole.x+pad)-x0)*scale), rows=Math.ceil((Math.max(height+pad,hole.y+pad)-y0)*scale);
 if(cols*rows>1000000)throw Error("รูปทรงใหญ่เกินขอบเขตภาพตัวอย่าง");
 const source=new Uint8Array(cols*rows), expanded=new Uint8Array(cols*rows), solid=new Uint8Array(cols*rows), radius=Math.ceil(scale);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const ax=x0+(x+.5)/scale,ay=y0+(y+.5)/scale,px=Math.floor(ax/width*mask.width),py=Math.floor(ay/height*mask.height);
  if(px>=0&&py>=0&&px<mask.width&&py<mask.height&&mask.data[(py*mask.width+px)*4+3]>32)source[y*cols+x]=1;
 }
 // Separable square dilation matches the 2D SVG feMorphology 1 mm border.
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){for(let d=-radius;d<=radius;d++)if(x+d>=0&&x+d<cols&&source[y*cols+x+d]){expanded[y*cols+x]=1;break}}
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){for(let d=-radius;d<=radius;d++)if(y+d>=0&&y+d<rows&&expanded[(y+d)*cols+x]){solid[y*cols+x]=1;break}
  if(Math.hypot(x0+(x+.5)/scale-hole.x,y0+(y+.5)/scale-hole.y)<=3)solid[y*cols+x]=1;
 }
 const outside=new Uint8Array(solid.length),queue=new Int32Array(solid.length);let tail=0,head=0;
 const add=i=>{if(!solid[i]&&!outside[i]){outside[i]=1;queue[tail++]=i}};
 for(let x=0;x<cols;x++){add(x);add((rows-1)*cols+x)}for(let y=0;y<rows;y++){add(y*cols);add(y*cols+cols-1)}
 while(head<tail){const i=queue[head++],x=i%cols,y=Math.floor(i/cols);if(x)add(i-1);if(x+1<cols)add(i+1);if(y)add(i-cols);if(y+1<rows)add(i+cols)}
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(!outside[i])solid[i]=1;
  if(Math.hypot(x0+(x+.5)/scale-hole.x,y0+(y+.5)/scale-hole.y)<1.5)solid[i]=0;
 }
 const edges=new Map(),stride=cols+1;
 function edge(x,y,ex,ey,dir){const key=y*stride+x;const list=edges.get(key)||[];list.push({end:ey*stride+ex,dir});edges.set(key,list)}
 const filled=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&solid[y*cols+x];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(filled(x,y)){
  if(!filled(x,y-1))edge(x,y,x+1,y,0);if(!filled(x+1,y))edge(x+1,y,x+1,y+1,1);
  if(!filled(x,y+1))edge(x+1,y+1,x,y+1,2);if(!filled(x-1,y))edge(x,y+1,x,y,3);
 }
 const loops=[];
 while(edges.size){const start=edges.keys().next().value;let key=start,previous=-1;const points=[];
  do{const list=edges.get(key);if(!list?.length)throw Error("ไม่สามารถสร้างขอบชิ้นงานได้");
   const priority=previous<0?list[0]:[1,0,3,2].map(turn=>list.find(e=>e.dir===(previous+turn)%4)).find(Boolean);
   list.splice(list.indexOf(priority),1);if(!list.length)edges.delete(key);
   points.push({x:x0+(key%stride)/scale-width/2,y:height/2-y0-Math.floor(key/stride)/scale});key=priority.end;previous=priority.dir;
  }while(key!==start);
  // Keep corners, remove the straight runs; no curve can cross a narrow neck.
  const clean=points.filter((b,i)=>{const a=points[(i+points.length-1)%points.length],c=points[(i+1)%points.length];return Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))>1e-9});
  if(clean.length>=3)loops.push(clean);
 }
 return loops;
}
export function signedArea(points){return points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p.x*q.y-q.x*p.y},0)/2}
export function containsPoint(points,p){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
 const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside}
