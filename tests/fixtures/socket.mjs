import net from "node:net";
import {Readable,Writable} from "node:stream";
export function connect(){const socket=net.createConnection({host:"127.0.0.1",port:globalThis.__proxyTestPort});const readable=Readable.toWeb(socket),writable=Writable.toWeb(socket);return {readable,writable,opened:new Promise((resolve,reject)=>{socket.once("connect",resolve);socket.once("error",reject);}),closed:new Promise(resolve=>socket.once("close",resolve)),close:async()=>socket.destroy()};}
