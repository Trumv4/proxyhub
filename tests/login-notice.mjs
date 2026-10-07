import assert from "node:assert/strict";
import {build} from "esbuild";
import {pathToFileURL} from "node:url";
import path from "node:path";
await build({entryPoints:["lib/login-notice.ts"],outfile:".sites-runtime/tests/login-notice.mjs",bundle:true,platform:"node",format:"esm"});const {markLoginNotice}=await import(pathToFileURL(path.resolve(".sites-runtime/tests/login-notice.mjs")));const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
assert.equal(markLoginNotice(storage,"buyer@example.test","session-a"),true);assert.equal(markLoginNotice(storage,"buyer@example.test","session-a"),false);assert.equal(markLoginNotice(storage,"buyer@example.test","session-b"),true);assert.equal(markLoginNotice(storage,"buyer@example.test","session-b"),false);assert.equal(markLoginNotice(storage,"other@example.test","session-b"),true);console.log("PASS Login announcement shown once per session, stable across refresh and independent per account");

