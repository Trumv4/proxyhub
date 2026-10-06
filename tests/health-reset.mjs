import assert from "node:assert/strict";
import {healthAfter} from "../lib/proxy-rules.ts";
const recovered=healthAfter({failures:2,checked:1000},true,1001);
assert.equal(recovered.count,0);
assert.equal(healthAfter({failures:recovered.count,checked:1001},false,301002).count,1);
console.log("PASS successful recheck resets consecutive failures inside cooldown");
