(function() {
  const WS_URL = 'ws://' + window.location.host;
  let ws = null;
  let eventQueue = [];

  function showReloadBanner() {
    if (document.getElementById('vc-reload-banner')) return; // already showing
    const banner = document.createElement('div');
    banner.id = 'vc-reload-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#0a84ff;color:white;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
    banner.innerHTML = '<span>File updated externally</span><span><button id="vc-reload-btn" style="background:white;color:#0a84ff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-weight:600;margin-left:8px">Reload</button><button id="vc-dismiss-btn" style="background:transparent;color:white;border:1px solid rgba(255,255,255,0.5);padding:4px 12px;border-radius:4px;cursor:pointer;margin-left:8px">Dismiss</button></span>';
    document.body.appendChild(banner);
    document.getElementById('vc-reload-btn').onclick = () => window.location.reload();
    document.getElementById('vc-dismiss-btn').onclick = () => banner.remove();
  }

  // Expose for md-renderer.js (409 conflict handler)
  window.showReloadBanner = showReloadBanner;

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      eventQueue.forEach(e => ws.send(JSON.stringify(e)));
      eventQueue = [];
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'reload') {
        if (data.source === 'toggle') {
          // Our own checkbox write — ignore
          return;
        }
        // External change — auto-reload
        window.location.reload();
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 1000);
    };
  }

  function sendEvent(event) {
    event.timestamp = Date.now();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      eventQueue.push(event);
    }
  }

  // Capture clicks on choice elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-choice]');
    if (!target) return;

    sendEvent({
      type: 'click',
      text: target.textContent.trim(),
      choice: target.dataset.choice,
      id: target.id || null
    });

    // Update indicator bar (defer so toggleSelect runs first)
    setTimeout(() => {
      const indicator = document.getElementById('indicator-text');
      if (!indicator) return;
      const container = target.closest('.options') || target.closest('.cards');
      const selected = container ? container.querySelectorAll('.selected') : [];
      if (selected.length === 0) {
        indicator.textContent = 'Click an option above, then return to the terminal';
      } else if (selected.length === 1) {
        const label = selected[0].querySelector('h3, .content h3, .card-body h3')?.textContent?.trim() || selected[0].dataset.choice;
        indicator.textContent = '';
        const span = document.createElement('span');
        span.className = 'selected-text';
        span.textContent = label + ' selected';
        indicator.appendChild(span);
        indicator.appendChild(document.createTextNode(' — return to terminal to continue'));
      } else {
        indicator.textContent = '';
        const span = document.createElement('span');
        span.className = 'selected-text';
        span.textContent = selected.length + ' selected';
        indicator.appendChild(span);
        indicator.appendChild(document.createTextNode(' — return to terminal to continue'));
      }
    }, 0);
  });

  // Frame UI: selection tracking
  window.selectedChoice = null;

  window.toggleSelect = function(el) {
    const container = el.closest('.options') || el.closest('.cards');
    const multi = container && container.dataset.multiselect !== undefined;
    if (container && !multi) {
      container.querySelectorAll('.option, .card').forEach(o => o.classList.remove('selected'));
    }
    if (multi) {
      el.classList.toggle('selected');
    } else {
      el.classList.add('selected');
    }
    window.selectedChoice = el.dataset.choice;
  };

  // Expose API for explicit use
  window.brainstorm = {
    send: sendEvent,
    choice: (value, metadata = {}) => sendEvent({ type: 'choice', value, ...metadata })
  };

  connect();
})();
