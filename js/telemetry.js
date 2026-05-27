/**
 * AllmonTouch Telemetry Client
 * Manages WebSocket connections to daemon nodes for real-time status tracking.
 */

const AllmonTouchTelemetry = (() => {
  const activeConnections = new Map();

  /**
   * Resolves WebSocket URLs relative to server paths
   */
  const resolveWsUrl = (port) => {
    const proto = window.location.protocol.replace('http', 'ws');
    const host = window.location.host;
    return `${proto}//${host}/allmon3/ws/${port}`;
  };

  /**
   * Analyzes raw keying status variables and returns a simplified PTT state object
   */
  const calculatePttState = (nodeData) => {
    let mode = 'idle';
    let label = 'Idle';
    let sourceNode = null;

    if (nodeData.RXKEYED === true && nodeData.TXKEYED === true) {
      mode = 'tx-local';
      label = 'TX - Local Source';
    } else if (nodeData.RXKEYED === true && nodeData.TXEKEYED === false) {
      mode = 'tx-local';
      label = 'TX - Local Source';
    } else if (nodeData.CONNKEYED === true && nodeData.TXKEYED === true && nodeData.RXKEYED === false) {
      mode = 'tx-network';
      label = 'TX - Network Source';
      sourceNode = nodeData.CONNKEYEDNODE;
    } else if (nodeData.TXKEYED === true && nodeData.RXKEYED === false && nodeData.CONNKEYED === false) {
      mode = 'tx-telemetry';
      label = 'TX - Telemetry/Playback';
    } else if (nodeData.TXKEYED === false && nodeData.RXKEYED === false && nodeData.TXEKEYED === false && nodeData.CONNKEYED === true) {
      mode = 'tx-remote-playback';
      label = `TX - Playback from Remote Node ${nodeData.CONNKEYEDNODE}`;
      sourceNode = nodeData.CONNKEYEDNODE;
    }

    return { mode, label, sourceNode };
  };

  /**
   * Connects to a node's telemetry WebSocket port
   */
  const connectNode = (nodeId, port, onUpdate, onError) => {
    // If connection already exists, clean it up first
    if (activeConnections.has(nodeId)) {
      disconnectNode(nodeId);
    }

    const wsUrl = resolveWsUrl(port);
    console.log(`[Telemetry] Connecting to Node ${nodeId} at ${wsUrl}`);
    
    let socket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      console.error(`[Telemetry] Socket init error for Node ${nodeId}:`, err);
      if (onError) onError(nodeId, 'Failed to initialize WebSocket');
      return;
    }

    const connectionState = {
      socket,
      lastUpdate: Date.now(),
      pttActive: false,
      txStartTime: 0
    };

    activeConnections.set(nodeId, connectionState);

    socket.onopen = () => {
      console.log(`[Telemetry] WebSocket active for Node ${nodeId}`);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // Check if the payload reports an error state
        if (payload[nodeId] === 'ERROR' || payload.ERROR) {
          const errorMsg = payload.ERROR || 'Unknown node connection error';
          if (onError) onError(nodeId, errorMsg);
          return;
        }

        const nodeData = payload[nodeId];
        if (!nodeData) return;

        // Process PTT durations
        const ptt = calculatePttState(nodeData);
        const state = activeConnections.get(nodeId);
        
        const isCurrentlyTransmitting = (ptt.mode !== 'idle' && ptt.mode !== 'tx-telemetry');
        
        if (isCurrentlyTransmitting) {
          if (!state.pttActive) {
            state.pttActive = true;
            state.txStartTime = Date.now();
          }
          ptt.txDurationSec = Math.floor((Date.now() - state.txStartTime) / 1000);
        } else {
          state.pttActive = false;
          state.txStartTime = 0;
          ptt.txDurationSec = 0;
        }

        // Trigger updates
        if (onUpdate) onUpdate(nodeId, nodeData, ptt);

      } catch (err) {
        console.error(`[Telemetry] Error parsing message for Node ${nodeId}:`, err);
      }
    };

    socket.onerror = (err) => {
      console.error(`[Telemetry] WebSocket error for Node ${nodeId}:`, err);
      if (onError) onError(nodeId, 'Connection encountered a socket error.');
    };

    socket.onclose = (event) => {
      console.log(`[Telemetry] WebSocket closed for Node ${nodeId}. Code: ${event.code}`);
      if (event.code !== 1000 && event.code !== 1001) {
        if (onError) onError(nodeId, 'Connection dropped unexpectedly. Reconnecting...');
        // Auto-reconnect retry after 5 seconds if not explicitly closed
        setTimeout(() => {
          if (activeConnections.has(nodeId)) {
            connectNode(nodeId, port, onUpdate, onError);
          }
        }, 5000);
      }
    };
  };

  /**
   * Disconnects an active WebSocket connection
   */
  const disconnectNode = (nodeId) => {
    const conn = activeConnections.get(nodeId);
    if (conn) {
      console.log(`[Telemetry] Closing connection to Node ${nodeId}`);
      conn.socket.close(1000, 'Explicit user disconnect');
      activeConnections.delete(nodeId);
    }
  };

  /**
   * Disconnects all active WebSockets
   */
  const disconnectAll = () => {
    for (const nodeId of activeConnections.keys()) {
      disconnectNode(nodeId);
    }
  };

  return {
    connect: connectNode,
    disconnect: disconnectNode,
    disconnectAll,
    activeConnections
  };
})();
