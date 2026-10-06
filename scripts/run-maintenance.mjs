// Never put the token in argv or files. This helper consumes one JSON line on stdin.
process.stdout.write("Ready for private maintenance JSON on stdin (input is hidden).\n");
if(process.stdin.isTTY)process.stdin.setRawMode(true);
let input="";
const config=await new Promise((resolve,reject)=>{process.stdin.on("data",chunk=>{input+=chunk.toString();if(/[\r\n]/.test(input)){if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();try{resolve(JSON.parse(input.trim()));}catch{reject(new Error("Invalid input"));}}});});
const origin=new URL(config.url);if(origin.protocol!=="https:"||!origin.hostname.endsWith(".chatgpt.site")||origin.username||origin.password)throw Error("Invalid Site URL");
const headers={"OAI-Sites-Authorization":`Bearer ${config.token}`};
try{
 const response=await fetch(new URL("/api/maintenance",origin),{method:"POST",headers,redirect:"error",signal:AbortSignal.timeout(110000)});
 const result=await response.json();if(!response.ok){console.log(JSON.stringify({ok:false,status:response.status,error:result.error??"Maintenance unavailable"}));process.exitCode=1;}else{
  const readback=await fetch(new URL("/api/maintenance",origin),{headers,redirect:"error",signal:AbortSignal.timeout(10000)});const state=await readback.json();console.log(JSON.stringify({ok:readback.ok,checked:result.checked,replaced:result.replaced,latest:state.latest}));
 }
}catch{console.log(JSON.stringify({ok:false,error:"Cannot reach maintenance endpoint"}));process.exitCode=1;}
