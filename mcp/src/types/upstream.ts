// Types mirroring docs/upstream-data-model.md and docs/upstream-api.md.
// Intentionally partial — only the fields the MCP reads or writes.

export type ObjectIdString = string; // 24-hex Mongo ObjectId

export interface AuthResponse {
  id: ObjectIdString;
  email: string;
  timezone: string;
  name: string;
  token: string; // 64-hex opaque bearer
  workspaceMembers: unknown[];
  redirectPath: string;
}

export interface Workspace {
  _id: ObjectIdString;
  name: string;
  type: 'empty' | 'startup' | 'pro' | 'business';
  adminUser: ObjectIdString;
  users: ObjectIdString[];
  subscriptions: ObjectIdString[];
  liveDemos: ObjectIdString[];
  invitedEmails: string[];
  integrations: { hubspot: boolean };
  library: {
    pages: ObjectIdString[];
    screenshots: ObjectIdString[];
    videos: ObjectIdString[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceResponse {
  workspaces: Workspace[];
  newWorkspace: Workspace;
}

export type StoryStatus = 'uploading' | 'ready' | 'failed';

export interface Story {
  _id: ObjectIdString;
  name: string;
  workspaceId: ObjectIdString;
  userId: ObjectIdString;
  screens: ObjectIdString[] | Screen[]; // populated when fetched by getStoryById
  status: StoryStatus;
  isPublished: boolean;
  type: 'web' | 'desktop';
  aspectRatio?: string;
  thumbnailImageUrl?: string;
  links?: string[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmptyStoryRequest {
  name: string;
  workspaceId: ObjectIdString;
  windowMeasures?: { innerWidth: number; innerHeight: number };
  aspectRatio?: number;
  tabInfo?: Record<string, unknown>;
}

export interface CreateEmptyStoryResponse {
  _id: ObjectIdString;
}

// ------- Screens -------

export type ScreenType = 'Screen_Page' | 'Screen_Screenshot' | 'Screen_Video';

export interface Screen {
  _id: ObjectIdString;
  name: string;
  storyId: ObjectIdString;
  userId?: ObjectIdString;
  workspaceId: ObjectIdString;
  type: ScreenType;
  steps: ScreenStep[];
  customTransitions: unknown[];
  index: number;
  imageUrl?: string;
  // Screen_Page discriminator fields (populated when type === 'Screen_Page')
  contentPath?: string;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScreenRequest {
  name: string;
  content: string; // full HTML page source
  imageData: string; // base64 PNG
  width: number;
  height: number;
}

// ------- Steps (embedded in screens.steps[]) -------

export type StepViewType = 'hotspot' | 'pointer' | 'popup' | 'none';

export interface ScreenStep {
  _id: ObjectIdString;
  index: number;
  view: {
    viewType: StepViewType;
    content?: string;
    nextButtonText?: string;
    showStepNumbers?: boolean;
    showHeader?: boolean;
    showFooter?: boolean;
    pointer?: {
      selector?: string;
      selectorLocation?: { positionX: number; positionY: number; width: number; height: number };
      placement?: string;
    };
    hotspot?: {
      frameX?: number;
      frameY?: number;
      placement?: string;
    };
    popup?: {
      type?: string;
      formId?: ObjectIdString | null;
      showOverlay?: boolean;
      title?: string;
      description?: string;
      alignment?: 'center' | 'left' | 'right';
      buttons?: Array<{
        _id?: ObjectIdString;
        index?: number;
        text?: string;
        gotoType?: 'screen' | 'website' | 'next' | 'none';
        gotoWebsite?: string;
        gotoScreen?: ObjectIdString;
        textColor?: string;
        backgroundColor?: string;
      }>;
    };
  };
  action?: {
    actionType?: 'NextButton' | 'ElementClick';
    selector?: string;
  };
  autoPlayConfig?: {
    enabled?: boolean;
    type?: 'auto' | 'manual';
    delay?: number;
  };
  stepAudioId?: ObjectIdString | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStepRequest {
  index: number;
  view: { viewType: StepViewType };
}

export interface PatchStepRequest {
  view?: Partial<ScreenStep['view']>;
  action?: Partial<ScreenStep['action']>;
  autoPlayConfig?: Partial<ScreenStep['autoPlayConfig']>;
  stepAudioId?: ObjectIdString | null;
}

// ------- Forms / leads -------

export type FormType = 'step' | 'transition' | 'hubspot';

export interface Form {
  _id: ObjectIdString;
  type: FormType;
  title: string;
  fields: Array<{ label: string; name: string; type?: string; required: boolean; typeData?: unknown }>;
  hubspot?: { formId?: string; portalId?: string; embedVersion?: number };
  workspaceId: ObjectIdString;
  storyId?: ObjectIdString;
  stepId?: ObjectIdString;
  transitionId?: ObjectIdString;
  screenId?: ObjectIdString;
  liveDemoId?: ObjectIdString;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFormRequest {
  type: FormType;
  storyId?: ObjectIdString;
  transitionId?: ObjectIdString;
  stepId?: ObjectIdString;
  screenId?: ObjectIdString;
}

export interface PatchFormRequest {
  title?: string;
  type?: FormType;
  hubspot?: { formId?: string; portalId?: string; embedVersion?: number };
}

// ------- Publish / links -------

export interface PublishRequest {
  isPublished: boolean;
}

export interface StoryLink {
  _id: string; // short-uuid, not ObjectId
  name: string;
  workspaceId: ObjectIdString;
  storyId: ObjectIdString;
  variables: Array<{ name: string; value: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLinkRequest {
  name?: string;
}

// ------- Sessions / analytics -------

export interface Session {
  _id: ObjectIdString;
  workspaceId: ObjectIdString;
  storyId: ObjectIdString | { _id: ObjectIdString; name?: string };
  startTimestamp: number;
  endTimestamp?: number;
  duration?: number;
  eventsClickCount: number;
  stepsCount?: number;
  dropOffStep?: number;
  didPlay: boolean;
  didComplete: boolean;
  clientIpData?: {
    ip?: string;
    country?: string;
    city?: string;
    region?: string;
    flag?: { emoji?: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface SessionsResponse {
  storyDocs: Story[];
  sessionDocs: Session[];
  meta: {
    pagination: {
      currentPage: number;
      itemsPerPage: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}

export interface Lead {
  _id: ObjectIdString;
  formId?: ObjectIdString;
  storyId?: ObjectIdString | { _id: ObjectIdString; name?: string };
  workspaceId: ObjectIdString;
  sessionId?: ObjectIdString | { _id: ObjectIdString; clientIpData?: { country?: string; flag?: { emoji?: string } } };
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
