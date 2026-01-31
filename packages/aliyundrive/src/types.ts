/** Drive category returned by AliyunDrive OpenAPI. */
export type DriveType = 'default' | 'resource' | 'backup';
/** Listing sort field. */
export type OrderBy = 'name' | 'size' | 'updated_at' | 'created_at';
/** Listing sort order. */
export type OrderDirection = 'ASC' | 'DESC';
/** Online refresh flow type used by the helper service. */
export type AlipanType = 'default' | 'alipanTV';
/** Delete to recycle bin or permanently. */
export type RemoveWay = 'trash' | 'delete';
/** LIVP download format from streams. */
export type LivpDownloadFormat = 'jpeg' | 'mov';
/** Refresh token exchange mode. */
export type AliyunDriveRefreshMode = 'online' | 'local';

/** Online refresh settings (oplist helper). */
export interface AliyunDriveRefreshOnlineOptions {
  /** Helper service endpoint. */
  endpoint?: string;
  /** Helper service driver type. */
  type?: AlipanType;
}

/** Local refresh settings (client id/secret). */
export interface AliyunDriveRefreshLocalOptions {
  /** App client id. */
  clientId: string;
  /** App client secret. */
  clientSecret: string;
}

/** Refresh token exchange configuration. */
export interface AliyunDriveRefreshOptions {
  /** Refresh token from AliyunDrive OpenAPI. */
  token: string;
  /** Refresh mode, defaults to "online". */
  mode?: AliyunDriveRefreshMode;
  /** Online refresh configuration. */
  online?: AliyunDriveRefreshOnlineOptions;
  /** Local refresh configuration. */
  local?: AliyunDriveRefreshLocalOptions;
}

export interface AliyunDriveProviderOptions {
  /** Refresh options for access token exchange. */
  refresh: AliyunDriveRefreshOptions;
  /** OpenAPI base URL. */
  apiUrl?: string;
  /** Target drive type. */
  driveType?: DriveType;
  /** Root folder id; defaults to "root". */
  rootId?: string;
  /** Server-side sorting field. */
  orderBy?: OrderBy;
  /** Server-side sorting direction. */
  orderDirection?: OrderDirection;
  /** Remove behavior. */
  removeWay?: RemoveWay;
  /** Enable rapid upload (SHA1-based). */
  rapidUpload?: boolean;
  /** Use internal upload endpoint (Aliyun ECS Beijing). */
  internalUpload?: boolean;
  /** LIVP download format. */
  livpDownloadFormat?: LivpDownloadFormat;
}

export interface ErrResp {
  /** Error code returned by AliyunDrive. */
  code?: string;
  /** Error message returned by AliyunDrive. */
  message?: string;
}

/** Response for drive info request. */
export interface DriveInfoResponse {
  default_drive_id?: string;
  resource_drive_id?: string;
  backup_drive_id?: string;
  user_id?: string;
}

/** Response for list files request. */
export interface ListResponse {
  items?: FileItem[];
  next_marker?: string;
}

/** File metadata returned by OpenAPI. */
export interface FileItem {
  drive_id?: string;
  file_id: string;
  parent_file_id?: string;
  name?: string;
  file_name?: string;
  size?: number;
  type?: 'file' | 'folder';
  content_hash?: string;
  thumbnail?: string;
  created_at?: string;
  updated_at?: string;
}

/** Upload part info in multipart flow. */
export interface PartInfo {
  part_number: number;
  upload_url?: string;
  uploadUrl?: string;
}

/** Create/upload session response. */
export interface CreateResponse {
  file_id: string;
  upload_id: string;
  rapid_upload?: boolean;
  part_info_list?: PartInfo[];
}

/** Move/Copy response metadata. */
export interface MoveCopyResponse {
  file_id?: string;
}

/** Download link response. */
export interface LinkResponse {
  url?: string;
  streams_url?: Record<string, string>;
  streamsUrl?: Record<string, string>;
}
