try {
 const r=await fetch('http://127.0.0.1:3000/api/health',{headers:{'x-event-signal-key':process.env.EVENT_SIGNAL_INTERNAL_API_KEY},signal:AbortSignal.timeout(8000)});
 process.exit(r.ok?0:1);
}catch{process.exit(1)}
