declare global {
  const sigma: SigmaExtensionAPI;
}

export type ExtensionType = 'api' | 'iframe' | 'webview';

/** Flat key–value map for one extension locale file (for example `locales/en.json`). */
export type ExtensionLocaleStrings = Record<string, string>;

export type ExtensionPermission
  = | 'contextMenu'
    | 'sidebar'
    | 'toolbar'
    | 'commands'
    | 'fs.read'
    | 'fs.write'
    | 'notifications'
    | 'dialogs'
    | 'shell'
    | 'clipboard'
    | 'openUrl';

export type ExtensionActivationEvent
  = | 'onStartup'
    | 'onInstall'
    | 'onUninstall'
    | 'onEnable'
    | 'onDisable'
    | 'onUpdate'
    | 'onLocaleChange'
    | `onCommand:${string}`;

export interface ExtensionPublisher {
  name: string;
  url?: string;
}

export interface ExtensionCommand {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  shortcut?: string;
}

export interface ExtensionContextMenuCondition {
  selectionType?: 'single' | 'multiple' | 'any';
  entryType?: 'file' | 'directory' | 'any';
  fileExtensions?: string[];
}

export interface ExtensionContextMenuItem {
  id: string;
  title: string;
  icon?: string;
  when?: ExtensionContextMenuCondition;
  group?: string;
  order?: number;
}

export interface ExtensionSidebarItem {
  id: string;
  title: string;
  icon: string;
  order?: number;
  url?: string;
}

export interface ExtensionToolbarDropdownItem {
  id: string;
  title: string;
  icon?: string;
  commandId?: string;
  separator?: boolean;
}

export interface ExtensionToolbarDropdown {
  id: string;
  title: string;
  icon?: string;
  items: ExtensionToolbarDropdownItem[];
}

export type ExtensionConfigurationPropertyType = 'string' | 'number' | 'boolean' | 'array';

export interface ExtensionConfigurationProperty {
  type: ExtensionConfigurationPropertyType;
  default?: unknown;
  description?: string;
  enum?: (string | number)[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: {
    type: 'string' | 'number';
  };
}

export interface ExtensionConfiguration {
  title?: string;
  properties: Record<string, ExtensionConfigurationProperty>;
}

export type ExtensionKeybindingWhen
  = | 'always'
    | 'fileSelected'
    | 'directorySelected'
    | 'singleSelected'
    | 'multipleSelected'
    | 'navigatorFocused';

export interface ExtensionKeybinding {
  command: string;
  key: string;
  when?: ExtensionKeybindingWhen;
}

export interface ExtensionContributions {
  commands?: ExtensionCommand[];
  contextMenu?: ExtensionContextMenuItem[];
  sidebar?: ExtensionSidebarItem[];
  toolbar?: ExtensionToolbarDropdown[];
  configuration?: ExtensionConfiguration;
  keybindings?: ExtensionKeybinding[];
}

export interface ExtensionEngines {
  sigmaFileManager: string;
}

export type PlatformOS = 'windows' | 'macos' | 'linux';
export type PlatformArch = 'x64' | 'arm64';

export interface ManifestBinaryAsset {
  platform: PlatformOS;
  arch?: PlatformArch[];
  downloadUrl: string;
  integrity: string;
  archive?: boolean;
  executable?: string;
}

export interface ManifestBinaryDefinition {
  id: string;
  name: string;
  version: string;
  executable?: string;
  repository?: string;
  platforms?: PlatformOS[];
  assets: ManifestBinaryAsset[];
}

export type ExtensionManifestMediaType = 'image' | 'video';

export interface ExtensionManifestMediaItem {
  title: string;
  src: string;
  type: ExtensionManifestMediaType;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  previousName?: string;
  version: string;
  publisher?: ExtensionPublisher;
  repository: string;
  license: string;
  icon?: string;
  banner?: string;
  media?: ExtensionManifestMediaItem[];
  categories?: string[];
  tags?: string[];
  extensionType: ExtensionType;
  main: string;
  permissions: ExtensionPermission[];
  activationEvents?: ExtensionActivationEvent[];
  contributes?: ExtensionContributions;
  platforms?: PlatformOS[];
  binaries?: ManifestBinaryDefinition[];
  engines: ExtensionEngines;
}

export interface Disposable {
  dispose(): void;
}

export interface ContextMenuContext {
  selectedEntries: {
    path: string;
    name: string;
    isDirectory: boolean;
    size?: number;
    extension?: string;
  }[];
}

export interface NotificationOptions {
  title: string;
  subtitle?: string;
  description?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface DialogOptions {
  title: string;
  message: string;
  type?: 'info' | 'confirm' | 'prompt';
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
}

export interface DialogResult {
  confirmed: boolean;
  value?: string;
}

export type ProgressLocation = 'notification' | 'statusBar';

export interface ProgressOptions {
  subtitle: string;
  location?: ProgressLocation;
  cancellable?: boolean;
}

export interface ProgressReport {
  subtitle?: string;
  description?: string;
  increment?: number;
  value?: number;
}

export interface Progress {
  report(value: ProgressReport): void;
}

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): Disposable;
}

export interface ExtensionDirEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number;
}

export interface ExtensionScopedDirectory {
  path: string;
  permissions: ('read' | 'write')[];
  grantedAt: number;
}

export interface ExtensionContextEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  extension: string | null;
  createdAt: number;
  modifiedAt: number;
}

export interface BuiltinCommandInfo {
  id: string;
  title: string;
  description: string;
}

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface OpenFileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileDialogFilter[];
  multiple?: boolean;
  directory?: boolean;
}

export interface SaveFileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileDialogFilter[];
}

export interface BinaryInfo {
  id: string;
  path: string;
  version?: string;
  storageVersion?: string | null;
  repository?: string;
  downloadUrl?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  latestCheckedAt?: number;
  installedAt: number;
}

export type UIElementType
  = | 'input'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'button'
    | 'separator'
    | 'text'
    | 'image'
    | 'skeleton'
    | 'alert'
    | 'previewCard'
    | 'previewCardSkeleton';

export interface UISelectOption {
  value: string;
  label: string;
}

export interface UIElement {
  type: UIElementType;
  id?: string;
  label?: string;
  placeholder?: string;
  value?: string | boolean | number;
  options?: UISelectOption[];
  rows?: number;
  variant?: 'primary' | 'secondary' | 'danger';
  tone?: 'info' | 'success' | 'warning' | 'error';
  size?: 'xs' | 'sm' | 'default' | 'lg';
  disabled?: boolean;
  subtitle?: string;
}

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
}

export interface ModalButton {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  shortcut?: KeyboardShortcut;
}

export interface ModalOptions {
  title: string;
  width?: number;
  content: UIElement[];
  buttons?: ModalButton[];
}

export interface ModalHandle {
  onSubmit(callback: (values: Record<string, unknown>, buttonId: string) => void | boolean | Promise<void | boolean>): void;
  onClose(callback: () => void): void;
  onValueChange(callback: (elementId: string, value: unknown, allValues: Record<string, unknown>) => void): void;
  close(): void;
  updateElement(id: string, updates: Partial<UIElement>): void;
  setContent(content: UIElement[]): void;
  setButtons(buttons: ModalButton[]): void;
  getValues(): Record<string, unknown>;
}

export interface ToolbarRenderHandle {
  unmount(): void;
}

export interface PlatformInfo {
  os: PlatformOS;
  arch: string;
  pathSeparator: string;
  isWindows: boolean;
  isMacos: boolean;
  isLinux: boolean;
}

export interface SigmaExtensionAPI {
  i18n: {
    t(key: string, params?: Record<string, string | number>): string;
    mergeMessages(messages: Record<string, Record<string, string>>): void;
    mergeFromPath(basePath: string): Promise<void>;
    /**
     * Resolves extension-localized strings under `extensions.<extensionId>.<key>`.
     * When no translation exists, this returns `fallback` if provided, otherwise the original `key`.
     */
    extensionT(key: string, params?: Record<string, string | number>, fallback?: string): string;
    formatMessage(template: string, params?: Record<string, string | number>): string;
  };
  contextMenu: {
    registerItem(
      item: ExtensionContextMenuItem,
      handler: (context: ContextMenuContext) => Promise<void> | void
    ): Disposable;
  };
  sidebar: {
    registerPage(page: ExtensionSidebarItem): Disposable;
  };
  toolbar: {
    registerDropdown(
      dropdown: ExtensionToolbarDropdown,
      handlers: Record<string, () => Promise<void> | void>
    ): Disposable;
  };
  commands: {
    registerCommand(
      command: ExtensionCommand,
      handler: (...args: unknown[]) => Promise<unknown> | unknown
    ): Disposable;
    executeCommand(commandId: string, ...args: unknown[]): Promise<unknown>;
    getBuiltinCommands(): BuiltinCommandInfo[];
  };
  context: {
    getCurrentPath(): string | null;
    getSelectedEntries(): ExtensionContextEntry[];
    getAppVersion(): Promise<string>;
    getDownloadsDir(): Promise<string>;
    getPicturesDir(): Promise<string>;
    openUrl(url: string): Promise<void>;
    onPathChange(callback: (path: string | null) => void): Disposable;
    onSelectionChange(callback: (entries: ExtensionContextEntry[]) => void): Disposable;
  };
  fs: {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: Uint8Array): Promise<void>;
    readDir(path: string): Promise<ExtensionDirEntry[]>;
    exists(path: string): Promise<boolean>;
    downloadFile(url: string, path: string): Promise<void>;
    private: {
      readFile(relativePath: string): Promise<Uint8Array>;
      writeFile(relativePath: string, data: Uint8Array): Promise<void>;
      readDir(relativePath?: string): Promise<ExtensionDirEntry[]>;
      exists(relativePath: string): Promise<boolean>;
      resolvePath(relativePath: string): Promise<string>;
    };
    storage: {
      readFile(relativePath: string): Promise<Uint8Array>;
      writeFile(relativePath: string, data: Uint8Array): Promise<void>;
      readDir(relativePath?: string): Promise<ExtensionDirEntry[]>;
      exists(relativePath: string): Promise<boolean>;
      resolvePath(relativePath: string): Promise<string>;
      importFile(sourcePath: string, targetRelativePath: string): Promise<string>;
      deleteFile(relativePath: string): Promise<void>;
    };
    scoped: {
      requestDirectoryAccess(options?: {
        permission?: 'read' | 'write' | 'readWrite';
        title?: string;
        defaultPath?: string;
      }): Promise<{
        granted: boolean;
        path?: string;
        permissions?: ('read' | 'write')[];
      }>;
      getDirectories(): Promise<ExtensionScopedDirectory[]>;
      readFile(path: string): Promise<Uint8Array>;
      writeFile(path: string, data: Uint8Array): Promise<void>;
      readDir(path: string): Promise<ExtensionDirEntry[]>;
      exists(path: string): Promise<boolean>;
    };
  };
  ui: {
    showNotification(options: NotificationOptions): void;
    showDialog(options: DialogOptions): Promise<DialogResult>;
    copyText(text: string): Promise<void>;
    /**
     * Writes data to the clipboard. Supported MIME types: `image/png`, `text/html`, `text/plain`.
     * When `text/html` is provided alongside `text/plain`, the plain text is used as fallback.
     * Writes the first supported representation found across items (image/png > text/html > text/plain).
     * Throws if only unsupported types are provided.
     */
    clipboardWrite(items: Record<string, Uint8Array>[]): Promise<void>;
    withProgress<T>(
      options: ProgressOptions,
      task: (progress: Progress, token: CancellationToken) => Promise<T>
    ): Promise<T>;
    createModal(options: ModalOptions): ModalHandle;
    showModal(options: ModalOptions): Promise<Record<string, unknown> | null>;
    input(options: {
      id: string;
      label?: string;
      placeholder?: string;
      value?: string;
      disabled?: boolean;
    }): UIElement;
    select(options: {
      id: string;
      label?: string;
      placeholder?: string;
      options: UISelectOption[];
      value?: string;
      disabled?: boolean;
    }): UIElement;
    checkbox(options: {
      id: string;
      label?: string;
      checked?: boolean;
      disabled?: boolean;
    }): UIElement;
    textarea(options: {
      id: string;
      label?: string;
      placeholder?: string;
      value?: string;
      rows?: number;
      disabled?: boolean;
    }): UIElement;
    separator(): UIElement;
    text(content: string): UIElement;
    alert(options: {
      title: string;
      description?: string;
      tone?: 'info' | 'success' | 'warning' | 'error';
    }): UIElement;
    image(options: {
      id?: string;
      src: string;
      alt?: string;
    }): UIElement;
    previewCard(options: {
      thumbnail: string;
      title: string;
      subtitle?: string;
    }): UIElement;
    previewCardSkeleton(): UIElement;
    skeleton(options?: {
      id?: string;
      width?: number;
      height?: number;
    }): UIElement;
    button(options: {
      id: string;
      label: string;
      variant?: 'primary' | 'secondary' | 'danger';
      size?: 'xs' | 'sm' | 'default' | 'lg';
      disabled?: boolean;
    }): UIElement;
    renderToolbar(
      container: HTMLElement,
      elements: UIElement[],
      onButtonClick?: (buttonId: string) => void
    ): ToolbarRenderHandle;
  };
  dialog: {
    openFile(options?: OpenFileDialogOptions): Promise<string | string[] | null>;
    saveFile(options?: SaveFileDialogOptions): Promise<string | null>;
  };
  shell: {
    run(
      commandPath: string,
      args?: string[]
    ): Promise<{
      code: number;
      stdout: string;
      stderr: string;
    }>;
    runWithProgress(
      commandPath: string,
      args: string[] | undefined,
      onProgress?: (payload: {
        taskId: string;
        line: string;
        isStderr: boolean;
      }) => void
    ): Promise<{
      taskId: string;
      result: Promise<{
        code: number;
        stdout: string;
        stderr: string;
      }>;
      cancel: () => Promise<void>;
    }>;
    renamePartFilesToTs(directory: string): Promise<number>;
  };
  settings: {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    getAll(): Promise<Record<string, unknown>>;
    reset(key: string): Promise<void>;
    onChange(key: string, callback: (newValue: unknown, oldValue: unknown) => void): Disposable;
  };
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
  };
  platform: {
    readonly os: PlatformOS;
    readonly arch: string;
    readonly pathSeparator: string;
    readonly isWindows: boolean;
    readonly isMacos: boolean;
    readonly isLinux: boolean;
    joinPath(...segments: string[]): string;
  };
  path: {
    dirname(filePath: string): string;
    basename(filePath: string, suffix?: string): string;
    extname(filePath: string): string;
  };
  runtime: {
    isExtensionInstallCancelledError(error: unknown): boolean;
  };
  binary: {
    getPath(id: string): Promise<string | null>;
    isInstalled(id: string): Promise<boolean>;
    getInfo(id: string): Promise<BinaryInfo | null>;
  };
}

export interface ExtensionActivationContext {
  extensionId: string;
  extensionPath: string;
  storagePath: string;
  activationEvent: ExtensionActivationEvent;
}

export interface ExtensionModule {
  activate?(context: ExtensionActivationContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

export {};
