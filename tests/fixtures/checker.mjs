export async function checkProxy(proxy){const ok=globalThis.__health?.[proxy.host]!==false;return {ok,latency:ok?12:null,error:ok?null:"Không kết nối được proxy"};}
