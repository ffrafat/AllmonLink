/**
 * AllmonTouch UI Application Coordinator
 * Binds DOM events, handles state, and updates the layout.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- APP VERSION ---
  const APP_VERSION = '1.0.0';

  // --- STATE ---
  const state = {
    isAuthenticated: false,
    nodes: [],              // All configured node IDs
    activeNodes: [],        // Nodes currently being monitored
    overrides: {},          // Custom node descriptions
    activeDetailsNode: null, // Selected node in full details view
  };

  // --- SERVICE WORKER REGISTRATION ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.error('[PWA] Service Worker registration failed:', err));
  }

  // --- UI SELECTORS ---
  const el = {
    menuBtn: document.getElementById('menu-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebarClose: document.getElementById('sidebar-close-btn'),
    sidebarNodeTitle: document.getElementById('sidebar-node-title'),
    sidebarNodeDesc: document.getElementById('sidebar-node-description'),
    sidebarAuthSection: document.getElementById('sidebar-auth-section'),
    navContainer: document.getElementById('node-navigation-list'),
    
    dashboard: document.getElementById('dashboard-view'),
    
    nodeDetailsView: document.getElementById('node-details-view'),
    detailsBackBtn: document.getElementById('details-back-btn'),
    detailsNodeId: document.getElementById('details-node-id'),
    detailsNodeDesc: document.getElementById('details-node-desc'),
    detailsNodeDir: document.getElementById('details-node-dir'),
    detailsNodeTime: document.getElementById('details-node-time'),
    detailsNodeRx: document.getElementById('details-node-rx'),
    detailsDisconnectBtn: document.getElementById('details-disconnect-btn'),
    detailsCliInput: document.getElementById('details-cli-input'),
    detailsCliRunBtn: document.getElementById('details-cli-run-btn'),
    detailsQuickActions: document.getElementById('details-quick-actions-container'),
    detailsConsoleOutput: document.getElementById('details-console-output'),
    
    fabConnectBtn: document.getElementById('fab-connect-btn'),
    connectOverlay: document.getElementById('connect-overlay'),
    connectSheet: document.getElementById('connect-sheet'),
    connectSheetCloseBtn: document.getElementById('connect-sheet-close-btn'),
    quickConnectForm: document.getElementById('quick-connect-form'),
    qcTargetNode: document.getElementById('qc-target-node'),
    qcLinkPerm: document.getElementById('qc-link-perm'),
    favoritesBookmarksGrid: document.getElementById('favorites-bookmarks-grid'),
    
    toastContainer: document.getElementById('toast-container')
  };

  // --- HELPER FUNCTIONS ---
  
  // Format seconds to compact D h:m:s
  const formatSeconds = (seconds) => {
    seconds = Number(seconds);
    if (isNaN(seconds) || seconds <= 0) return '00:00:00';
    
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    const pad = (n) => String(n).padStart(2, '0');
    const dDisplay = d > 0 ? `${d}d ` : '';
    return `${dDisplay}${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // Display vibrant toast alerts
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconId = '#icon-alert';
    if (type === 'success') iconId = '#icon-link';
    if (type === 'error') iconId = '#icon-unlink';

    toast.innerHTML = `
      <svg class="icon" style="width:18px;height:18px;stroke:currentColor;fill:none;"><use xlink:href="${iconId}"></use></svg>
      <span>${message}</span>
    `;
    el.toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 50);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  };

  // Check online for updated version
  const checkForUpdates = () => {
    if (!navigator.onLine) return;
    
    setTimeout(() => {
      fetch('https://raw.githubusercontent.com/ffrafat/AllmonLink/main/version.json')
        .then(res => {
          if (!res.ok) throw new Error('Network error');
          return res.json();
        })
        .then(data => {
          if (data && data.version && data.version !== APP_VERSION) {
            showUpdateNotification(data.version);
          }
        })
        .catch(err => console.log('[Updates] Skip check:', err.message));
    }, 3000);
  };

  const showUpdateNotification = (newVersion) => {
    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.style.cursor = 'pointer';
    toast.style.pointerEvents = 'auto';
    toast.innerHTML = `
      <svg class="icon" style="width:18px;height:18px;stroke:currentColor;fill:none;"><use xlink:href="#icon-alert"></use></svg>
      <span style="flex:1;">Update available: v${newVersion}! Tap for details.</span>
    `;
    
    toast.addEventListener('click', () => {
      openUpdateModal(newVersion);
      toast.remove();
    });
    
    el.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
  };

  const openUpdateModal = (newVersion) => {
    const modal = document.createElement('div');
    modal.className = 'modal-container active';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Update Available (v${newVersion})</h3>
          <button class="close-btn" id="update-close-btn">&times;</button>
        </div>
        <div class="modal-body" style="gap:12px;">
          <p style="font-size:0.9rem;color:var(--text-secondary);">A new version of AllmonTouch is available. To update your Pi, SSH into it and run this one-line command:</p>
          <div style="background-color:#040506;border:1px solid var(--border-subtle);border-radius:8px;padding:12px;font-family:monospace;font-size:0.8rem;color:#17c964;word-break:break-all;user-select:all;margin:8px 0;">
            curl -sSL https://raw.githubusercontent.com/ffrafat/AllmonLink/main/install.sh | sudo bash
          </div>
          <button class="btn btn-secondary btn-block" id="update-ok-btn">OK</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => modal.remove();
    modal.querySelector('#update-close-btn').addEventListener('click', closeModal);
    modal.querySelector('#update-ok-btn').addEventListener('click', closeModal);
  };

  // --- DRAWER AUTH COMPONENT ---

  const renderSidebarAuth = () => {
    if (state.isAuthenticated) {
      el.sidebarAuthSection.innerHTML = `
        <div class="sidebar-auth-title" style="display:flex; align-items:center; gap:6px;">
          <svg class="icon-inline" style="color:var(--primary);"><use xlink:href="#icon-shield"></use></svg>
          <span>Account</span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background-color:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:10px;">
          <span style="font-weight:600; font-size:0.9rem;">Logged In</span>
          <button type="button" id="sidebar-logout-btn" class="btn btn-secondary" style="padding:6px 12px; font-size:0.75rem; border-radius:6px; display:flex; align-items:center; gap:4px;">
            <svg class="icon-inline" style="width:12px; height:12px;"><use xlink:href="#icon-logout"></use></svg>
            <span>Log Out</span>
          </button>
        </div>
      `;
      document.getElementById('sidebar-logout-btn').addEventListener('click', handleSidebarLogout);
    } else {
      el.sidebarAuthSection.innerHTML = `
        <div class="sidebar-auth-title" style="display:flex; align-items:center; gap:6px;">
          <svg class="icon-inline" style="color:var(--primary);"><use xlink:href="#icon-login"></use></svg>
          <span>Sign In</span>
        </div>
        <form id="sidebar-login-form" style="display:flex; flex-direction:column; gap:8px;">
          <div id="sidebar-login-error" class="alert alert-danger" style="display:none; padding:6px 8px; font-size:0.75rem;"></div>
          <input type="text" id="sidebar-login-user" placeholder="Username" required style="padding:10px 12px; font-size:0.9rem; border-radius:8px;">
          <input type="password" id="sidebar-login-pass" placeholder="Password" required style="padding:10px 12px; font-size:0.9rem; border-radius:8px;">
          <button type="submit" class="btn btn-primary" style="padding:10px; font-size:0.9rem; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:6px;">
            <svg class="icon-inline"><use xlink:href="#icon-login"></use></svg>
            <span>Log In</span>
          </button>
        </form>
      `;
      document.getElementById('sidebar-login-form').addEventListener('submit', handleSidebarLoginSubmit);
    }
  };

  const handleSidebarLoginSubmit = (e) => {
    e.preventDefault();
    const loginError = document.getElementById('sidebar-login-error');
    loginError.style.display = 'none';

    const user = document.getElementById('sidebar-login-user').value.trim();
    const pass = document.getElementById('sidebar-login-pass').value;

    AllmonTouchAPI.login(user, pass).then(res => {
      if (res.success) {
        state.isAuthenticated = true;
        renderSidebarAuth();
        showToast(`Welcome back, ${user}!`, 'success');
        
        if (state.activeNodes.length > 0) {
          selectActiveNode(state.activeNodes[0]);
        }
      } else {
        loginError.innerText = res.message || 'Login failed.';
        loginError.style.display = 'block';
      }
    });
  };

  const handleSidebarLogout = () => {
    AllmonTouchAPI.logout().then(() => {
      state.isAuthenticated = false;
      renderSidebarAuth();
      showToast('Logged out successfully.', 'info');
      
      if (state.activeNodes.length > 0) {
        selectActiveNode(state.activeNodes[0]);
      }
    });
  };

  // --- VIEW RENDERERS ---

  const renderSidebarNavigation = () => {
    if (state.nodes.length === 0) {
      el.navContainer.innerHTML = '<div class="nav-loading">No nodes configured.</div>';
      return;
    }

    el.navContainer.innerHTML = '';
    state.nodes.forEach(nodeId => {
      const activeClass = state.activeNodes.includes(nodeId) ? 'active' : '';
      const customName = state.overrides[nodeId] ? ` (${state.overrides[nodeId]})` : '';
      
      const item = document.createElement('a');
      item.href = `#${nodeId}`;
      item.className = `nav-item ${activeClass}`;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <svg class="icon" style="width:16px; height:16px; opacity:0.75;"><use xlink:href="#icon-node"></use></svg>
          <span>Node ${nodeId}${customName}</span>
        </div>
        <svg class="icon"><use xlink:href="#icon-chevron-right"></use></svg>
      `;
      
      item.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar(false);
        selectActiveNode(nodeId);
      });

      el.navContainer.appendChild(item);
    });
  };

  const selectActiveNode = (nodeId) => {
    localStorage.setItem('allmontouch_last_node', nodeId);
    AllmonTouchTelemetry.disconnectAll();
    el.dashboard.innerHTML = '';
    
    state.activeNodes = [nodeId];
    renderSidebarNavigation();
    
    // Update sidebar top node info block
    const customDesc = state.overrides[nodeId] || 'AllStarLink Node Monitor';
    el.sidebarNodeTitle.innerText = `Node ${nodeId}`;
    el.sidebarNodeDesc.innerText = customDesc;
    
    const loader = document.createElement('div');
    loader.className = 'initial-loader';
    loader.innerHTML = `
      <div class="spinner"></div>
      <p>Opening live telemetry stream...</p>
    `;
    el.dashboard.appendChild(loader);

    AllmonTouchAPI.getNodeConfig(nodeId).then(res => {
      if (res.success && res.data && res.data.statport) {
        loader.remove();
        initTelemetryStream(nodeId, res.data.statport);
      } else {
        loader.innerHTML = `
          <svg class="icon" style="width:32px;height:32px;color:var(--danger);"><use xlink:href="#icon-alert"></use></svg>
          <p style="margin-top:12px;color:var(--danger)">Node config unavailable. Off-line?</p>
        `;
        showToast(`Could not fetch WebSocket port for Node ${nodeId}`, 'error');
      }
    });
  };

  const initTelemetryStream = (nodeId, wsPort) => {
    AllmonTouchTelemetry.connect(
      nodeId,
      wsPort,
      (id, data, ptt) => {
        renderHomepageLayout(id, data, ptt);
      },
      (id, errorMsg) => {
        renderErrorNodeCard(id, errorMsg);
      }
    );
  };

  // Dynamic Host Card + Live SVG Animation & Compact Connected Cards grid
  // Dynamic Host Card + Live Equalizer Waveform & Compact Connected Cards grid
  const renderHomepageLayout = (nodeId, data, ptt) => {
    el.dashboard.innerHTML = ''; // Keep homepage refreshed on updates

    const desc = state.overrides[nodeId] || data.DESC || 'No node details configured';
    const connCount = data.CONNS ? Object.keys(data.CONNS).length : 0;
    const uptimeStr = formatSeconds(data.UPTIME);

    // Build PTT UI ring status & wave classes
    let ringClass = 'idle';
    let statusClass = 'status-idle';
    if (ptt.mode === 'tx-local') {
      ringClass = 'tx';
      statusClass = 'status-tx';
    } else if (ptt.mode === 'tx-network' || ptt.mode === 'tx-telemetry') {
      ringClass = 'network';
      statusClass = 'status-network';
    }
    
    const pttInfo = ptt.txDurationSec > 0 ? `${ptt.label} (${ptt.txDurationSec}s)` : ptt.label;

    // Build equalizer bars HTML
    let waveBarsHtml = '';
    for (let i = 0; i < 36; i++) {
      waveBarsHtml += '<div class="waveform-bar"></div>';
    }

    // 1. Host Node card (First Primary Card)
    const hostCard = document.createElement('div');
    hostCard.className = `node-card host-node-card ${statusClass}`;
    hostCard.innerHTML = `
      <div class="node-card-header" style="border: none;">
        <div class="node-title-area">
          <div class="node-card-title" style="display:flex; align-items:center; gap:8px;">
            <span class="status-ring ${ringClass}" title="${pttInfo}"></span>
            <svg class="icon" style="width:18px; height:18px; color:var(--text-secondary); opacity:0.8;"><use xlink:href="#icon-node"></use></svg>
            <span>Host Node ${nodeId}</span>
          </div>
          <div class="node-card-desc">${desc}</div>
          <div class="node-meta-grid">
            <span class="meta-pill" style="display:inline-flex; align-items:center; gap:4px;">
              <svg class="icon-inline" style="opacity:0.8; color:var(--primary);"><use xlink:href="#icon-link"></use></svg>
              <span>Links: ${connCount}</span>
            </span>
            <span class="meta-pill" style="display:inline-flex; align-items:center; gap:4px;">
              <svg class="icon-inline" style="opacity:0.8; color:var(--primary);"><use xlink:href="#icon-clock"></use></svg>
              <span>Uptime: ${uptimeStr}</span>
            </span>
            <span class="meta-pill" style="display:inline-flex; align-items:center; gap:4px;">
              <svg class="icon-inline" style="opacity:0.8; color:var(--primary);"><use xlink:href="#icon-activity"></use></svg>
              <span>${pttInfo}</span>
            </span>
          </div>
        </div>
      </div>
      
      <!-- Live Equalizer Waveform Visualizer -->
      <div class="live-activity-waveform">
        ${waveBarsHtml}
      </div>
    `;
    el.dashboard.appendChild(hostCard);

    // 2. Connected Nodes list header
    const listHeader = document.createElement('div');
    listHeader.className = 'section-label';
    listHeader.style.margin = '14px 4px 6px 4px';
    listHeader.style.display = 'flex';
    listHeader.style.alignItems = 'center';
    listHeader.style.gap = '6px';
    listHeader.innerHTML = `
      <svg class="icon-inline" style="opacity:0.6;"><use xlink:href="#icon-link"></use></svg>
      <span>Connected Links</span>
    `;
    el.dashboard.appendChild(listHeader);

    // 3. Compact cards list
    if (data.CONNS && connCount > 0) {
      const sortedKeys = Object.keys(data.CONNS).sort((a, b) => {
        const aKeyed = (data.CONNKEYED && a === data.CONNKEYEDNODE) ? 1 : 0;
        const bKeyed = (data.CONNKEYED && b === data.CONNKEYEDNODE) ? 1 : 0;
        return bKeyed - aKeyed;
      });

      sortedKeys.forEach(connId => {
        const c = data.CONNS[connId];
        const isKeyed = (data.CONNKEYED && connId === data.CONNKEYEDNODE);
        const isConnecting = c.CSTATE === 'CONNECTING';
        
        let cardClass = '';
        if (isKeyed) cardClass = 'conn-keyed';
        if (isConnecting) cardClass = 'conn-connecting';
        
        const dirBadge = c.DIR === 'IN' 
          ? `<span class="direction-badge direction-in" style="display:inline-flex; align-items:center; gap:2px;"><svg class="icon-inline" style="width:10px; height:10px; stroke-width:3;"><use xlink:href="#icon-arrow-down-left"></use></svg>IN</span>` 
          : `<span class="direction-badge direction-out" style="display:inline-flex; align-items:center; gap:2px;"><svg class="icon-inline" style="width:10px; height:10px; stroke-width:3;"><use xlink:href="#icon-arrow-up-right"></use></svg>OUT</span>`;
          
        const lastRx = isKeyed ? 'Active Now' : (c.SSU > -1 ? formatSeconds(c.SSU) + ' ago' : 'Never');

        const compactCard = document.createElement('div');
        compactCard.className = `node-card connected-node-card ${cardClass}`;
        compactCard.style.marginBottom = '6px';
        compactCard.innerHTML = `
          <div class="node-card-header" style="border: none; padding: 12px 14px;">
            <div class="node-title-area">
              <div class="node-card-title" style="font-size: 1rem; gap: 8px;">
                <svg class="icon" style="width:16px; height:16px; color:var(--text-secondary); opacity:0.8;"><use xlink:href="#icon-node"></use></svg>
                <span>Node ${connId}</span>
                ${dirBadge}
              </div>
              <div class="node-card-desc" style="font-size: 0.75rem;">${c.DESC || 'Private / Unavailable'}</div>
              <div class="node-meta-grid" style="font-size: 0.65rem;">
                <span class="meta-pill" style="display:inline-flex; align-items:center; gap:3px;">
                  <svg class="icon-inline" style="width:10px; height:10px; opacity:0.7;"><use xlink:href="#icon-clock"></use></svg>
                  <span>Active: ${c.CTIME}</span>
                </span>
                <span class="meta-pill" style="display:inline-flex; align-items:center; gap:3px;">
                  <svg class="icon-inline" style="width:10px; height:10px; opacity:0.7;"><use xlink:href="#icon-activity"></use></svg>
                  <span>Last RX: ${lastRx}</span>
                </span>
              </div>
            </div>
            <div class="header-controls">
              <button type="button" class="btn-icon-circle open-details-btn" data-target-node="${connId}" aria-label="Open Node Details">
                <svg class="icon" style="width: 14px; height: 14px;"><use xlink:href="#icon-chevron-right"></use></svg>
              </button>
            </div>
          </div>
        `;

        // Bind Arrow details navigation
        compactCard.querySelector('.open-details-btn').addEventListener('click', () => {
          openNodeDetailsPage(nodeId, connId, c, lastRx);
        });

        el.dashboard.appendChild(compactCard);
      });
    } else {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'empty-conns-row';
      emptyCard.innerText = 'No active links (Repeater Only)';
      el.dashboard.appendChild(emptyCard);
    }
    
    // Refresh FAB favorites just in case
    renderFavoritesBookmarks(nodeId);
  };

  const renderErrorNodeCard = (nodeId, errorMessage) => {
    el.dashboard.innerHTML = '';
    const card = document.createElement('div');
    card.id = `card-${nodeId}`;
    card.className = 'node-card';
    card.innerHTML = `
      <div class="node-card-header">
        <div class="node-title-area">
          <div class="node-card-title">Node ${nodeId}</div>
          <div class="node-card-desc">Disconnect Alert</div>
        </div>
      </div>
      <div class="connections-section" style="text-align:center;padding:32px 16px;">
        <svg class="icon" style="width:32px;height:32px;color:var(--text-secondary);stroke:currentColor;fill:none;"><use xlink:href="#icon-alert"></use></svg>
        <p style="margin-top:12px;font-size:0.9rem;color:var(--text-secondary);">${errorMessage}</p>
      </div>
    `;
    el.dashboard.appendChild(card);
  };

  // --- iOS-STYLE NODE DETAILS PAGE OVERLAY ---

  const openNodeDetailsPage = (hostNodeId, targetNodeId, connData, lastRxStr) => {
    state.activeDetailsNode = targetNodeId;
    el.detailsNodeId.innerText = `Node ${targetNodeId}`;
    el.detailsNodeDesc.innerText = connData.DESC || 'No details available';
    el.detailsNodeDir.innerText = connData.DIR || '---';
    el.detailsNodeTime.innerText = connData.CTIME || '00:00:00';
    el.detailsNodeRx.innerText = lastRxStr;
    
    // Clear terminal console output
    el.detailsConsoleOutput.innerHTML = '<div class="cli-placeholder">Awaiting command execution...</div>';
    el.detailsCliInput.value = '';
    
    // Load readymade preset buttons
    loadDetailsQuickCommands(hostNodeId, targetNodeId);
    
    // Set up disconnect trigger
    el.detailsDisconnectBtn.onclick = () => {
      handleDetailsDisconnect(hostNodeId, targetNodeId);
    };

    // Set up custom CLI runs
    el.detailsCliRunBtn.onclick = () => {
      runDetailsCliCommand(hostNodeId);
    };
    
    // Slide page in
    el.nodeDetailsView.classList.add('active');
  };

  const closeNodeDetailsPage = () => {
    el.nodeDetailsView.classList.remove('active');
    state.activeDetailsNode = null;
  };

  const loadDetailsQuickCommands = (hostNodeId, targetNodeId) => {
    el.detailsQuickActions.innerHTML = '';
    
    // Direct execution buttons mapping templates
    const presets = [
      { label: 'Uptime', cmd: 'core show uptime' },
      { label: 'Registry', cmd: 'iax2 show registry' },
      { label: 'Channels', cmd: 'iax2 show channels' },
      { label: 'Node Status', cmd: `rpt stats ${hostNodeId}` },
      { label: 'Link Status', cmd: `rpt lstats ${hostNodeId}` },
      { label: 'Test Tone', cmd: `rpt cmd ${hostNodeId} cop 4 1` }
    ];

    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-quick-cmd';
      btn.innerText = p.label;
      btn.addEventListener('click', () => {
        executeDetailsCliCommand(hostNodeId, p.cmd);
      });
      el.detailsQuickActions.appendChild(btn);
    });
  };

  const executeDetailsCliCommand = (hostNodeId, cmdStr) => {
    el.detailsConsoleOutput.innerHTML = '<div class="spinner" style="margin: 32px auto;"></div>';

    AllmonTouchAPI.executeCommand(hostNodeId, cmdStr).then(res => {
      if (res.success) {
        let out = res.data;
        try { out = atob(res.data); } catch(e) {}
        el.detailsConsoleOutput.innerHTML = `<div>Command Executed successfully.</div><pre style="margin-top:8px;">${out}</pre>`;
        showToast('Command executed successfully.', 'success');
      } else {
        el.detailsConsoleOutput.innerHTML = `<div style="color:var(--danger);">Error: ${res.message}</div>`;
        showToast(res.message || 'Command failed.', 'error');
      }
    });
  };

  const runDetailsCliCommand = (hostNodeId) => {
    const cmdStr = el.detailsCliInput.value.trim();
    if (!cmdStr) return;
    executeDetailsCliCommand(hostNodeId, cmdStr);
  };

  const handleDetailsDisconnect = (hostNodeId, targetNodeId) => {
    showToast(`Disconnecting Node ${targetNodeId}...`, 'info');
    
    const cmdStr1 = `rpt cmd ${hostNodeId} ilink 1 ${targetNodeId}`;
    const cmdStr11 = `rpt cmd ${hostNodeId} ilink 11 ${targetNodeId}`;
    
    Promise.all([
      AllmonTouchAPI.executeCommand(hostNodeId, cmdStr1),
      AllmonTouchAPI.executeCommand(hostNodeId, cmdStr11)
    ]).then(([res1, res11]) => {
      if (res1.success || res11.success) {
        showToast(`Node ${targetNodeId} disconnected successfully.`, 'success');
        closeNodeDetailsPage();
      } else {
        showToast(res1.message || res11.message || 'Disconnect failed.', 'error');
      }
    }).catch(err => {
      showToast(err.message || 'Disconnect failed.', 'error');
    });
  };

  // --- FLOATING ACTION BUTTON (FAB) & CONNECT SHEET ---

  const toggleConnectSheet = (forceState) => {
    const isShowing = forceState !== undefined ? forceState : !el.connectSheet.classList.contains('active');
    
    if (isShowing) {
      el.connectSheet.classList.add('active');
      el.connectOverlay.classList.add('active');
      el.qcTargetNode.focus();
    } else {
      el.connectSheet.classList.remove('active');
      el.connectOverlay.classList.remove('active');
      el.quickConnectForm.reset();
    }
  };

  const handleQuickConnectSubmit = (e) => {
    e.preventDefault();
    const hostNodeId = state.activeNodes[0];
    const targetNode = el.qcTargetNode.value.trim();
    const isPerm = el.qcLinkPerm.value === 'yes';
    
    if (!hostNodeId || !targetNode) return;
    
    // Command code: Connect is 3 (non-permanent) or 13 (permanent)
    const commandVal = isPerm ? 13 : 3;
    const cmdStr = `rpt cmd ${hostNodeId} ilink ${commandVal} ${targetNode}`;
    
    showToast(`Connecting Node ${targetNode}...`, 'info');
    toggleConnectSheet(false);
    
    AllmonTouchAPI.executeCommand(hostNodeId, cmdStr).then(res => {
      if (res.success) {
        showToast(`Node ${targetNode} connection request sent.`, 'success');
      } else {
        showToast(res.message || 'Connection request failed.', 'error');
      }
    });
  };

  const renderFavoritesBookmarks = (hostNodeId) => {
    el.favoritesBookmarksGrid.innerHTML = '';
    
    // Default favorites bookmarked nodes list
    const bookmarks = [
      { node: '1999', label: 'Test Node' },
      { node: '500', label: 'Hub 500' },
      { node: '40000', label: 'EchoLink' }
    ];

    bookmarks.forEach(b => {
      const badge = document.createElement('div');
      badge.className = 'fav-badge-btn';
      badge.innerHTML = `
        <svg class="icon"><use xlink:href="#icon-star"></use></svg>
        <span class="fav-node-num">${b.node}</span>
        <span class="fav-node-label">${b.label}</span>
      `;
      
      badge.addEventListener('click', () => {
        showToast(`Connecting favorite Node ${b.node}...`, 'info');
        toggleConnectSheet(false);
        const cmdStr = `rpt cmd ${hostNodeId} ilink 3 ${b.node}`;
        
        AllmonTouchAPI.executeCommand(hostNodeId, cmdStr).then(res => {
          if (res.success) {
            showToast(`Favorite Node ${b.node} connection sent.`, 'success');
          } else {
            showToast(res.message || 'Connection failed.', 'error');
          }
        });
      });
      
      el.favoritesBookmarksGrid.appendChild(badge);
    });
  };

  // --- GENERAL DRAWER/SIDEBAR DRAWER ACTION TOGGLES ---

  const toggleSidebar = (forceState) => {
    const isShowing = forceState !== undefined ? forceState : !el.sidebar.classList.contains('active');
    
    if (isShowing) {
      el.sidebar.classList.add('active');
      el.sidebarOverlay.classList.add('active');
    } else {
      el.sidebar.classList.remove('active');
      el.sidebarOverlay.classList.remove('active');
    }
  };

  // --- GENERAL EVENT BINDINGS ---
  
  el.themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem('allmontouch_theme', isLight ? 'light' : 'dark');
    
    if (isLight) {
      el.themeToggleBtn.innerHTML = '<svg class="icon"><use xlink:href="#icon-moon"></use></svg>';
      showToast('Light theme active', 'info');
    } else {
      el.themeToggleBtn.innerHTML = '<svg class="icon"><use xlink:href="#icon-sun"></use></svg>';
      showToast('AMOLED dark theme active', 'info');
    }
  });

  el.menuBtn.addEventListener('click', () => toggleSidebar(true));
  el.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
  el.sidebarClose.addEventListener('click', () => toggleSidebar(false));
  
  el.detailsBackBtn.addEventListener('click', closeNodeDetailsPage);
  
  el.detailsCliInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runDetailsCliCommand(state.activeNodes[0]);
    }
  });

  el.fabConnectBtn.addEventListener('click', () => toggleConnectSheet(true));
  el.connectOverlay.addEventListener('click', () => toggleConnectSheet(false));
  el.connectSheetCloseBtn.addEventListener('click', () => toggleConnectSheet(false));
  el.quickConnectForm.addEventListener('submit', handleQuickConnectSubmit);

  // --- INITIALIZATION PIPELINE ---

  const initApp = () => {
    // 0. Initialize theme setting
    const currentTheme = localStorage.getItem('allmontouch_theme') || 'dark';
    if (currentTheme === 'light') {
      document.body.classList.add('theme-light');
      el.themeToggleBtn.innerHTML = '<svg class="icon"><use xlink:href="#icon-moon"></use></svg>';
    } else {
      document.body.classList.remove('theme-light');
      el.themeToggleBtn.innerHTML = '<svg class="icon"><use xlink:href="#icon-sun"></use></svg>';
    }

    checkForUpdates();

    // 1. Check current login authentication state
    AllmonTouchAPI.checkAuth().then(res => {
      if (res.success && res.data === 'Logged In') {
        state.isAuthenticated = true;
      } else {
        state.isAuthenticated = false;
      }
      renderSidebarAuth();
    });

    // 2. Fetch overrides
    AllmonTouchAPI.getOverrides().then(res => {
      if (res.success && res.data) {
        state.overrides = res.data;
      }
    });

    // 3. Fetch nodes list to initialize navigation and dashboard
    AllmonTouchAPI.getNodeList().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        state.nodes = res.data;
        renderSidebarNavigation();
        
        const lastNode = Number(localStorage.getItem('allmontouch_last_node'));
        const defaultNode = state.nodes.includes(lastNode) ? lastNode : state.nodes[0];
        
        selectActiveNode(defaultNode);
      } else {
        el.dashboard.innerHTML = `
          <div class="initial-loader" style="color:var(--danger)">
            <svg class="icon" style="width:40px;height:40px;"><use xlink:href="#icon-alert"></use></svg>
            <p style="margin-top:12px;">No monitored nodes found on this server config.</p>
          </div>
        `;
      }
    });
  };

  initApp();
});
