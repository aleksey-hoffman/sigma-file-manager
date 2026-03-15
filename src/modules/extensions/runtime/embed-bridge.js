// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const pending = new Map();
const toolbarHandlers = new Map();
const extensionLocaleMessages = {};
let currentLocale = 'en';

function createMemoryStorage() {
  const storage = new Map();
  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(String(key), String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    },
    key(index) {
      return Array.from(storage.keys())[index] ?? null;
    },
    get length() {
      return storage.size;
    },
  };
}

function installStorageShim(name) {
  const fallbackStorage = createMemoryStorage();
  try {
    void window[name];
  }
  catch {
    Object.defineProperty(window, name, {
      configurable: true,
      writable: false,
      value: fallbackStorage,
    });
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: false,
      value: fallbackStorage,
    });
  }
}

function formatMessage(template, params) {
  if (!params) {
    return template;
  }

  return String(template).replace(/\{(\w+)\}/g, (fullMatch, paramKey) => {
    return Object.prototype.hasOwnProperty.call(params, paramKey)
      ? String(params[paramKey])
      : fullMatch;
  });
}

function getExtensionMessagesForLocale(locale) {
  return extensionLocaleMessages[locale]
    ?? extensionLocaleMessages.en
    ?? {};
}

function translateExtensionMessage(key, params) {
  const localeMessages = getExtensionMessagesForLocale(currentLocale);
  const translated = localeMessages[key] ?? key;
  return formatMessage(translated, params);
}

function callHost(method, ...args) {
  const callId = 'api-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  parent.postMessage({
    bridgeToken,
    type: 'api-call',
    id: callId,
    method,
    args,
  }, '*');
  return new Promise((resolve, reject) => {
    pending.set(callId, { resolve, reject });
  });
}

installStorageShim('localStorage');
installStorageShim('sessionStorage');

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: text => callHost('ui.copyText', text),
    write: async (items) => {
      const serializedItems = [];
      for (const item of items) {
        const typesData = {};
        for (const mimeType of item.types) {
          const blob = await item.getType(mimeType);
          const buffer = await blob.arrayBuffer();
          typesData[mimeType] = new Uint8Array(buffer);
        }
        serializedItems.push(typesData);
      }
      return callHost('ui.clipboardWrite', serializedItems);
    },
    readText: () => Promise.reject(new Error('clipboard.readText is not available in sandboxed extensions')),
    read: () => Promise.reject(new Error('clipboard.read is not available in sandboxed extensions')),
  },
});

const nativeCreateElement = document.createElement.bind(document);
document.createElement = function shimCreateElement(tagName, options) {
  const element = nativeCreateElement(tagName, options);
  if (tagName.toLowerCase() !== 'a') {
    return element;
  }

  const nativeClick = element.click.bind(element);
  element.click = async function interceptedClick() {
    if (!this.download || !this.href || !this.href.startsWith('blob:')) {
      nativeClick();
      return;
    }

    try {
      const response = await fetch(this.href);
      const blob = await response.blob();
      const fileName = this.download || 'download';
      const dotIndex = fileName.lastIndexOf('.');
      const fileExtension = dotIndex >= 0 ? fileName.slice(dotIndex + 1) : '';
      const dialogOptions = { defaultPath: fileName };
      if (fileExtension) {
        dialogOptions.filters = [{ name: fileExtension.toUpperCase(), extensions: [fileExtension] }];
      }

      const selectedPath = await callHost('dialog.saveFile', dialogOptions);
      if (selectedPath) {
        const buffer = await blob.arrayBuffer();
        await callHost('fs.writeFile', selectedPath, new Uint8Array(buffer));
      }
    }
    catch (error) {
      console.error('Download intercept failed:', error);
    }
    finally {
      URL.revokeObjectURL(this.href);
    }
  };

  return element;
};

window.addEventListener('message', async (event) => {
  const message = event.data;
  if (!message || message.bridgeToken !== bridgeToken) {
    return;
  }

  if (message.type === 'api-response' && message.id) {
    const pendingRequest = pending.get(message.id);
    if (!pendingRequest) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      pendingRequest.reject(new Error(message.error));
      return;
    }
    pendingRequest.resolve(message.result);
    return;
  }

  if (message.type === 'toolbar-click') {
    const handler = toolbarHandlers.get(message.toolbarId);
    if (handler) {
      await handler(message.buttonId);
    }
  }
});

try {
  currentLocale = await callHost('i18n.getLocale');
}
catch {
  currentLocale = 'en';
}

try {
  const loadedMessages = await callHost('i18n.loadFromPath', 'locales');
  if (loadedMessages && typeof loadedMessages === 'object') {
    Object.assign(extensionLocaleMessages, loadedMessages);
  }
}
catch {}

const sigma = {
  commands: {
    executeCommand: (commandId, ...args) => callHost('commands.executeCommand', commandId, ...args),
    getBuiltinCommands: () => callHost('commands.getBuiltinCommands'),
  },
  context: {
    getCurrentPath: () => callHost('context.getCurrentPath'),
    getSelectedEntries: () => callHost('context.getSelectedEntries'),
    getAppVersion: () => callHost('context.getAppVersion'),
    getDownloadsDir: () => callHost('context.getDownloadsDir'),
    getPicturesDir: () => callHost('context.getPicturesDir'),
    openUrl: url => callHost('context.openUrl', url),
  },
  dialog: {
    openFile: options => callHost('dialog.openFile', options),
    saveFile: options => callHost('dialog.saveFile', options),
  },
  fs: {
    readFile: path => callHost('fs.readFile', path),
    writeFile: (path, data) => callHost('fs.writeFile', path, data),
    readDir: path => callHost('fs.readDir', path),
    exists: path => callHost('fs.exists', path),
    downloadFile: (url, path) => callHost('fs.downloadFile', url, path),
    private: {
      readFile: relativePath => callHost('fs.private.readFile', relativePath),
      writeFile: (relativePath, data) => callHost('fs.private.writeFile', relativePath, data),
      readDir: relativePath => callHost('fs.private.readDir', relativePath),
      exists: relativePath => callHost('fs.private.exists', relativePath),
      resolvePath: relativePath => callHost('fs.private.resolvePath', relativePath),
    },
    storage: {
      readFile: relativePath => callHost('fs.storage.readFile', relativePath),
      writeFile: (relativePath, data) => callHost('fs.storage.writeFile', relativePath, data),
      readDir: relativePath => callHost('fs.storage.readDir', relativePath),
      exists: relativePath => callHost('fs.storage.exists', relativePath),
      resolvePath: relativePath => callHost('fs.storage.resolvePath', relativePath),
      importFile: (sourcePath, targetRelativePath) => callHost('fs.storage.importFile', sourcePath, targetRelativePath),
      deleteFile: relativePath => callHost('fs.storage.deleteFile', relativePath),
    },
    scoped: {
      requestDirectoryAccess: options => callHost('fs.scoped.requestDirectoryAccess', options),
      getDirectories: () => callHost('fs.scoped.getDirectories'),
      readFile: path => callHost('fs.scoped.readFile', path),
      writeFile: (path, data) => callHost('fs.scoped.writeFile', path, data),
      readDir: path => callHost('fs.scoped.readDir', path),
      exists: path => callHost('fs.scoped.exists', path),
    },
  },
  ui: {
    text: content => ({ type: 'text', value: content }),
    button: options => ({
      type: 'button',
      id: options.id,
      label: options.label,
      variant: options.variant,
      size: options.size || 'xs',
      disabled: options.disabled,
    }),
    showModal: options => callHost('ui.showModal', options),
    renderToolbar: (_container, elements, onButtonClick) => {
      const toolbarId = 'toolbar-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
      if (typeof onButtonClick === 'function') {
        toolbarHandlers.set(toolbarId, onButtonClick);
      }
      parent.postMessage({
        bridgeToken,
        type: 'render-toolbar',
        toolbarId,
        elements,
      }, '*');
      return {
        unmount: () => {
          toolbarHandlers.delete(toolbarId);
          parent.postMessage({
            bridgeToken,
            type: 'unmount-toolbar',
            toolbarId,
          }, '*');
        },
      };
    },
  },
  storage: {
    get: key => callHost('storage.get', key),
    set: (key, value) => callHost('storage.set', key, value),
    remove: key => callHost('storage.remove', key),
  },
  path: {
    dirname(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const lastSlash = normalized.lastIndexOf('/');
      if (lastSlash === -1) return '.';
      if (lastSlash === 0) return '/';
      return filePath.slice(0, lastSlash);
    },
    basename(filePath, suffix) {
      const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
      const lastSlash = normalized.lastIndexOf('/');
      const base = lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
      if (suffix && base.endsWith(suffix)) {
        return base.slice(0, base.length - suffix.length);
      }
      return base;
    },
    extname(filePath) {
      const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
      const lastSlash = normalized.lastIndexOf('/');
      const base = lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
      const dotIndex = base.lastIndexOf('.');
      if (dotIndex <= 0) return '';
      return base.slice(dotIndex);
    },
  },
  i18n: {
    t: (key, params) => translateExtensionMessage(key, params),
    mergeMessages: (messages) => {
      if (messages && typeof messages === 'object') {
        Object.assign(extensionLocaleMessages, messages);
      }
      return callHost('i18n.mergeMessages', messages);
    },
    mergeFromPath: async (basePath) => {
      const loadedMessages = await callHost('i18n.loadFromPath', basePath);
      if (loadedMessages && typeof loadedMessages === 'object') {
        Object.assign(extensionLocaleMessages, loadedMessages);
        await callHost('i18n.mergeMessages', loadedMessages);
      }
    },
    extensionT: (key, params, fallback) => {
      const translated = translateExtensionMessage(key, params);
      if (translated === key && fallback !== undefined) {
        return fallback;
      }
      return translated;
    },
  },
};

const moduleUrl = URL.createObjectURL(new Blob([scriptSource], { type: 'text/javascript' }));
try {
  const mod = await import(moduleUrl);
  if (typeof mod.mount !== 'function') {
    throw new Error('Extension embed script must export mount(container, context)');
  }
  const container = document.getElementById('app');
  await mod.mount(container, {
    sigma,
    extensionId,
    toolbarContainer: {},
  });
  parent.postMessage({
    bridgeToken,
    type: 'embed-ready',
  }, '*');
}
finally {
  URL.revokeObjectURL(moduleUrl);
}
