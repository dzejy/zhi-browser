export function generateGMApiScript(
  scriptId: string,
  meta: {
    grant: string[]
    name: string
    version: string
    description: string
    author: string
    namespace: string
  }
): string {
  const grants = new Set(meta.grant)
  const hasNone = grants.has('none') || grants.size === 0

  return `
(function() {
  const __scriptId = ${JSON.stringify(scriptId)};
  const __scriptMeta = ${JSON.stringify({
    name: meta.name,
    version: meta.version,
    description: meta.description,
    author: meta.author,
    namespace: meta.namespace
  })};

  let __msgId = 0;
  const __pending = new Map();

  function __sendGM(method, args) {
    return new Promise((resolve, reject) => {
      const id = ++__msgId + '_' + Math.random().toString(36).slice(2);
      __pending.set(id, { resolve, reject });
      window.postMessage({
        type: 'zhi-userscript-gm-call',
        scriptId: __scriptId,
        callId: id,
        method: method,
        args: args
      }, '*');
      setTimeout(() => {
        if (__pending.has(id)) {
          __pending.delete(id);
          reject(new Error('GM API call timeout: ' + method));
        }
      }, 30000);
    });
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'zhi-userscript-gm-response' && event.data.scriptId === __scriptId) {
      const handler = __pending.get(event.data.callId);
      if (handler) {
        __pending.delete(event.data.callId);
        if (event.data.error) handler.reject(new Error(event.data.error));
        else handler.resolve(event.data.result);
      }
    }
  });

  const GM_info = {
    script: __scriptMeta,
    scriptHandler: 'Zhi Browser',
    version: '1.0.0'
  };

  function GM_addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  async function GM_getValue(key, defaultValue) {
    const result = await __sendGM('getValue', { key, defaultValue });
    return result;
  }

  async function GM_setValue(key, value) {
    await __sendGM('setValue', { key, value });
  }

  async function GM_deleteValue(key) {
    await __sendGM('deleteValue', { key });
  }

  async function GM_listValues() {
    return await __sendGM('listValues', {});
  }

  function GM_xmlhttpRequest(details) {
    const promise = __sendGM('xmlhttpRequest', {
      url: details.url,
      method: details.method || 'GET',
      headers: details.headers || {},
      data: details.data || null,
      responseType: details.responseType || '',
      timeout: details.timeout || 30000
    });

    promise.then((response) => {
      if (details.onload) details.onload(response);
    }).catch((error) => {
      if (details.onerror) details.onerror({ error: error.message });
    });

    return { abort: () => {} };
  }

  function GM_notification(textOrDetails, title, image, onclick) {
    let details;
    if (typeof textOrDetails === 'string') {
      details = { text: textOrDetails, title: title || '', image: image || '' };
    } else {
      details = textOrDetails;
    }
    __sendGM('notification', details).then(() => {
      if (onclick) onclick();
    }).catch(() => {});
  }

  function GM_setClipboard(text, type) {
    __sendGM('setClipboard', { text, type: type || 'text/plain' });
  }

  function GM_openInTab(url, options) {
    const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    __sendGM('openInTab', { url, active: opts.active !== false });
    return { close: () => {} };
  }

  function GM_registerMenuCommand(name, callback, accessKey) {
    const cmdId = __scriptId + '_cmd_' + name;
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'zhi-userscript-menu-click' && event.data.cmdId === cmdId) {
        callback();
      }
    });
    __sendGM('registerMenuCommand', { name, cmdId });
  }

  function GM_log(message) {
    console.log('[UserScript ' + __scriptMeta.name + ']', message);
  }

  const unsafeWindow = window;
  const GM = {
    info: GM_info,
    getValue: GM_getValue,
    setValue: GM_setValue,
    deleteValue: GM_deleteValue,
    listValues: GM_listValues,
    xmlHttpRequest: GM_xmlhttpRequest,
    notification: GM_notification,
    setClipboard: GM_setClipboard,
    openInTab: GM_openInTab,
    registerMenuCommand: GM_registerMenuCommand,
    addStyle: GM_addStyle,
    log: GM_log
  };

  ${
    hasNone
      ? '// @grant none - script runs in page environment'
      : `
  window.GM_info = GM_info;
  window.GM_addStyle = GM_addStyle;
  window.GM_getValue = GM_getValue;
  window.GM_setValue = GM_setValue;
  window.GM_deleteValue = GM_deleteValue;
  window.GM_listValues = GM_listValues;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_notification = GM_notification;
  window.GM_setClipboard = GM_setClipboard;
  window.GM_openInTab = GM_openInTab;
  window.GM_registerMenuCommand = GM_registerMenuCommand;
  window.GM_log = GM_log;
  window.GM = GM;
  window.unsafeWindow = unsafeWindow;
  `
  }
})();
`
}
