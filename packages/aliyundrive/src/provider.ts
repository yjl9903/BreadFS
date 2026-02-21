import { createHash } from 'node:crypto';
import { posix as path } from 'node:path';

import type {
  BreadFSProvider,
  CopyOptions,
  MakeDirectoryOptions,
  MoveOptions,
  ListOptions,
  ReadFileOptions,
  RawFileStat,
  RemoveOptions,
  StatOptions,
  WriteFileOptions,
  ReadStreamOptions,
  WriteStreamOptions
} from '@breadfs/core';

import type {
  AlipanType,
  AliyunDriveProviderOptions,
  CreateResponse,
  DriveInfoResponse,
  ErrResp,
  DriveType,
  FileItem,
  LivpDownloadFormat,
  LinkResponse,
  ListResponse,
  MoveCopyResponse,
  OrderBy,
  OrderDirection,
  RemoveMethod,
  AliyunDriveRefreshMode
} from './types';

import { AliyunDriveError } from './error';
import { AliyunLimiter, LimiterType, getLimiterForUser } from './limiter';
import { API_URL_DEFAULT, TOKEN_ERROR_CODES, globalLimiterUserId } from './constants';
import {
  concatChunks,
  getItemName,
  getPartSize,
  makePartInfoList,
  normalizePath,
  toNumber
} from './utils';

type ResolvedRefreshOptions = {
  token: string;
  mode: AliyunDriveRefreshMode;
  onlineEndpoint: string;
  onlineType: AlipanType;
  clientId?: string;
  clientSecret?: string;
};

type ResolvedOptions = {
  apiUrl: string;
  driveType: DriveType;
  rootId: string;
  orderBy?: OrderBy;
  orderDirection?: OrderDirection;
  removeMethod: RemoveMethod;
  rapidUpload: boolean;
  internalUpload: boolean;
  livpDownloadFormat: LivpDownloadFormat;
  refresh: ResolvedRefreshOptions;
};

const resolveOptions = (options: AliyunDriveProviderOptions): ResolvedOptions => {
  const base = {
    apiUrl: options.apiUrl ?? API_URL_DEFAULT,
    driveType: options.driveType ?? 'default',
    rootId: options.rootId ?? 'root',
    orderBy: options.orderBy,
    orderDirection: options.orderDirection,
    removeMethod: options.removeMethod ?? 'trash',
    rapidUpload: options.rapidUpload ?? false,
    internalUpload: options.internalUpload ?? false,
    livpDownloadFormat: options.livpDownloadFormat ?? 'jpeg'
  };

  const refresh = options.refresh;
  const token = refresh.token;
  const mode = 'clientId' in refresh && 'clientSecret' in refresh ? 'local' : 'online';
  const onlineEndpoint = 'endpoint' in refresh ? refresh?.endpoint : undefined;
  const onlineType = ('type' in refresh ? refresh?.type : undefined) ?? 'default';
  const clientId = 'clientId' in refresh ? refresh?.clientId : undefined;
  const clientSecret = 'clientSecret' in refresh ? refresh?.clientSecret : undefined;

  if (!token) {
    throw new Error('refresh token is required');
  }

  if (mode === 'local' && (!clientId || !clientSecret)) {
    throw new Error('empty clientId or clientSecret');
  }

  return {
    ...base,
    refresh: {
      token,
      mode,
      onlineEndpoint: onlineEndpoint!,
      onlineType,
      clientId,
      clientSecret
    }
  };
};

export class AliyunDriveProvider implements BreadFSProvider<'aliyundrive'> {
  public readonly name = 'aliyundrive';

  public readonly options: ResolvedOptions;

  private accessToken = '';
  private refreshTokenValue: string;
  private driveId = '';
  private userId = '';
  private limiter: AliyunLimiter;
  private initPromise?: Promise<void>;
  private refreshPromise?: Promise<void>;

  public constructor(options: AliyunDriveProviderOptions) {
    this.options = resolveOptions(options);
    this.refreshTokenValue = this.options.refresh.token;
    this.limiter = getLimiterForUser(globalLimiterUserId);
  }

  public static of(options: AliyunDriveProviderOptions) {
    return new AliyunDriveProvider(options);
  }

  public createReadStream(pathInput: string, _options: ReadStreamOptions) {
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          const file = await this.resolvePath(pathInput);
          if (!file) {
            throw new Error(`${pathInput} not found`);
          }
          if (file.type === 'folder') {
            throw new Error(`${pathInput} is a directory`);
          }
          const url = await this.getDownloadUrl(file);
          const res = await fetch(url);
          if (!res.ok || !res.body) {
            throw new Error(`Download failed with status ${res.status}`);
          }
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  public createWriteStream(pathInput: string, options: WriteStreamOptions) {
    let length = 0;
    const chunks: Uint8Array[] = [];

    return new WritableStream<Uint8Array>({
      write(chunk) {
        const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        chunks.push(data);
        length += data.byteLength;
      },
      close: async () => {
        if (options.contentLength !== undefined && options.contentLength !== length) {
          throw new Error('contentLength mismatch');
        }
        const buffer = concatChunks(chunks, length);
        await this.writeFile(pathInput, buffer, {});
      }
    });
  }

  public async mkdir(pathInput: string, options: MakeDirectoryOptions): Promise<void> {
    await this.ensureReady();
    const normalized = normalizePath(pathInput);
    if (normalized === '/') return;

    const recursive = options.recursive ?? true;
    const parts = normalized.split('/').filter(Boolean);
    let parentId = this.options.rootId;
    let currentPath = '';

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      currentPath = path.join(currentPath || '/', part);
      const existing = await this.resolvePath(currentPath);
      if (existing) {
        if (existing.type !== 'folder') {
          throw new Error(`Can not create directory over file: ${currentPath}`);
        }
        parentId = existing.file_id;
        continue;
      }

      if (!recursive && i < parts.length - 1) {
        throw new Error(`Missing parent directory: ${path.dirname(currentPath)}`);
      }

      const created = await this.createDirectory(parentId, part);
      parentId = created.file_id;
    }
  }

  public async readFile(pathInput: string, options: ReadFileOptions): Promise<Uint8Array> {
    const file = await this.resolvePath(pathInput);
    if (!file) {
      throw new Error(`${pathInput} not found`);
    }
    if (file.type === 'folder') {
      throw new Error(`${pathInput} is a directory`);
    }

    const url = await this.getDownloadUrl(file);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }

    if (!res.body || !options.onProgress) {
      const buffer = await res.arrayBuffer();
      return new Uint8Array(buffer);
    }

    const total = toNumber(res.headers.get('content-length'));
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        options.onProgress?.({ current: received, total });
      }
    }

    return concatChunks(chunks, received);
  }

  public async writeFile(
    pathInput: string,
    buffer: Buffer | Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    await this.ensureReady();
    const normalized = normalizePath(pathInput);
    const parentPath = path.dirname(normalized);
    const name = path.basename(normalized);

    const parent = await this.resolvePath(parentPath);
    if (!parent || parent.type !== 'folder') {
      throw new Error(`Parent directory not found: ${parentPath}`);
    }

    const existing = await this.resolvePath(normalized);
    if (existing) {
      if (existing.type === 'folder') {
        throw new Error(`Can not write file over directory: ${normalized}`);
      }
      await this.remove(normalized, { recursive: true, force: true });
    }

    const payload = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    await this.uploadBuffer(parent.file_id, name, payload, options);
  }

  public async copy(src: string, dst: string, options: CopyOptions): Promise<void> {
    await this.ensureReady();
    const srcStat = await this.stat(src).catch(() => undefined);
    if (!srcStat) {
      throw new Error(`${src} not found`);
    }

    if (srcStat.isFile()) {
      const dstStat = await this.stat(dst).catch(() => undefined);
      if (dstStat && dstStat.isDirectory()) {
        throw new Error(`Can not copy file to directory ${dst}`);
      }
      await this.copyFile(src, dst, options);
      return;
    }

    if (srcStat.isDirectory()) {
      const dstStat = await this.stat(dst).catch(() => undefined);
      if (dstStat && !dstStat.isDirectory()) {
        throw new Error(`Can not copy directory to file ${dst}`);
      }
      if (!dstStat) {
        await this.mkdir(dst, { recursive: true });
      }
      const entries = await this.listStat(src, { recursive: false });
      for (const entry of entries) {
        const name = path.basename(entry.path);
        const target = path.join(normalizePath(dst), name);
        if (entry.isDirectory()) {
          await this.copy(entry.path, target, options);
        } else if (entry.isFile()) {
          await this.copyFile(entry.path, target, options);
        } else {
          throw new Error('Not support copy other file types');
        }
      }
      return;
    }

    throw new Error('Not support copy other file types');
  }

  public async move(src: string, dst: string, options: MoveOptions): Promise<void> {
    await this.ensureReady();
    const srcStat = await this.stat(src).catch(() => undefined);
    if (!srcStat) {
      throw new Error(`${src} not found`);
    }

    if (srcStat.isFile()) {
      const dstStat = await this.stat(dst).catch(() => undefined);
      if (dstStat && dstStat.isDirectory()) {
        throw new Error(`Can not move file to directory ${dst}`);
      }
      await this.moveFile(src, dst, options);
      return;
    }

    if (srcStat.isDirectory()) {
      const dstStat = await this.stat(dst).catch(() => undefined);
      if (dstStat && !dstStat.isDirectory()) {
        throw new Error(`Can not move directory to file ${dst}`);
      }
      if (!dstStat) {
        await this.mkdir(dst, { recursive: true });
      }
      const entries = await this.listStat(src, { recursive: false });
      for (const entry of entries) {
        const name = path.basename(entry.path);
        const target = path.join(normalizePath(dst), name);
        if (entry.isDirectory()) {
          await this.move(entry.path, target, options);
        } else if (entry.isFile()) {
          await this.moveFile(entry.path, target, options);
        } else {
          throw new Error('Not support move other file types');
        }
      }
      await this.remove(src, { recursive: true, force: true });
      return;
    }

    throw new Error('Not support move other file types');
  }

  public async remove(pathInput: string, options: RemoveOptions): Promise<void> {
    await this.ensureReady();
    const file = await this.resolvePath(pathInput);
    if (!file) {
      if (options.force ?? true) return;
      throw new Error(`${pathInput} not found`);
    }

    const uri =
      this.options.removeMethod === 'delete'
        ? '/adrive/v1.0/openFile/delete'
        : '/adrive/v1.0/openFile/recyclebin/trash';
    await this.request(LimiterType.Other, uri, 'POST', {
      drive_id: this.driveId,
      file_id: file.file_id
    });
  }

  public async stat(pathInput: string, _options: StatOptions = {}): Promise<RawFileStat> {
    const normalized = normalizePath(pathInput);
    const file = await this.resolvePath(normalized);
    if (!file) {
      throw new Error(`${normalized} not found`);
    }
    return this.toRawFileStat(file, normalized);
  }

  public async exists(pathInput: string): Promise<boolean> {
    try {
      return Boolean(await this.resolvePath(pathInput));
    } catch {
      return false;
    }
  }

  public async list(pathInput: string, options: ListOptions): Promise<string[]> {
    await this.ensureReady();
    const normalized = normalizePath(pathInput);
    const file = await this.resolvePath(normalized);
    if (!file) {
      throw new Error(`${normalized} not found`);
    }
    if (file.type !== 'folder') {
      throw new Error(`${normalized} is not a directory`);
    }

    const results: string[] = [];
    await this.collectList(normalized, file.file_id, results, options.recursive ?? false);
    return results;
  }

  public async listStat(pathInput: string, options: ListOptions): Promise<RawFileStat[]> {
    await this.ensureReady();
    const normalized = normalizePath(pathInput);
    const file = await this.resolvePath(normalized);
    if (!file) {
      throw new Error(`${normalized} not found`);
    }
    if (file.type !== 'folder') {
      throw new Error(`${normalized} is not a directory`);
    }

    const results: RawFileStat[] = [];
    await this.collectListStat(normalized, file.file_id, results, options.recursive ?? false);
    return results;
  }

  private async copyFile(src: string, dst: string, options: CopyOptions): Promise<void> {
    const srcItem = await this.resolvePath(src);
    if (!srcItem) {
      throw new Error(`${src} not found`);
    }

    const dstNormalized = normalizePath(dst);
    const dstParentPath = path.dirname(dstNormalized);
    const dstName = path.basename(dstNormalized);

    const dstParent = await this.resolvePath(dstParentPath);
    if (!dstParent || dstParent.type !== 'folder') {
      throw new Error(`Destination parent not found: ${dstParentPath}`);
    }

    if (!options.overwrite && (await this.exists(dstNormalized))) {
      throw new Error(`${dstNormalized} is existed`);
    }

    if (options.overwrite && (await this.exists(dstNormalized))) {
      await this.remove(dstNormalized, { recursive: true, force: true });
    }

    const resp = await this.request<MoveCopyResponse>(
      LimiterType.Other,
      '/adrive/v1.0/openFile/copy',
      'POST',
      {
        drive_id: this.driveId,
        file_id: srcItem.file_id,
        to_parent_file_id: dstParent.file_id,
        auto_rename: false
      }
    );

    const srcName = getItemName(srcItem);
    if (dstName !== srcName && resp.file_id) {
      await this.request(LimiterType.Other, '/adrive/v1.0/openFile/update', 'POST', {
        drive_id: this.driveId,
        file_id: resp.file_id,
        name: dstName
      });
    }
  }

  private async moveFile(src: string, dst: string, options: MoveOptions): Promise<void> {
    const srcItem = await this.resolvePath(src);
    if (!srcItem) {
      throw new Error(`${src} not found`);
    }

    const dstNormalized = normalizePath(dst);
    const dstParentPath = path.dirname(dstNormalized);
    const dstName = path.basename(dstNormalized);

    const dstParent = await this.resolvePath(dstParentPath);
    if (!dstParent || dstParent.type !== 'folder') {
      throw new Error(`Destination parent not found: ${dstParentPath}`);
    }

    if (!options.overwrite && (await this.exists(dstNormalized))) {
      throw new Error(`${dstNormalized} is existed`);
    }

    if (options.overwrite && (await this.exists(dstNormalized))) {
      await this.remove(dstNormalized, { recursive: true, force: true });
    }

    const payload: Record<string, unknown> = {
      drive_id: this.driveId,
      file_id: srcItem.file_id,
      to_parent_file_id: dstParent.file_id,
      check_name_mode: 'ignore'
    };

    const srcName = getItemName(srcItem);
    if (dstName !== srcName) {
      payload.new_name = dstName;
    }

    await this.request(LimiterType.Other, '/adrive/v1.0/openFile/move', 'POST', payload);
  }

  private async collectList(
    parentPath: string,
    parentId: string,
    output: string[],
    recursive: boolean
  ): Promise<void> {
    const items = await this.listByParentId(parentId);
    for (const item of items) {
      const name = getItemName(item);
      if (!name) continue;
      const fullPath = path.join(parentPath, name);
      output.push(fullPath);
      if (recursive && item.type === 'folder') {
        await this.collectList(fullPath, item.file_id, output, recursive);
      }
    }
  }

  private async collectListStat(
    parentPath: string,
    parentId: string,
    output: RawFileStat[],
    recursive: boolean
  ): Promise<void> {
    const items = await this.listByParentId(parentId);
    for (const item of items) {
      const name = getItemName(item);
      if (!name) continue;
      const fullPath = path.join(parentPath, name);
      output.push(this.toRawFileStat(item, fullPath));
      if (recursive && item.type === 'folder') {
        await this.collectListStat(fullPath, item.file_id, output, recursive);
      }
    }
  }

  private toRawFileStat(item: FileItem, fullPath: string): RawFileStat {
    const isDirectory = item.type === 'folder';
    return {
      path: fullPath,
      size: isDirectory ? undefined : (item.size ?? 0),
      isFile: () => !isDirectory,
      isDirectory: () => isDirectory,
      isSymbolicLink: () => false,
      mtime: item.updated_at ? new Date(item.updated_at) : undefined,
      birthtime: item.created_at ? new Date(item.created_at) : undefined
    };
  }

  private async ensureReady(): Promise<void> {
    if (this.driveId) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await this.ensureAccessToken();
      const info = await this.request<DriveInfoResponse>(
        LimiterType.Other,
        '/adrive/v1.0/user/getDriveInfo',
        'POST'
      );
      const driveKey = `${this.options.driveType}_drive_id` as keyof DriveInfoResponse;
      const driveId =
        info[driveKey] ?? info.default_drive_id ?? info.resource_drive_id ?? info.backup_drive_id;
      if (!driveId) {
        throw new Error('Failed to resolve drive id');
      }
      this.driveId = driveId;

      const userId = info.user_id ?? '';
      if (userId && userId !== this.userId) {
        this.userId = userId;
        this.limiter = getLimiterForUser(userId);
      }
    })();

    return this.initPromise;
  }

  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken) return;
    await this.refreshToken();
  }

  private async refreshToken(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const refresh = this.options.refresh;
      if (refresh.mode === 'online') {
        const driverTxt = refresh.onlineType === 'alipanTV' ? 'alicloud_tv' : 'alicloud_qr';
        const url = new URL(refresh.onlineEndpoint);
        url.searchParams.set('refresh_ui', this.refreshTokenValue);
        url.searchParams.set('server_use', 'true');
        url.searchParams.set('driver_txt', driverTxt);

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error(`failed to request ${url.toString()}`);
        }

        const data = (await res.json()) as {
          refresh_token?: string;
          access_token?: string;
          text?: string;
        };
        if (!data.refresh_token || !data.access_token) {
          if (data.text) {
            throw new Error(`failed to refresh token: ${data.text}`);
          }
          throw new Error('empty token returned from online API');
        }

        this.refreshTokenValue = data.refresh_token;
        this.accessToken = data.access_token;
        return;
      }

      if (!refresh.clientId || !refresh.clientSecret) {
        throw new Error('empty clientId or clientSecret');
      }

      const res = await fetch(`${this.options.apiUrl}/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: refresh.clientId,
          client_secret: refresh.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshTokenValue
        })
      });
      if (!res.ok) {
        throw new Error(`failed to request ${this.options.apiUrl}/oauth/access_token`);
      }

      const data = (await res.json()) as ErrResp & {
        refresh_token?: string;
        access_token?: string;
      };
      if (data.code) {
        throw new AliyunDriveError(data.code, data.message);
      }
      if (!data.refresh_token || !data.access_token) {
        throw new Error('failed to refresh token: missing token');
      }

      const curSub = this.getTokenSub(this.refreshTokenValue);
      const nextSub = this.getTokenSub(data.refresh_token);
      if (curSub !== nextSub) {
        throw new Error('failed to refresh token: sub not match');
      }

      this.refreshTokenValue = data.refresh_token;
      this.accessToken = data.access_token;
    })();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  private getTokenSub(token: string): string {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('not a jwt token because of invalid segments');
    }
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const data = JSON.parse(payload) as { sub?: string };
    if (!data.sub) {
      throw new Error('failed to decode jwt token');
    }
    return data.sub;
  }

  private async request<T>(
    type: LimiterType,
    uri: string,
    method: string,
    body?: unknown,
    retry = false
  ): Promise<T> {
    if (!this.accessToken) {
      await this.refreshToken();
    }

    await this.limiter.wait(type);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`
    };
    if (method.toUpperCase() === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${this.options.apiUrl}${uri}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      throw new Error(`failed to request ${this.options.apiUrl}${uri}`);
    }

    const text = await res.text();
    let data: ErrResp & Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text) as ErrResp & Record<string, unknown>;
      } catch {
        throw new Error(`Invalid JSON response from ${uri}`);
      }
    }
    const code = (data as ErrResp).code;

    if (!res.ok && !code) {
      if (!retry && res.status === 401) {
        await this.refreshToken();
        return this.request(type, uri, method, body, true);
      }
      throw new Error(`Request failed with status ${res.status}`);
    }

    if (code) {
      if (!retry && (TOKEN_ERROR_CODES.has(code) || !this.accessToken)) {
        await this.refreshToken();
        return this.request(type, uri, method, body, true);
      }
      throw new AliyunDriveError(code, (data as ErrResp).message);
    }

    return data as T;
  }

  private async resolvePath(pathInput: string): Promise<FileItem | null> {
    await this.ensureReady();
    const normalized = normalizePath(pathInput);
    if (normalized === '/') {
      return {
        file_id: this.options.rootId,
        name: 'root',
        type: 'folder'
      };
    }

    const parts = normalized.split('/').filter(Boolean);
    let parentId = this.options.rootId;
    let current: FileItem | null = null;

    for (const part of parts) {
      const items = await this.listByParentId(parentId);
      const next = items.find((item) => getItemName(item) === part);
      if (!next) {
        return null;
      }
      current = next;
      parentId = next.file_id;
    }

    return current;
  }

  private async listByParentId(parentId: string): Promise<FileItem[]> {
    await this.ensureReady();
    const items: FileItem[] = [];
    let marker = '';
    while (marker !== undefined) {
      const payload: Record<string, unknown> = {
        drive_id: this.driveId,
        parent_file_id: parentId,
        limit: 200,
        marker
      };
      if (this.options.orderBy) {
        payload.order_by = this.options.orderBy;
      }
      if (this.options.orderDirection) {
        payload.order_direction = this.options.orderDirection;
      }
      const res = await this.request<ListResponse>(
        LimiterType.List,
        '/adrive/v1.0/openFile/list',
        'POST',
        payload
      );
      if (res.items?.length) {
        items.push(...res.items);
      }
      marker = res.next_marker ?? '';
      if (!marker) break;
    }
    return items;
  }

  private async getDownloadUrl(file: FileItem): Promise<string> {
    const res = await this.request<LinkResponse>(
      LimiterType.Link,
      '/adrive/v1.0/openFile/getDownloadUrl',
      'POST',
      {
        drive_id: this.driveId,
        file_id: file.file_id,
        expire_sec: 14400
      }
    );
    let url = res.url ?? '';
    if (!url && getItemName(file).toLowerCase().endsWith('.livp')) {
      const streams = res.streamsUrl ?? res.streams_url ?? {};
      url = streams[this.options.livpDownloadFormat] ?? '';
    }
    if (!url) {
      throw new Error('get download url failed');
    }
    return url;
  }

  private async createDirectory(parentId: string, name: string): Promise<FileItem> {
    return this.request<FileItem>(LimiterType.Other, '/adrive/v1.0/openFile/create', 'POST', {
      drive_id: this.driveId,
      parent_file_id: parentId,
      name,
      type: 'folder',
      check_name_mode: 'refuse'
    });
  }

  private async uploadBuffer(
    parentId: string,
    name: string,
    buffer: Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    const size = buffer.byteLength;
    const partSize = getPartSize(size);
    const count = partSize === 0 ? 0 : Math.ceil(size / partSize);
    const now = new Date().toISOString();

    const createPayload: Record<string, unknown> = {
      drive_id: this.driveId,
      parent_file_id: parentId,
      name,
      type: 'file',
      check_name_mode: 'ignore',
      local_modified_at: now,
      local_created_at: now,
      part_info_list: makePartInfoList(count)
    };

    const rapidUpload = this.options.rapidUpload && size > 100 * 1024 && buffer.byteLength >= 1024;
    if (rapidUpload) {
      const preHash = createHash('sha1').update(buffer.subarray(0, 1024)).digest('hex');
      createPayload.size = size;
      createPayload.pre_hash = preHash;
    }

    let createResp: CreateResponse | null = null;
    try {
      createResp = await this.request<CreateResponse>(
        LimiterType.Other,
        '/adrive/v1.0/openFile/create',
        'POST',
        createPayload
      );
    } catch (error) {
      if (error instanceof AliyunDriveError && error.code === 'PreHashMatched' && rapidUpload) {
        const hash = createHash('sha1').update(buffer).digest('hex');
        const proofCode = this.calcProofCode(buffer);
        delete createPayload.pre_hash;
        createPayload.proof_version = 'v1';
        createPayload.content_hash_name = 'sha1';
        createPayload.content_hash = hash;
        createPayload.proof_code = proofCode;
        createResp = await this.request<CreateResponse>(
          LimiterType.Other,
          '/adrive/v1.0/openFile/create',
          'POST',
          createPayload
        );
      } else {
        throw error;
      }
    }

    if (!createResp) {
      throw new Error('failed to create upload session');
    }

    if (!createResp.rapid_upload && createResp.part_info_list?.length) {
      let uploaded = 0;
      for (let i = 0; i < createResp.part_info_list.length; i += 1) {
        const part = createResp.part_info_list[i];
        const start = i * partSize;
        const end = Math.min(start + partSize, size);
        const chunk = buffer.subarray(start, end);
        const uploadUrl = part.upload_url ?? part.uploadUrl;
        if (!uploadUrl) {
          throw new Error('missing upload url');
        }
        await this.uploadPart(uploadUrl, chunk);
        uploaded += chunk.byteLength;
        options.onProgress?.({ current: uploaded, total: size });
      }
    }

    await this.request(LimiterType.Other, '/adrive/v1.0/openFile/complete', 'POST', {
      drive_id: this.driveId,
      file_id: createResp.file_id,
      upload_id: createResp.upload_id
    });
  }

  private calcProofCode(buffer: Uint8Array): string {
    if (buffer.byteLength === 0) return '';
    const md5 = createHash('md5').update(this.accessToken).digest('hex').slice(0, 16);
    const index = Number(BigInt(`0x${md5}`) % BigInt(buffer.byteLength));
    const end = Math.min(buffer.byteLength, index + 8);
    return Buffer.from(buffer.subarray(index, end)).toString('base64');
  }

  private async uploadPart(uploadUrl: string, chunk: Uint8Array): Promise<void> {
    const url = this.options.internalUpload
      ? uploadUrl.replace(
          'https://cn-beijing-data.aliyundrive.net/',
          'http://ccp-bj29-bj-1592982087.oss-cn-beijing-internal.aliyuncs.com/'
        )
      : uploadUrl;

    const res = await fetch(url, {
      method: 'PUT',
      body: chunk as any
    });

    if (!res.ok && res.status !== 409) {
      throw new Error(`upload status: ${res.status}`);
    }
  }
}
