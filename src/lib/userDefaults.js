export const DEFAULT_USER_SETTINGS = {
  defaultChatMode: 'chat',
  responseMode: 'deep',
  theme: 'dark',
  showChatTimestamps: true,
  sidebarCollapsed: false,
  notificationsEnabled: true,
  compactMessages: false,
  minimalVisuals: true,
};

export function normalizeSettings(input = {}) {
  return {
    defaultChatMode: ['chat', 'search', 'research'].includes(input.defaultChatMode)
      ? input.defaultChatMode
      : DEFAULT_USER_SETTINGS.defaultChatMode,
    responseMode: ['deep', 'speed'].includes(input.responseMode)
      ? input.responseMode
      : DEFAULT_USER_SETTINGS.responseMode,
    theme: ['light', 'dark'].includes(input.theme) ? input.theme : DEFAULT_USER_SETTINGS.theme,
    showChatTimestamps:
      typeof input.showChatTimestamps === 'boolean'
        ? input.showChatTimestamps
        : DEFAULT_USER_SETTINGS.showChatTimestamps,
    sidebarCollapsed:
      typeof input.sidebarCollapsed === 'boolean'
        ? input.sidebarCollapsed
        : DEFAULT_USER_SETTINGS.sidebarCollapsed,
    notificationsEnabled:
      typeof input.notificationsEnabled === 'boolean'
        ? input.notificationsEnabled
        : DEFAULT_USER_SETTINGS.notificationsEnabled,
    compactMessages:
      typeof input.compactMessages === 'boolean'
        ? input.compactMessages
        : DEFAULT_USER_SETTINGS.compactMessages,
    minimalVisuals:
      typeof input.minimalVisuals === 'boolean'
        ? input.minimalVisuals
        : DEFAULT_USER_SETTINGS.minimalVisuals,
  };
}
