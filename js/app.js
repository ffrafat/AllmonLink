/**
 * AllmonLink UI Application Coordinator
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
    uiConfig: {},           // Header titles, home URL, etc.
    activeConsoleNode: null // Selected node in Link Manager console
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
    authBtn: document.getElementById('auth-status-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebarClose: document.getElementById('sidebar-close-btn'),
    navContainer: document.getElementById('node-navigation-list'),
    
    dashboard: document.getElementById('dashboard-view'),
    
    consoleOverlay: document.getElementById('console-overlay'),
    consolePanel: document.getElementById('console-panel'),
    consoleClose: document.getElementById('console-close-btn'),
    consoleTitle: document.getElementById('console-title'),
    linkForm: document.getElementById('link-form'),
    linkSourceNode: document.getElementById('link-node-source'),
    linkTargetNode: document.getElementById('link-target-node'),
    linkPerm: document.getElementById('link-perm'),
    quickCmdsGrid: document.getElementById('system-commands-container'),
    customCliCmd: document.getElementById('custom-cli-cmd'),
    customCliBtn: document.getElementById('custom-cli-exec-btn'),
    consoleOutput: document.getElementById('console-output'),
    
    loginModal: document.getElementById('login-modal'),
    loginForm: document.getElementById('login-form'),
    loginUser: document.getElementById('login-user'),
    loginPass: document.getElementById('login-pass'),
    loginClose: document.getElementById('login-close-btn'),
    loginError: document.getElementById('login-error'),
    
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
    
    // Choose icon depending on type
    let iconId = '#icon-alert';
    if (type === 'success') iconId = '#icon-link';
    if (type === 'error') iconId = '#icon-unlink';

    toast.innerHTML = `
      <svg class="icon" style="width:18px;height:18px;stroke:currentColor;fill:none;"><use xlink:href="${iconId}"></use></svg>
      <span>${message}</span>
    `;
    el.toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Remove after timeout
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  };

  // Check online for updated version
  const checkForUpdates = () => {
    if (!navigator.onLine) return;
    
    // Check after a 3s delay to let the initial load complete
    setTimeout(() => {
      fetch('https://raw.githubusercontent.com/ffrafat/AllmonLink/main/version.json')
        .then(res => {
          if (!res.ok) throw new Error('Network error fetching version');
          return res.json();
        })
        .then(data => {
          if (data && data.version && data.version !== APP_VERSION) {
            showUpdateNotification(data.version);
          }
        })
        .catch(err => console.log('[Updates] Update check skipped:', err.message));
    }, 3000);
  };

  // Show a clickable notification for updates
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

  // Create a dynamic overlay modal for update details
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
          <p style="font-size:0.9rem;color:var(--text-secondary);">A new version of AllmonLink is available. To update your Pi, SSH into it and run this one-line command:</p>
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

  // --- VIEW RENDERERS ---

  // Renders the left sidebar nodes list
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
        <span>Node ${nodeId}${customName}</span>
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

  // Selects which node to focus dashboard telemetry on
  const selectActiveNode = (nodeId) => {
    // Save current active selection in localStorage
    localStorage.setItem('allmonlink_last_node', nodeId);
    
    // Clean up current WebSocket connections
    AllmonLinkTelemetry.disconnectAll();
    el.dashboard.innerHTML = '';
    
    state.activeNodes = [nodeId];
    renderSidebarNavigation();
    
    // Render loading indicator inside dashboard
    const loader = document.createElement('div');
    loader.className = 'initial-loader';
    loader.innerHTML = `
      <div class="spinner"></div>
      <p>Opening socket stream for Node ${nodeId}...</p>
    `;
    el.dashboard.appendChild(loader);

    // Fetch config to locate ws port and establish socket connection
    AllmonLinkAPI.getNodeConfig(nodeId).then(res => {
      if (res.success && res.data && res.data.statport) {
        loader.remove();
        initTelemetryStream(nodeId, res.data.statport);
      } else {
        loader.innerHTML = `
          <svg class="icon" style="width:36px;height:36px;color:var(--danger);"><use xlink:href="#icon-alert"></use></svg>
          <p style="margin-top:12px;color:var(--danger)">Node config unavailable. Server offline?</p>
        `;
        showToast(`Could not fetch WebSocket config for Node ${nodeId}`, 'error');
      }
    });
  };

  // Initiates live telemetry
  const initTelemetryStream = (nodeId, wsPort) => {
    AllmonLinkTelemetry.connect(
      nodeId,
      wsPort,
      // On Live Update: Update node layout
      (id, data, ptt) => {
        renderNodeCard(id, data, ptt);
      },
      // On Connection Error: Display card in warn state
      (id, errorMsg) => {
        renderErrorNodeCard(id, errorMsg);
      }
    );
  };

  // Render/Update dynamic node card in the main view
  const renderNodeCard = (nodeId, data, ptt) => {
    let card = document.getElementById(`card-${nodeId}`);
    
    if (!card) {
      card = document.createElement('div');
      card.id = `card-${nodeId}`;
      card.className = 'node-card';
      el.dashboard.innerHTML = ''; // Remove loader
      el.dashboard.appendChild(card);
    }

    const desc = state.overrides[nodeId] || data.DESC || 'No node details configured';
    const connCount = data.CONNS ? Object.keys(data.CONNS).length : 0;
    const uptimeStr = formatSeconds(data.UPTIME);

    // Build PTT UI accent rules
    let pttClass = 'ptt-idle';
    if (ptt.mode === 'tx-local') pttClass = 'ptt-tx';
    if (ptt.mode === 'tx-network') pttClass = 'ptt-network';
    if (ptt.mode === 'tx-telemetry') pttClass = 'ptt-network';
    
    const pttDuration = ptt.txDurationSec > 0 ? ` (${ptt.txDurationSec}s)` : '';

    // Render connection rows
    let connectionsHTML = '';
    if (data.CONNS && connCount > 0) {
      // Sort connections: active keyed first, otherwise ascending
      const sortedKeys = Object.keys(data.CONNS).sort((a, b) => {
        const aKeyed = (data.CONNKEYED && a === data.CONNKEYEDNODE) ? 1 : 0;
        const bKeyed = (data.CONNKEYED && b === data.CONNKEYEDNODE) ? 1 : 0;
        return bKeyed - aKeyed;
      });

      sortedKeys.forEach(connId => {
        const c = data.CONNS[connId];
        const isKeyed = (data.CONNKEYED && connId === data.CONNKEYEDNODE);
        const isConnecting = c.CSTATE === 'CONNECTING';
        
        let rowClass = '';
        if (isKeyed) rowClass = 'conn-keyed';
        if (isConnecting) rowClass = 'conn-connecting';
        
        const dirBadge = c.DIR === 'IN' ? '<span class="direction-badge direction-in">IN</span>' : '<span class="direction-badge direction-out">OUT</span>';
        const lastRx = isKeyed ? 'Active Now' : (c.SSU > -1 ? formatSeconds(c.SSU) + ' ago' : 'Never');

        const unlinkBtn = state.isAuthenticated ? `
          <button class="btn-unlink" data-unlink="${connId}" aria-label="Disconnect link ${connId}">
            <svg class="icon"><use xlink:href="#icon-unlink"></use></svg>
          </button>
        ` : '';

        connectionsHTML += `
          <div class="conn-item-row ${rowClass}" data-node-shortcut="${connId}">
            <div class="conn-info-col">
              <div class="conn-node-name">Node ${connId} ${dirBadge}</div>
              <div class="conn-desc">${c.DESC || 'Private / Unavailable'}</div>
              <div class="conn-metrics">
                <span>Last RX: ${lastRx}</span>
                <span>Active: ${c.CTIME}</span>
              </div>
            </div>
            ${unlinkBtn}
          </div>
        `;
      });
    } else {
      connectionsHTML = '<div class="empty-conns-row">No active links (Repeater Only)</div>';
    }

    const commandConsoleBtn = state.isAuthenticated ? `
      <button class="btn-icon-circle" id="open-console-${nodeId}" aria-label="Open Console Control">
        <svg class="icon"><use xlink:href="#icon-settings"></use></svg>
      </button>
    ` : `
      <button class="btn-icon-circle" id="lock-console-${nodeId}" aria-label="Login Required">
        <svg class="icon" style="color:var(--text-secondary)"><use xlink:href="#icon-user"></use></svg>
      </button>
    `;

    const quickControlHTML = state.isAuthenticated ? `
      <div class="card-quick-control">
        <input type="number" class="quick-node-input" placeholder="Quick Link Node #" pattern="[0-9]*" inputmode="numeric">
        <div class="quick-control-actions">
          <button class="btn btn-quick-connect">Connect</button>
          <button class="btn btn-quick-disconnect">Disconnect</button>
        </div>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="node-card-header">
        <div class="node-title-area">
          <div class="node-card-title">Node ${nodeId}</div>
          <div class="node-card-desc">${desc}</div>
          <div class="node-meta-grid">
            <span class="meta-pill">Links: ${connCount}</span>
            <span class="meta-pill">Uptime: ${uptimeStr}</span>
          </div>
        </div>
        <div class="header-controls">
          ${commandConsoleBtn}
        </div>
      </div>
      
      <div class="ptt-status-banner ${pttClass}">
        ${ptt.label}${pttDuration}
      </div>
      
      <div class="connections-section">
        <div class="section-label">Active Link Connections</div>
        <div class="connections-list">
          ${connectionsHTML}
        </div>
      </div>

      ${quickControlHTML}
    `;

    // Bind dynamic control triggers on card header settings buttons
    const ctrlBtn = card.querySelector('.btn-icon-circle');
    if (ctrlBtn) {
      ctrlBtn.addEventListener('click', () => {
        if (state.isAuthenticated) {
          openCommandConsole(nodeId);
        } else {
          toggleLoginModal(true);
        }
      });
    }

    // Bind link console quick-selection on rows click
    card.querySelectorAll('.conn-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Prevent trigger if clicking unlink button specifically
        if (e.target.closest('.btn-unlink')) return;
        
        const targetNodeId = row.dataset.nodeShortcut;
        if (state.isAuthenticated) {
          const quickInput = card.querySelector('.quick-node-input');
          if (quickInput) {
            quickInput.value = targetNodeId;
            quickInput.focus();
            showToast(`Node ${targetNodeId} selected for quick control`, 'info');
          } else {
            el.linkTargetNode.value = targetNodeId;
            openCommandConsole(nodeId);
            showToast(`Target Node ${targetNodeId} selected`, 'info');
          }
        } else {
          // Pre-populate if they login later
          el.linkTargetNode.value = targetNodeId;
          showToast('Sign in to manage links.', 'info');
        }
      });
    });

    // Bind quick unlink operations
    card.querySelectorAll('.btn-unlink').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const unlinkTarget = btn.dataset.unlink;
        executeDisconnectCommand(nodeId, unlinkTarget);
      });
    });

    // Bind card-level quick connect/disconnect operations
    if (state.isAuthenticated) {
      const quickInput = card.querySelector('.quick-node-input');
      const qConnectBtn = card.querySelector('.btn-quick-connect');
      const qDisconnectBtn = card.querySelector('.btn-quick-disconnect');

      if (qConnectBtn && qDisconnectBtn && quickInput) {
        qConnectBtn.addEventListener('click', () => {
          const targetVal = quickInput.value.trim();
          if (!targetVal) {
            showToast('Please enter a target node number.', 'error');
            return;
          }
          showToast(`Connecting Node ${targetVal}...`, 'info');
          const cmdStr = `rpt cmd ${nodeId} ilink 3 ${targetVal}`;
          AllmonLinkAPI.executeCommand(nodeId, cmdStr).then(res => {
            if (res.success) {
              showToast(`Node ${targetVal} connection request sent.`, 'success');
              quickInput.value = '';
            } else {
              showToast(res.message || 'Connection request failed.', 'error');
            }
          });
        });

        qDisconnectBtn.addEventListener('click', () => {
          const targetVal = quickInput.value.trim();
          if (!targetVal) {
            showToast('Please enter a target node number.', 'error');
            return;
          }
          executeDisconnectCommand(nodeId, targetVal);
          quickInput.value = '';
        });
      }
    }
  };

  // Render a node card in an error/disconnect state
  const renderErrorNodeCard = (nodeId, errorMessage) => {
    let card = document.getElementById(`card-${nodeId}`);
    if (!card) {
      card = document.createElement('div');
      card.id = `card-${nodeId}`;
      card.className = 'node-card';
      el.dashboard.innerHTML = '';
      el.dashboard.appendChild(card);
    }

    card.innerHTML = `
      <div class="node-card-header">
        <div class="node-title-area">
          <div class="node-card-title">Node ${nodeId}</div>
          <div class="node-card-desc">Disconnect Alert</div>
        </div>
      </div>
      <div class="ptt-status-banner ptt-idle" style="background-color:var(--danger-glow);color:var(--danger)">
        Unreachable Socket
      </div>
      <div class="connections-section" style="text-align:center;padding:32px 16px;">
        <svg class="icon" style="width:32px;height:32px;color:var(--text-secondary);stroke:currentColor;fill:none;"><use xlink:href="#icon-alert"></use></svg>
        <p style="margin-top:12px;font-size:0.9rem;color:var(--text-secondary);">${errorMessage}</p>
      </div>
    `;
  };

  // Executes quick disconnect command when clicking inline unlink button
  const executeDisconnectCommand = (nodeId, targetNode) => {
    showToast(`Disconnecting Node ${targetNode}...`, 'info');
    // Allmon3 cmd parameters: rpt cmd <node> ilink 1 <target>
    const cmdStr = `rpt cmd ${nodeId} ilink 1 ${targetNode}`;
    
    AllmonLinkAPI.executeCommand(nodeId, cmdStr).then(res => {
      if (res.success) {
        showToast(`Node ${targetNode} disconnected successfully.`, 'success');
      } else {
        showToast(res.message || 'Disconnect request failed.', 'error');
      }
    });
  };

  // --- UI DRAWER / BOTTOM SHEET / CONTROLS TOGGLES ---

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

  const toggleLoginModal = (forceState) => {
    const isShowing = forceState !== undefined ? forceState : !el.loginModal.classList.contains('active');
    
    if (isShowing) {
      el.loginModal.classList.add('active');
      el.loginUser.focus();
    } else {
      el.loginModal.classList.remove('active');
      el.loginError.style.display = 'none';
      el.loginForm.reset();
    }
  };

  const toggleConsolePanel = (forceState) => {
    const isShowing = forceState !== undefined ? forceState : !el.consolePanel.classList.contains('active');
    
    if (isShowing) {
      el.consolePanel.classList.add('active');
      el.consoleOverlay.classList.add('active');
    } else {
      el.consolePanel.classList.remove('active');
      el.consoleOverlay.classList.remove('active');
      state.activeConsoleNode = null;
    }
  };

  // Opens command slide-up bottom sheet
  const openCommandConsole = (nodeId) => {
    state.activeConsoleNode = nodeId;
    el.linkSourceNode.value = nodeId;
    el.consoleTitle.innerText = `Control Console - Node ${nodeId}`;
    
    // Clear terminal console
    el.consoleOutput.innerHTML = '<div class="cli-placeholder">Awaiting execution...</div>';
    
    // Build/Load dynamic CLI commands list templates
    loadSystemCommands(nodeId);
    toggleConsolePanel(true);
  };

  // Pulls system command templates from configs and renders them as quick keys
  const loadSystemCommands = (nodeId) => {
    el.quickCmdsGrid.innerHTML = '';
    
    AllmonLinkAPI.getSystemCommands().then(res => {
      if (res.success && res.data) {
        const cmdMap = res.data;
        
        Object.keys(cmdMap).forEach(key => {
          // Exclude voter template commands if this is normal node card
          if (key.startsWith('voter')) return;
          
          const cleanCmd = key.replace(/@/g, nodeId).replace(/'/g, '');
          const label = cmdMap[key];
          
          const cmdBtn = document.createElement('button');
          cmdBtn.className = 'btn-quick-cmd';
          cmdBtn.innerText = label;
          cmdBtn.addEventListener('click', () => {
            el.customCliCmd.value = cleanCmd;
            runCliCommand();
          });
          
          el.quickCmdsGrid.appendChild(cmdBtn);
        });
      }
    });
  };

  // --- ACTIONS LOGIC ---

  // Performs PWA login and updates state
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    el.loginError.style.display = 'none';

    const user = el.loginUser.value.trim();
    const pass = el.loginPass.value;

    AllmonLinkAPI.login(user, pass).then(res => {
      if (res.success) {
        state.isAuthenticated = true;
        updateAuthHeaderState(true);
        toggleLoginModal(false);
        showToast(`Welcome back, ${user}!`, 'success');
        
        // Refresh active dashboard view cards
        if (state.activeNodes.length > 0) {
          selectActiveNode(state.activeNodes[0]);
        }
      } else {
        el.loginError.innerText = res.message || 'Login failed. Verify credentials.';
        el.loginError.style.display = 'block';
      }
    });
  };

  const handleLogout = () => {
    AllmonLinkAPI.logout().then(() => {
      state.isAuthenticated = false;
      updateAuthHeaderState(false);
      showToast('Logged out successfully.', 'info');
      if (state.activeNodes.length > 0) {
        selectActiveNode(state.activeNodes[0]);
      }
    });
  };

  // Formats auth buttons inside header bar
  const updateAuthHeaderState = (loggedIn) => {
    if (loggedIn) {
      el.authBtn.innerHTML = '<svg class="icon" style="color:var(--danger)"><use xlink:href="#icon-logout"></use></svg>';
      el.authBtn.onclick = handleLogout;
      el.authBtn.ariaLabel = 'Sign Out';
    } else {
      el.authBtn.innerHTML = '<svg class="icon"><use xlink:href="#icon-login"></use></svg>';
      el.authBtn.onclick = () => toggleLoginModal(true);
      el.authBtn.ariaLabel = 'Sign In';
    }
  };

  // Bottom Sheet segment connect/disconnect form submission
  const handleLinkSubmit = (e) => {
    e.preventDefault();
    const nodeId = el.linkSourceNode.value;
    const targetNode = el.linkTargetNode.value.trim();
    const isPerm = el.linkPerm.value === 'yes';
    
    // Read segmented control radio value
    const selectedRadio = el.linkForm.querySelector('input[name="link-cmd"]:checked');
    if (!selectedRadio) return;
    
    let commandVal = Number(selectedRadio.value);
    
    if (!targetNode) {
      showToast('Please enter a target node number.', 'error');
      return;
    }

    // Adjust command code if permanent link requested (+10)
    if (isPerm && (commandVal === 1 || commandVal === 2 || commandVal === 3)) {
      commandVal += 10;
    }

    const cmdStr = `rpt cmd ${nodeId} ilink ${commandVal} ${targetNode}`;
    
    el.consoleOutput.innerHTML = '<div class="spinner" style="margin: 32px auto;"></div>';

    AllmonLinkAPI.executeCommand(nodeId, cmdStr).then(res => {
      if (res.success) {
        let terminalOutput = res.data;
        // Decode base64 if needed
        try { terminalOutput = atob(res.data); } catch(err) {}
        
        el.consoleOutput.innerHTML = `<div>Command Executed Successfully.</div><pre style="margin-top:8px">${terminalOutput}</pre>`;
        showToast('Link command executed.', 'success');
      } else {
        el.consoleOutput.innerHTML = `<div style="color:var(--danger)">Error: ${res.message}</div>`;
        showToast('Link command failed.', 'error');
      }
    });
  };

  // Executes arbitrary Asterisk command from Console input row
  const runCliCommand = () => {
    const cmdStr = el.customCliCmd.value.trim();
    const nodeId = state.activeConsoleNode;
    
    if (!cmdStr) return;
    if (!nodeId) return;

    el.consoleOutput.innerHTML = '<div class="spinner" style="margin: 32px auto;"></div>';

    AllmonLinkAPI.executeCommand(nodeId, cmdStr).then(res => {
      if (res.success) {
        let terminalOutput = res.data;
        // Decode base64 if needed
        try { terminalOutput = atob(res.data); } catch(err) {}
        
        el.consoleOutput.innerHTML = `<pre>${terminalOutput}</pre>`;
      } else {
        el.consoleOutput.innerHTML = `<div style="color:var(--danger)">Error: ${res.message}</div>`;
        showToast('Command failed.', 'error');
      }
    });
  };

  // --- EVENTS BINDING ---
  
  el.themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem('allmonlink_theme', isLight ? 'light' : 'dark');
    
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
  
  el.loginClose.addEventListener('click', () => toggleLoginModal(false));
  el.loginForm.addEventListener('submit', handleLoginSubmit);
  
  el.consoleClose.addEventListener('click', () => toggleConsolePanel(false));
  el.consoleOverlay.addEventListener('click', () => toggleConsolePanel(false));
  
  el.linkForm.addEventListener('submit', handleLinkSubmit);
  
  el.customCliBtn.addEventListener('click', runCliCommand);
  el.customCliCmd.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCliCommand();
    }
  });

  // --- INITIALIZATION PIPELINE ---

  const initApp = () => {
    // 0. Initialize theme setting
    const currentTheme = localStorage.getItem('allmonlink_theme') || 'dark';
    if (currentTheme === 'light') {
      document.body.classList.add('theme-light');
      el.themeToggleBtn.innerHTML = '<svg class="icon"><use xlink:href="#icon-moon"></use></svg>';
    } else {
      document.body.classList.remove('theme-light');
      el.themeToggleBtn.innerHTML = '<svg class="icon"><use xlink:href="#icon-sun"></use></svg>';
    }

    // Check for updates against remote GitHub repo
    checkForUpdates();

    // 1. Check current login authentication state
    AllmonLinkAPI.checkAuth().then(res => {
      if (res.success && res.data === 'Logged In') {
        state.isAuthenticated = true;
        updateAuthHeaderState(true);
      } else {
        state.isAuthenticated = false;
        updateAuthHeaderState(false);
      }
    });

    // 2. Fetch overrides
    AllmonLinkAPI.getOverrides().then(res => {
      if (res.success && res.data) {
        state.overrides = res.data;
      }
    });

    // 3. Fetch nodes list to initialize navigation and dashboard
    AllmonLinkAPI.getNodeList().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        state.nodes = res.data;
        renderSidebarNavigation();
        
        // Load the last active node if stored, otherwise default to first in list
        const lastNode = Number(localStorage.getItem('allmonlink_last_node'));
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
