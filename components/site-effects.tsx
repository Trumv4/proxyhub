"use client";
import {useEffect, useRef, useSyncExternalStore} from "react";
import {Sun, Moon} from "lucide-react";

const THEME_KEY="proxyhub-theme";
function readTheme(){return document.documentElement.dataset.theme==="dark"?"dark":"light";}
function subscribeTheme(callback:()=>void){
 const sync=(event:StorageEvent)=>{if(event.key===THEME_KEY){const dark=event.newValue==="dark";document.documentElement.dataset.theme=dark?"dark":"light";document.documentElement.classList.toggle("dark",dark);callback();}};
 window.addEventListener("proxyhub-theme-change",callback);window.addEventListener("storage",sync);
 return ()=>{window.removeEventListener("proxyhub-theme-change",callback);window.removeEventListener("storage",sync);};
}
export function ThemeToggle(){
 const theme=useSyncExternalStore(subscribeTheme,readTheme,()=>"light");
 function toggle(){const next=readTheme()==="dark"?"light":"dark";document.documentElement.dataset.theme=next;document.documentElement.classList.toggle("dark",next==="dark");try{localStorage.setItem(THEME_KEY,next);}catch{/* Still switch when browser storage is unavailable. */}window.dispatchEvent(new Event("proxyhub-theme-change"));}
 return <button type="button" className="theme-toggle" aria-label={theme==="dark"?"Chuyển sang chế độ sáng":"Chuyển sang chế độ tối"} title={theme==="dark"?"Chế độ sáng":"Chế độ tối"} onClick={toggle}>{theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}<span>{theme==="dark"?"Sáng":"Tối"}</span></button>;
}

type Dot={x:number;y:number;vx:number;vy:number;radius:number;tint:number};
/** Decorative background. Bounded density, 30 fps and no work in hidden tabs. */
export function ParticleBackground(){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;const ctx=element.getContext("2d");if(!ctx)return;
  const motion=matchMedia("(prefers-reduced-motion: reduce)");
  let dots:Dot[]=[],w=0,h=0,frame=0,last=0,dark=readTheme()==="dark";
  const pointer={x:-1000,y:-1000};
  function resize(){
   if(!element||!ctx)return;w=window.innerWidth;h=window.innerHeight;
   const ratio=Math.min(window.devicePixelRatio||1,1.5);element.width=Math.round(w*ratio);element.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
   const count=Math.max(20,Math.min(72,Math.round(w*h/17000)));
   dots=Array.from({length:count},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*13,vy:(Math.random()-.5)*13,radius:.7+Math.random()*.9,tint:Math.floor(Math.random()*3)}));
   if(motion.matches)draw(0);
  }
  function draw(seconds:number){
   if(!ctx)return;ctx.clearRect(0,0,w,h);
   const colors=dark?["167,114,246","113,120,234","218,93,178"]:["99,114,203","132,104,205","163,103,174"];
   const reach=w<600?130:180;
   for(let i=0;i<dots.length;i++){
    const p=dots[i];p.x+=p.vx*seconds;p.y+=p.vy*seconds;if(p.x<0||p.x>w){p.vx*=-1;p.x=Math.max(0,Math.min(w,p.x));}if(p.y<0||p.y>h){p.vy*=-1;p.y=Math.max(0,Math.min(h,p.y));}
    ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fillStyle=`rgba(${colors[p.tint]},${dark?.63:.42})`;ctx.fill();
    for(let j=i+1;j<dots.length;j++){const q=dots[j];const distance=Math.hypot(p.x-q.x,p.y-q.y);if(distance<reach){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineWidth=.65;ctx.strokeStyle=`rgba(${colors[0]},${(1-distance/reach)*(dark?.34:.19)})`;ctx.stroke();}}
    const distance=Math.hypot(p.x-pointer.x,p.y-pointer.y);if(distance<210&&!motion.matches){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(pointer.x,pointer.y);ctx.strokeStyle=`rgba(${colors[0]},${(1-distance/210)*(dark?.48:.26)})`;ctx.stroke();}
   }
  }
  function animate(now:number){if(document.hidden||motion.matches)return;const delta=now-last;if(delta>=1000/30){draw(last?Math.min(delta/1000,.06):0);last=now;}frame=requestAnimationFrame(animate);}
  function start(){cancelAnimationFrame(frame);last=0;if(!document.hidden){if(motion.matches)draw(0);else frame=requestAnimationFrame(animate);}}
  function move(event:PointerEvent){if(event.pointerType==="mouse"){pointer.x=event.clientX;pointer.y=event.clientY;}}
  function leave(){pointer.x=-1000;pointer.y=-1000;}
  const observer=new MutationObserver(()=>{dark=readTheme()==="dark";if(motion.matches)draw(0);});observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  resize();start();window.addEventListener("resize",resize);window.addEventListener("pointermove",move,{passive:true});document.addEventListener("mouseleave",leave);document.addEventListener("visibilitychange",start);motion.addEventListener("change",start);
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("resize",resize);window.removeEventListener("pointermove",move);document.removeEventListener("mouseleave",leave);document.removeEventListener("visibilitychange",start);motion.removeEventListener("change",start);};
 },[]);
 return <canvas ref={canvas} className="particle-background" aria-hidden="true"/>;
}
