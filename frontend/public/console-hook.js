/* Frontend console interception (production) */
(function(){
  try {
    var PROD = true; // served only in production deployment context
    if(!PROD) return;
    var tokenMeta = document.querySelector('meta[name="client-log-token"]');
    var LOG_TOKEN = tokenMeta ? tokenMeta.getAttribute('content') : '';

    var original = window.console;
    var queue = [];
    var MAX_QUEUE = 30;
    var FLUSH_INTERVAL = 5000;
    var endpoint = '/client-logs';
    var timer = null;
    var sending = false;

    function nowISO(){ return new Date().toISOString(); }

    function sanitize(str){
      return str.replace(/[\u0000-\u0019\u007f]/g,'');
    }

    function serialize(args){
      try {
        return args.map(function(a){
          if (a instanceof Error) return a.stack || (a.name+': '+a.message);
          if (typeof a === 'string') return a;
          if (typeof a === 'number' || typeof a === 'boolean' || a == null) return String(a);
          var s;
            s = JSON.stringify(a, function(k,v){
              if (v && typeof v === 'object') {
                if (Array.isArray(v) && v.length>100) return v.slice(0,100).concat(['...[TRUNCATED]']);
              }
              if (typeof v === 'string' && v.length > 1000) return v.slice(0,1000)+'...[TRUNCATED]';
              return v;
            });
          return s;
        }).join(' ');
      } catch(e){ return '[SerializeError] '+e.message; }
    }

    function enqueue(level, args){
      var msg = sanitize(serialize(args));
      if (msg.length > 8000) msg = msg.slice(0,8000)+' [TRUNCATED]';
      queue.push({ level: level, msg: msg, ts: nowISO(), url: location.pathname+location.search });
      if (queue.length >= MAX_QUEUE) flush();
    }

    function flush(){
      if (!queue.length || sending) return;
      var batch = queue.splice(0, queue.length);
      sending = true;
      var payload = JSON.stringify({ logs: batch });
      var headers = { 'Content-Type':'application/json' };
      if (LOG_TOKEN) headers['x-log-token'] = LOG_TOKEN;
      var ok = false;
      if (navigator.sendBeacon) {
        try {
          var blob = new Blob([payload], { type: 'application/json' });
          ok = navigator.sendBeacon(endpoint, blob);
          if (ok) { sending = false; schedule(); return; }
        } catch(_){}
      }
      fetch(endpoint, { method:'POST', body: payload, headers: headers, keepalive: true })
        .catch(function(){})
        .finally(function(){ sending = false; schedule(); });
    }

    function schedule(){
      if (timer) clearTimeout(timer);
      if (queue.length) timer = setTimeout(flush, FLUSH_INTERVAL);
      else timer = setTimeout(function(){ if(queue.length) flush(); }, FLUSH_INTERVAL);
    }

    ['log','info','warn','error','debug'].forEach(function(l){
      window.console[l] = function(){ enqueue(l, Array.prototype.slice.call(arguments)); };
    });

    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('beforeunload', function(){ flush(); });
    schedule();
  } catch(e) {
    // If interception fails, we do nothing to avoid breaking app
  }
})();

