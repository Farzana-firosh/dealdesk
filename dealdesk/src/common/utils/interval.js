// Runs fn every `ms`, skipping a tick if the previous run is still going.
// The interval is only a trigger: all job state lives in MongoDB, so a restart loses nothing.
function runEvery(name, ms, fn) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[job:${name}]`, err);
    } finally {
      running = false;
    }
  }, ms);
  return () => clearInterval(timer);
}

module.exports = { runEvery };
