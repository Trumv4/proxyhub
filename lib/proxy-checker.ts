import {connect} from "cloudflare:sockets";
import {publicIPv4} from "./proxy-rules";
const encoder=new TextEncoder(),decoder=new TextDecoder();
export type CheckResult={ok:boolean;latency:number|null;error:string|null;unsupported?:boolean};
export async function checkProxy(p:{host:string;port:number;protocol:string;user:string;password:string}):Promise<CheckResult>{
 if(!publicIPv4(p.host)||p.port===25)return {ok:false,latency:null,error:"Địa chỉ không được phép",unsupported:true};
 const start=Date.now();let socket:ReturnType<typeof connect>|null=null;let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  socket=connect({hostname:p.host,port:p.port});socket.closed.catch(()=>{});const active=socket;
  const work=async()=>{
   await active.opened;const reader=active.readable.getReader(),writer=active.writable.getWriter();let buffer=new Uint8Array(0);
   async function read(n:number){while(buffer.length<n){const part=await reader.read();if(part.done)throw new Error("CLOSED");const joined=new Uint8Array(buffer.length+part.value.length);joined.set(buffer);joined.set(part.value,buffer.length);buffer=joined;if(buffer.length>16384)throw new Error("OVERSIZE");}const result=buffer.slice(0,n);buffer=buffer.slice(n);return result;}
   async function header(){let text=decoder.decode(buffer);buffer=new Uint8Array(0);while(!text.includes("\r\n\r\n")){const part=await reader.read();if(part.done)throw new Error("CLOSED");text+=decoder.decode(part.value);if(text.length>16384)throw new Error("OVERSIZE");}return text;}
   if(p.protocol==="SOCKS5"){
    await writer.write(new Uint8Array([5,2,0,2]));const greeting=await read(2);if(greeting[0]!==5)throw new Error("PROTOCOL");
    if(greeting[1]===2){const u=encoder.encode(p.user),pw=encoder.encode(p.password);await writer.write(new Uint8Array([1,u.length,...u,pw.length,...pw]));const auth=await read(2);if(auth[0]!==1||auth[1]!==0)throw new Error("AUTH");}else if(greeting[1]!==0)throw new Error("AUTH");
    const target=encoder.encode("www.gstatic.com");await writer.write(new Uint8Array([5,1,0,3,target.length,...target,0,80]));const response=await read(4);if(response[0]!==5||response[1]!==0||response[2]!==0)throw new Error("TUNNEL");if(response[3]===1)await read(6);else if(response[3]===4)await read(18);else if(response[3]===3){const length=await read(1);await read(length[0]+2);}else throw new Error("PROTOCOL");
    await writer.write(encoder.encode("GET /generate_204 HTTP/1.1\r\nHost: www.gstatic.com\r\nConnection: close\r\n\r\n"));
   }else{
    const auth=btoa(String.fromCharCode(...encoder.encode(`${p.user}:${p.password}`)));
    await writer.write(encoder.encode(`GET http://www.gstatic.com/generate_204 HTTP/1.1\r\nHost: www.gstatic.com\r\nProxy-Authorization: Basic ${auth}\r\nConnection: close\r\n\r\n`));
   }
   const result=await header();if(!/^HTTP\/1\.[01] 204\b/.test(result))throw new Error(/^HTTP\/1\.[01] 407\b/.test(result)?"AUTH":"HTTP_STATUS");
   reader.releaseLock();writer.releaseLock();return {ok:true,latency:Date.now()-start,error:null};
  };
  return await Promise.race([work(),new Promise<CheckResult>((_,reject)=>{timer=setTimeout(()=>reject(new Error("TIMEOUT")),8000);})]);
 }catch(e){const raw=e instanceof Error?e.message:"";if(/disallowed|specified address|port 25|TCP Loop/i.test(raw))return {ok:false,latency:null,error:"Hạ tầng checker không hỗ trợ địa chỉ này",unsupported:true};return {ok:false,latency:null,error:raw==="AUTH"?"Sai xác thực proxy":raw==="TIMEOUT"?"Hết thời gian kết nối":raw==="HTTP_STATUS"?"Không truy cập được đích kiểm tra":"Không kết nối được proxy"};}
 finally{clearTimeout(timer);if(socket)await socket.close().catch(()=>{});}
}
