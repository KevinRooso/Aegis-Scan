/**
 * FocusController - Manages interactive focus and full-screen detail views
 *
 * Handles:
 * - Click-to-focus functionality
 * - Pause/resume narration
 * - Full-screen detail panel
 * - Background dimming
 */

import { useState, useCallback } from 'react';
import { ComponentId } from './useVoiceSyncManager';

export interface FocusedItem {
  componentId: ComponentId;
  data: any;
  title: string;
}

export interface FocusController {
  focusedItem: FocusedItem | null;
  isDetailPanelOpen: boolean;
  openDetailPanel: (item: FocusedItem) => void;
  closeDetailPanel: () => void;
  isFocused: (id: ComponentId) => boolean;
}

export function useFocusController(): FocusController {
  const [focusedItem, setFocusedItem] = useState<FocusedItem | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  /**
   * Open detail panel with full-screen focus
   */
  const openDetailPanel = useCallback((item: FocusedItem) => {
    setFocusedItem(item);
    setIsDetailPanelOpen(true);
  }, []);

  /**
   * Close detail panel and resume narration
   */
  const closeDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(false);
    // Delay clearing focused item for exit animation
    setTimeout(() => {
      setFocusedItem(null);
    }, 300);
  }, []);

  /**
   * Check if a component is focused
   */
  const isFocused = useCallback((id: ComponentId): boolean => {
    return focusedItem?.componentId === id;
  }, [focusedItem]);

  return {
    focusedItem,
    isDetailPanelOpen,
    openDetailPanel,
    closeDetailPanel,
    isFocused,
  };
}
