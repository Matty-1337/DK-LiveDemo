// Mirrors upstream Mongo schemas (see docs/upstream-data-model.md).
// Field names match what the backend returns over the wire so we can pass
// the API response through verbatim without remapping.

export type ScreenType = 'Screen_Page' | 'Screen_Screenshot' | 'Screen_Video';

export type GotoType = 'screen' | 'website' | 'next' | 'none';

export interface PopupButton {
  index?: number;
  text: string;
  gotoType: GotoType;
  gotoWebsite?: string;
  gotoScreen?: string;
  textColor?: string;
  backgroundColor?: string;
}

export type PopupAlignment = 'center' | 'left' | 'right';
export type ViewType = 'hotspot' | 'pointer' | 'popup' | 'none';

export interface PopupView {
  type?: 'popup' | 'form' | 'start' | 'iframe';
  formId?: string | null;
  showOverlay?: boolean;
  title?: string;
  description?: string;
  alignment?: PopupAlignment;
  buttons?: PopupButton[];
}

export interface ScreenStepView {
  viewType: ViewType;
  popup?: PopupView;
  content?: string;
  nextButtonText?: string;
}

export interface ScreenStep {
  _id?: string;
  index?: number;
  view: ScreenStepView;
}

export interface Screen {
  _id: string;
  name?: string;
  storyId: string;
  type: ScreenType;
  index: number;
  imageUrl?: string;
  width?: number;
  height?: number;
  steps: ScreenStep[];
}

export interface Story {
  _id: string;
  name?: string;
  workspaceId?: string;
  status?: 'uploading' | 'ready' | 'failed';
  isPublished?: boolean;
  thumbnailImageUrl?: string;
  // The backend may return screens as either populated objects or raw ids
  // depending on the route — the BFF route in proxy/Caddyfile returns the
  // populated form. The MCP also fetches populated screens.
  screens: Screen[] | string[];
}

export function isPopulatedScreen(s: Screen | string): s is Screen {
  return typeof s === 'object' && s !== null && '_id' in s;
}
