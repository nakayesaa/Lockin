import type { LockInApi } from '../../shared/contracts';

export const isUiPreview = __LOCKIN_UI_PREVIEW__;

export function isDesktopBridgeMissing(
  api: LockInApi | undefined,
  uiPreview = isUiPreview,
): boolean {
  return !uiPreview && !api;
}
