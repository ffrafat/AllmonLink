/**
 * AllmonLink API Client
 * Coordinates all HTTP communication with the Allmon3 daemon.
 */

const AllmonLinkAPI = (() => {
  // Dynamically resolve base URL path relative to deployment
  const API_BASE = '/allmon3/master/';

  /**
   * Helper to perform standard GET request for JSON
   */
  const getJson = async (endpoint) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (data.SUCCESS) return { success: true, data: data.SUCCESS };
      if (data.SECURITY) return { success: false, security: true, message: data.SECURITY };
      if (data.ERROR) return { success: false, error: true, message: data.ERROR };
      return { success: true, data };
    } catch (err) {
      console.error(`API GET error [${endpoint}]:`, err);
      return { success: false, networkError: true, message: err.message };
    }
  };

  /**
   * Helper to perform POST requests using Form Data
   */
  const postForm = async (endpoint, formData) => {
    try {
      const body = new URLSearchParams(formData);
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (data.SUCCESS) return { success: true, data: data.SUCCESS };
      if (data.SECURITY) return { success: false, security: true, message: data.SECURITY };
      if (data.ERROR) return { success: false, error: true, message: data.ERROR };
      return { success: true, data };
    } catch (err) {
      console.error(`API POST error [${endpoint}]:`, err);
      return { success: false, networkError: true, message: err.message };
    }
  };

  return {
    // Session Auth operations
    checkAuth: () => getJson('auth/check'),
    
    login: (user, password) => {
      const form = new FormData();
      form.append('user', user);
      form.append('pass', password);
      form.append('action', 'login');
      return postForm('login', form);
    },
    
    logout: () => getJson('auth/logout'),

    // Node configuration fetches
    getNodeList: () => getJson('node/listall'),
    
    getNodeConfig: (nodeId) => getJson(`node/${nodeId}/config`),
    
    getNodeVoterConfig: (nodeId) => getJson(`node/${nodeId}/voter`),

    // Custom UI settings
    getUiHtml: () => getJson('ui/custom/html'),
    
    getMenu: () => getJson('ui/custom/menu'),
    
    getOverrides: () => getJson('ui/custom/overrides'),

    // Commands operations
    getSystemCommands: () => getJson('ui/custom/commands'),
    
    getNodeCommands: (nodeId) => getJson(`ui/custom/nodecommands/${nodeId}`),
    
    executeCommand: (nodeId, commandStr) => {
      const form = new FormData();
      form.append('node', nodeId);
      form.append('cmd', commandStr);
      return postForm('cmd', form);
    }
  };
})();
