// عامل خلفي بسيط يعالج الردود المؤجلة كل 10 ثوانٍ: npm run worker
import { processDue } from "../src/lib/engine";

async function loop() {
  for (;;) {
    try {
      const n = await processDue();
      if (n) console.log(new Date().toISOString(), `processed ${n}`);
    } catch (e) {
      console.error(e);
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
}
loop();
