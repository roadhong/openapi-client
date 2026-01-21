import axios, { AxiosInstance } from 'axios';
import { makeAutoObservable, runInAction } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import { createContext, useContext } from 'react';
import JSON5 from 'json5';
import YAML from 'yaml';
import { toastStore } from './ToastStore';
import type {
  ApiListItem,
  HeaderMappingRule,
  HttpResponse,
  OpenAPIParameter,
  OpenAPISpec,
  OpenAPIRequestBody,
  ResponseHistoryItem,
  ApiMetadataResponse,
} from '../types';

// ============================================================================
// 타입 가드 헬퍼
// ============================================================================

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

// ============================================================================
// 상수 정의
// ============================================================================

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
]);

const PREFERRED_RESPONSE_STATUSES = ['200', '201', '202', '204', 'default'];

const MAX_SCHEMA_RESOLUTION_DEPTH = 6;
const MAX_RESPONSE_HISTORY = 10;

// ============================================================================
// 타입 정의
// ============================================================================

type ServerVariableInfo = {
  name: string;
  defaultValue?: string;
  description?: string;
  enum?: string[];
};

// ============================================================================
// 환경 변수 헬퍼
// ============================================================================

const getDefaultServerUrl = () => {
  return (import.meta.env.VITE_CUSTOM_SERVER_URL ?? '').trim();
};

const getDefaultServerDraft = () => {
  const url = getDefaultServerUrl();
  return url ? [{ url }] : [];
};

const getOpenapiUrl = () => {
  return (import.meta.env.VITE_OPENAPI_URL ?? '').trim();
};

// ============================================================================
// 메타데이터 파싱 헬퍼
// ============================================================================

const parseMetadataText = async (raw: string): Promise<OpenAPISpec> => {
  let parsed: Record<string, unknown>;

  // JSON, JSON5, YAML 순서로 파싱 시도
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON5.parse(raw);
    } catch {
      try {
        parsed = YAML.parse(raw);
      } catch (error: unknown) {
        throw new Error(error instanceof Error ? error.message : 'Failed to parse metadata.');
      }
    }
  }

  // OpenAPI 스펙 검증
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid OpenAPI spec: must be an object.');
  }
  if (!parsed.openapi && !parsed.swagger) {
    throw new Error(
      "Invalid OpenAPI spec: missing 'openapi' or 'swagger' version."
    );
  }
  if (!parsed.info || !parsed.paths) {
    throw new Error("Invalid OpenAPI spec: missing 'info' or 'paths'.");
  }

  return parsed as OpenAPISpec;
};

// ============================================================================
// 서버 관련 헬퍼
// ============================================================================

const normalizeServerVariables = (
  variables?: Record<string, unknown>
): ServerVariableInfo[] => {
  if (!variables) {
    return [];
  }
  return Object.entries(variables).map(([name, value]) => {
    const val = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
      name,
      defaultValue:
        val?.default ??
        (Array.isArray(val?.enum) ? val.enum[0] : undefined),
      description: typeof val?.description === 'string' ? val.description : undefined,
      enum: Array.isArray(val?.enum) ? val.enum : undefined,
    };
  });
};

const resolveServerUrl = (url: string, variables: ServerVariableInfo[]) => {
  if (!url) {
    return '';
  }
  return url.replace(/{([^}]+)}/g, (_, key) => {
    const match = variables.find((variable) => variable.name === key);
    return match?.defaultValue ?? `{${key}}`;
  });
};

const resolveServerUrlWithValues = (
  url: string,
  values: Record<string, string>
) => {
  if (!url) {
    return '';
  }
  return url.replace(/{([^}]+)}/g, (_, key) => {
    const value = values[key];
    return value ? value : `{${key}}`;
  });
};

const getResolvedServerInfo = (server: Record<string, unknown>) => {
  const templateUrl = typeof server?.url === 'string' ? server.url : '';
  const variables = normalizeServerVariables(
    server?.variables && typeof server.variables === 'object' && !Array.isArray(server.variables)
      ? server.variables as Record<string, unknown>
      : undefined
  );
  const resolvedUrl = resolveServerUrl(templateUrl, variables);
  return { templateUrl, variables, resolvedUrl };
};

const buildMetadataServerVariableState = (
  servers: Record<string, unknown>[],
  existing: Record<string, Record<string, string>> = {}
) => {
  const next: Record<string, Record<string, string>> = {};
  servers.forEach((server) => {
    const { templateUrl, variables } = getResolvedServerInfo(server);
    const serverUrl = typeof server.url === 'string' ? server.url : '';
    const key = templateUrl || serverUrl || '';
    if (!key || typeof key !== 'string') {
      return;
    }
    const prevValues = existing[key] ?? {};
    const values: Record<string, string> = {};
    variables.forEach((variable) => {
      if (prevValues[variable.name] !== undefined) {
        values[variable.name] = prevValues[variable.name];
        return;
      }
      if (variable.defaultValue !== undefined) {
        values[variable.name] = String(variable.defaultValue);
        return;
      }
      if (variable.enum?.length) {
        values[variable.name] = String(variable.enum[0]);
        return;
      }
      values[variable.name] = '';
    });
    next[key] = values;
  });
  return next;
};

// ============================================================================
// URL 및 파라미터 헬퍼
// ============================================================================

const buildQueryString = (params: Record<string, string>) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '');
  if (entries.length === 0) {
    return '';
  }
  return new URLSearchParams(entries).toString();
};

const applyPathParams = (path: string, params: Record<string, string>) => {
  return path.replace(/{([^}]+)}/g, (_, key) =>
    encodeURIComponent(params[key] ?? `{${key}}`)
  );
};

// ============================================================================
// 스토리지 헬퍼
// ============================================================================

const createMemoryStorage = () => {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
};

const getPersistStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return createMemoryStorage();
};

// ============================================================================
// 경로 및 템플릿 헬퍼
// ============================================================================

const tokenizePath = (path: string) => {
  if (!path) {
    return [];
  }
  const normalized = path.trim().replace(/^\$\.?/, '');
  return normalized
    .split('.')
    .flatMap((segment) => segment.split(/\[|\]/).filter(Boolean));
};

const getValueByPath = (data: unknown, path: string) => {
  const tokens = tokenizePath(path);
  if (tokens.length === 0) {
    return undefined;
  }
  return tokens.reduce<unknown>((acc, token) => {
    if (acc == null) {
      return undefined;
    }
    const key = /^\d+$/.test(token) ? Number(token) : token;
    if (typeof acc === 'object' && acc !== null) {
      if (typeof key === 'number' && Array.isArray(acc)) {
        return acc[key];
      }
      if (typeof key === 'string' && !Array.isArray(acc)) {
        return (acc as Record<string, unknown>)[key];
      }
    }
    return undefined;
  }, data);
};

const resolveHeaderTemplate = (
  template: string,
  variables: Record<string, string>
) => {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, rawKey) => {
    const candidates = rawKey
      .split('|')
      .map((entry: string) => entry.trim())
      .filter(Boolean);
    const match = candidates.find(
      (candidate: string) =>
        variables[candidate] !== undefined && variables[candidate] !== ''
    );
    return match ? variables[match] : '';
  });
};

const resolveSecurityRequirements = (
  metadata: ApiMetadataResponse | null,
  api: ApiListItem | null
): Record<string, unknown[]>[] => {
  if (!metadata || !api?.path) {
    return [];
  }
  const spec = metadata.spec;
  if (!isRecord(spec)) {
    return [];
  }
  const paths = isRecord(spec.paths) ? spec.paths : null;
  if (!paths) {
    const rootSecurity = Array.isArray(spec.security) ? spec.security : [];
    return rootSecurity;
  }
  const pathItemRaw = paths[api.path];
  const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
  if (!pathItem) {
    const rootSecurity = Array.isArray(spec.security) ? spec.security : [];
    return rootSecurity;
  }
  const method = api.method.toLowerCase();
  const operationRaw = pathItem[method];
  const operation = isRecord(operationRaw) ? operationRaw : null;
  const operationSecurity = operation && Array.isArray(operation.security) ? operation.security : null;
  if (operationSecurity) {
    return operationSecurity;
  }
  const rootSecurity = Array.isArray(spec.security) ? spec.security : [];
  return rootSecurity;
};

const normalizeExampleValue = (
  value: unknown,
  metadata: ApiMetadataResponse | null = null
): string => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  // Handle $ref in example objects
  if (isRecord(value) && isString(value.$ref)) {
    const resolved = getComponentFromRef(metadata, value.$ref);
    if (resolved) {
      // If resolved example has a value property, use it
      if (resolved.value !== undefined) {
        return normalizeExampleValue(resolved.value, metadata);
      }
      // Otherwise, use the resolved example object itself
      return JSON.stringify(resolved, null, 2);
    }
    // If ref cannot be resolved, return the ref as-is
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value, null, 2);
};

const hashText = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

const toParamDefaults = (
  params: Record<string, unknown>[] | undefined,
  location: string
): Record<string, string> => {
  if (!params) {
    return {};
  }
  return params
    .filter((param) => isRecord(param) && param.in === location)
    .reduce<Record<string, string>>((acc, param) => {
      if (!isRecord(param) || !isString(param.name)) return acc;
      const paramSchema = isRecord(param.schema) ? param.schema : param;
      acc[param.name] =
        paramSchema?.default !== undefined ? String(paramSchema.default) : '';
      return acc;
    }, {});
};

const getSchemaFromRef = (
  metadata: ApiMetadataResponse | null,
  ref?: string
): Record<string, unknown> | null => {
  if (!ref || !metadata?.spec) {
    return null;
  }
  const components = isRecord(metadata.spec.components) ? metadata.spec.components : null;
  const schemas = components && isRecord(components.schemas) ? components.schemas : null;
  if (!schemas) {
    return null;
  }
  const name = ref.split('/').pop() ?? '';
  return isRecord(schemas[name]) ? schemas[name] : null;
};

const getComponentFromRef = (
  metadata: ApiMetadataResponse | null,
  ref?: string
): Record<string, unknown> | null => {
  if (!ref || !metadata?.spec) {
    return null;
  }
  const spec = metadata.spec;
  if (!isRecord(spec)) {
    return null;
  }
  const components = isRecord(spec.components) ? spec.components : null;
  if (!components) {
    return null;
  }
  const [, , group, name] = ref.split('/');
  if (!group || !name || !isString(group) || !isString(name)) {
    return null;
  }
  const groupObj = isRecord(components[group]) ? components[group] : null;
  return groupObj && isRecord(groupObj[name]) ? groupObj[name] : null;
};

const resolveParameter = (
  metadata: ApiMetadataResponse | null,
  param: Record<string, unknown>
): Record<string, unknown> | null => {
  if (!param) {
    return null;
  }
  if (isString(param.$ref)) {
    return getComponentFromRef(metadata, param.$ref);
  }
  return param;
};

const resolveRequestBodyObject = (
  metadata: ApiMetadataResponse | null,
  requestBody: Record<string, unknown>
): Record<string, unknown> | null => {
  if (!requestBody) {
    return null;
  }
  if (isString(requestBody.$ref)) {
    return getComponentFromRef(metadata, requestBody.$ref);
  }
  return requestBody;
};

const pickRequestContentType = (content: Record<string, unknown> | undefined) => {
  if (!content) {
    return null;
  }
  const keys = Object.keys(content);
  if (keys.length === 0) {
    return null;
  }
  if (content['application/json']) {
    return 'application/json';
  }
  const jsonPlus = keys.find((key) => key.endsWith('+json'));
  if (jsonPlus) {
    return jsonPlus;
  }
  if (content['multipart/form-data']) {
    return 'multipart/form-data';
  }
  if (content['application/x-www-form-urlencoded']) {
    return 'application/x-www-form-urlencoded';
  }
  if (content['text/plain']) {
    return 'text/plain';
  }
  return keys[0];
};

const getRequestContent = (
  metadata: ApiMetadataResponse | null,
  api: ApiListItem | null
): Record<string, unknown> | null => {
  if (!metadata || !api?.path) {
    return null;
  }
  const spec = metadata.spec;
  if (!isRecord(spec)) {
    return null;
  }
  const paths = isRecord(spec.paths) ? spec.paths : null;
  if (!paths) {
    return null;
  }
  const pathItemRaw = paths[api.path];
  const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
  if (!pathItem) {
    return null;
  }
  const method = api.method.toLowerCase();
  const operationRaw = pathItem[method];
  const operation = isRecord(operationRaw) ? operationRaw : null;
  if (!operation) {
    return null;
  }
  const requestBody = isRecord(operation.requestBody) ? operation.requestBody : null;
  const resolved = requestBody ? resolveRequestBodyObject(metadata, requestBody) : null;
  return resolved && isRecord(resolved.content) ? resolved.content : null;
};

const getRequestSchema = (
  metadata: ApiMetadataResponse | null,
  api: ApiListItem | null
): Record<string, unknown> | null => {
  const content = getRequestContent(metadata, api);
  if (!content) {
    return null;
  }
  const contentType = pickRequestContentType(content);
  if (!contentType) {
    return null;
  }
  const contentTypeObj = isRecord(content[contentType]) ? content[contentType] : null;
  if (!contentTypeObj) {
    return null;
  }
  const schema = isRecord(contentTypeObj.schema) ? contentTypeObj.schema : null;
  if (!schema) {
    return null;
  }
  if (isString(schema.$ref)) {
    return getSchemaFromRef(metadata, schema.$ref);
  }
  return schema;
};

const getRequestContentTypes = (
  metadata: ApiMetadataResponse | null,
  api: ApiListItem | null
) => {
  const content = getRequestContent(metadata, api);
  if (!content) {
    return [];
  }
  return Object.keys(content);
};

const getRequestSchemaForContentType = (
  metadata: ApiMetadataResponse | null,
  api: ApiListItem | null,
  contentType?: string | null
): Record<string, unknown> | null => {
  const content = getRequestContent(metadata, api);
  if (!content) {
    return null;
  }
  const key = contentType ?? pickRequestContentType(content) ?? '';
  if (!key) {
    return null;
  }
  const contentTypeObj = isRecord(content[key]) ? content[key] : null;
  if (!contentTypeObj) {
    return null;
  }
  const schema = isRecord(contentTypeObj.schema) ? contentTypeObj.schema : null;
  if (!schema) {
    return null;
  }
  if (isString(schema.$ref)) {
    return getSchemaFromRef(metadata, schema.$ref);
  }
  return schema;
};

const resolveResponseObject = (
  metadata: ApiMetadataResponse | null,
  response: Record<string, unknown>
): Record<string, unknown> | null => {
  if (!response) {
    return null;
  }
  if (isString(response.$ref)) {
    return getComponentFromRef(metadata, response.$ref);
  }
  return response;
};

const resolveHeaderObject = (
  metadata: ApiMetadataResponse | null,
  header: Record<string, unknown>
): Record<string, unknown> | null => {
  if (!header) {
    return null;
  }
  if (isString(header.$ref)) {
    return getComponentFromRef(metadata, header.$ref);
  }
  return header;
};

const pickResponseByStatus = (responses: Record<string, unknown>, status?: number | string): Record<string, unknown> | null => {
  if (!responses) {
    return null;
  }
  if (status !== undefined) {
    const statusKey = String(status);
    const response = responses[statusKey];
    if (isRecord(response)) {
      return response;
    }
  }
  const preferred = PREFERRED_RESPONSE_STATUSES.find((key) => responses[key]);
  if (preferred) {
    const response = responses[preferred];
    return isRecord(response) ? response : null;
  }
  const firstKey = Object.keys(responses)[0];
  if (firstKey) {
    const response = responses[firstKey];
    return isRecord(response) ? response : null;
  }
  return null;
};

const getResponseSchema = (
  metadata: ApiMetadataResponse | null,
  api: ApiListItem | null,
  status?: number | string
) => {
  if (!api?.path || !metadata?.spec) {
    return null;
  }
  const paths = isRecord(metadata.spec.paths) ? metadata.spec.paths : null;
  if (!paths) {
    return null;
  }
  const pathItemRaw = paths[api.path];
  const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
  if (!pathItem) {
    return null;
  }
  const method = api.method.toLowerCase();
  const operationRaw = pathItem[method];
  const operation = isRecord(operationRaw) ? operationRaw : null;
  if (!operation) {
    return null;
  }
  const responses = isRecord(operation.responses) ? operation.responses : null;
  if (!responses) {
    return null;
  }
  const response = pickResponseByStatus(responses, status);
  if (!response) {
    return null;
  }
  const resolvedResponse = resolveResponseObject(metadata, response);
  if (!resolvedResponse) {
    return null;
  }
  const content = isRecord(resolvedResponse.content) ? resolvedResponse.content : null;
  if (!content) {
    return null;
  }
  const jsonContent = isRecord(content['application/json']) ? content['application/json'] : null;
  if (!jsonContent) {
    return null;
  }
  const schema = isRecord(jsonContent.schema) ? jsonContent.schema : null;
  if (!schema) {
    return null;
  }
  if (isString(schema.$ref)) {
    return getSchemaFromRef(metadata, schema.$ref);
  }
  return schema;
};

const getResponseContent = (
  metadata: ApiMetadataResponse | null,
  api: ApiListItem | null,
  status?: number | string
) => {
  if (!api?.path || !metadata?.spec) {
    return null;
  }
  const paths = isRecord(metadata.spec.paths) ? metadata.spec.paths : null;
  if (!paths) {
    return null;
  }
  const pathItemRaw = paths[api.path];
  const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
  if (!pathItem) {
    return null;
  }
  const method = api.method.toLowerCase();
  const operationRaw = pathItem[method];
  const operation = isRecord(operationRaw) ? operationRaw : null;
  if (!operation) {
    return null;
  }
  const responses = isRecord(operation.responses) ? operation.responses : null;
  if (!responses) {
    return null;
  }
  const response = pickResponseByStatus(responses, status);
  if (!response) {
    return null;
  }
  const resolvedResponse = resolveResponseObject(metadata, response);
  return resolvedResponse && isRecord(resolvedResponse.content) ? resolvedResponse.content : null;
};

const buildDefaultFromSchema = (
  schema: Record<string, unknown> | null | undefined,
  metadata: ApiMetadataResponse | null,
  depth: number = 0
): unknown => {
  if (!schema || depth > MAX_SCHEMA_RESOLUTION_DEPTH) {
    return {};
  }
  if (isString(schema.$ref)) {
    const resolved = getSchemaFromRef(metadata, schema.$ref);
    return buildDefaultFromSchema(resolved, metadata, depth + 1);
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.reduce(
      (acc: Record<string, unknown>, item: unknown) => {
        const built = buildDefaultFromSchema(
          isRecord(item) ? item : null,
          metadata,
          depth + 1
        );
        return {
          ...acc,
          ...(isRecord(built) ? built : {}),
        };
      },
      {}
    );
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return buildDefaultFromSchema(
      isRecord(schema.oneOf[0]) ? schema.oneOf[0] : null,
      metadata,
      depth + 1
    );
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return buildDefaultFromSchema(
      isRecord(schema.anyOf[0]) ? schema.anyOf[0] : null,
      metadata,
      depth + 1
    );
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }
  if (schema.type === 'array') {
    const item = isRecord(schema.items)
      ? buildDefaultFromSchema(schema.items, metadata, depth + 1)
      : {};
    return isRecord(item) ? [item] : [];
  }
  if (schema.type === 'object' || isRecord(schema.properties)) {
    const result: Record<string, unknown> = {};
    const properties = isRecord(schema.properties) ? schema.properties : {};
    Object.entries(properties).forEach(([key, value]) => {
      result[key] = buildDefaultFromSchema(
        isRecord(value) ? value : null,
        metadata,
        depth + 1
      );
    });
    return result;
  }
  if (schema.type === 'boolean') {
    return false;
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    return 0;
  }
  if (schema.format === 'date-time') {
    return new Date().toISOString();
  }
  return 'string';
};

// ============================================================================
// SwaggerStore 클래스
// ============================================================================

export class ApiStore {
  // ========================================================================
  // 메타데이터 및 API 관련 상태
  // ========================================================================
  metadata: ApiMetadataResponse | null = null;
  selectedKey: string = '';
  openControllers: Record<string, boolean> = {};
  currentSpecKey = '';
  isLoadingMetadata = false;

  // ========================================================================
  // 요청 파라미터 및 본문
  // ========================================================================
  pathParams: Record<string, string> = {};
  queryParams: Record<string, string> = {};
  headerParams: Record<string, string> = {};
  requestBody: string = '';
  requestContentTypeSelections: Record<string, string> = {};
  requestBodiesByContentType: Record<string, Record<string, string>> = {};

  // ========================================================================
  // 응답 관련 상태
  // ========================================================================
  response: HttpResponse = {};
  responseHistory: ResponseHistoryItem[] = [];
  responseHistoryBySpec: Record<string, ResponseHistoryItem[]> = {};

  // ========================================================================
  // 다이얼로그 상태
  // ========================================================================
  headerDialogOpen = false;
  serverDialogOpen = false;
  sourceDialogOpen = false;
  globalAuthDialogOpen = false;
  infoDialogOpen = false;

  // ========================================================================
  // 테마 상태
  // ========================================================================
  darkMode = false;

  // ========================================================================
  // 헤더 관련 상태
  // ========================================================================
  headerDraft: Record<string, string> = {};
  headerMappingDraft: HeaderMappingRule[] = [];
  private globalHeaders: Record<string, string> = {};
  private headerVariables: Record<string, string> = {};

  // ========================================================================
  // 서버 관련 상태
  // ========================================================================
  serverDraft: Array<{ url: string; description?: string }> =
    getDefaultServerDraft();
  metadataServerVariables: Record<string, Record<string, string>> = {};
  activeServerKey = '';
  activeServerUrl = getDefaultServerUrl();

  // ========================================================================
  // 소스 관리 상태
  // ========================================================================
  loadUrl = getOpenapiUrl();
  loadedFromPaste = false;
  metadataDraft = '';
  savedSources: Record<string, { type: 'url' | 'text'; value: string }> = {};
  selectedSourceKey = '';
  sourceDraftKey = '';
  sourceDraftType: 'url' | 'text' = 'url';
  sourceDraftValue = '';

  // ========================================================================
  // 보안 관련 상태
  // ========================================================================
  globalSecurityValues: Record<string, Record<string, unknown>> = {};
  globalSecurityScopes: Record<string, string[]> = {};
  securityValues: Record<string, Record<string, unknown>> = {};
  securityRequirementIndex: Record<string, number> = {};

  // ========================================================================
  // 내부 상태
  // ========================================================================
  persistReady: Promise<void>;
  private axiosInstance: AxiosInstance;
  private loadAbortController: AbortController | null = null;

  constructor() {
    // Axios 인스턴스 초기화
    this.axiosInstance = axios.create({
      withCredentials: false,
      headers: DEFAULT_HEADERS,
    });
    this.setActiveServerUrl(this.activeServerUrl);

    // MobX observable 설정
    makeAutoObservable(
      this,
      { axiosInstance: false, globalHeaders: false } as Parameters<typeof makeAutoObservable>[1],
      { autoBind: true }
    );

    // 영속화할 속성 목록
    const persistProperties = [
      'selectedKey',
      'openControllers',
      'pathParams',
      'queryParams',
      'headerParams',
      'requestBody',
      'response',
      'responseHistory',
      'responseHistoryBySpec',
      'currentSpecKey',
      'headerDraft',
      'headerMappingDraft',
      'headerVariables',
      'serverDraft',
      'metadataServerVariables',
      'metadataDraft',
      'loadedFromPaste',
      'savedSources',
      'selectedSourceKey',
      'sourceDraftKey',
      'sourceDraftType',
      'sourceDraftValue',
      'requestContentTypeSelections',
      'requestBodiesByContentType',
      'globalSecurityValues',
      'globalSecurityScopes',
      'securityValues',
      'securityRequirementIndex',
      'activeServerKey',
      'activeServerUrl',
      'loadUrl',
      'darkMode',
    ] as Array<keyof ApiStore>;

    // 영속화 설정
    this.persistReady = makePersistable(this, {
      name: 'SwaggerStore',
      properties: persistProperties,
      storage: getPersistStorage(),
    })
      .then(() => {
        this.setGlobalHeaders(this.buildHeadersFromDraft(this.headerDraft));
        // Apply dark mode on initialization
        if (typeof document !== 'undefined') {
          if (this.darkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      })
      .catch(() => {});
  }

  // ========================================================================
  // Getters - API 리스트 및 선택
  // ========================================================================

  get apiList(): ApiListItem[] {
    if (!this.metadata?.spec) {
      return [];
    }

    try {
      const items: ApiListItem[] = [];
      const spec = this.metadata.spec;
      if (!isRecord(spec)) {
        return [];
      }
      const paths = isRecord(spec.paths) ? spec.paths : null;

      if (!paths) {
        return [];
      }

      Object.entries(paths).forEach(([path, methods]) => {
        if (!methods || typeof methods !== 'object') {
          return;
        }

        Object.entries(methods as Record<string, unknown>).forEach(
          ([method, info]) => {
            if (
              !HTTP_METHODS.has(method) ||
              !info ||
              typeof info !== 'object'
            ) {
              return;
            }

            const upperMethod = method.toUpperCase();
            const infoRecord = isRecord(info) ? info : {};
            const tags = Array.isArray(infoRecord.tags) ? infoRecord.tags : [];
            items.push({
              key: `${upperMethod} ${path}`,
              method: upperMethod,
              path,
              controller: (typeof tags[0] === 'string' ? tags[0] : undefined) ?? 'General',
              summary: typeof infoRecord.summary === 'string' ? infoRecord.summary : undefined,
              description: typeof infoRecord.description === 'string' ? infoRecord.description : undefined,
              parameters: Array.isArray(infoRecord.parameters) ? infoRecord.parameters.filter(isRecord) as unknown as OpenAPIParameter[] : undefined,
              requestBody: isRecord(infoRecord.requestBody) ? infoRecord.requestBody as unknown as OpenAPIRequestBody : undefined,
            });
          }
        );
      });

      return items;
    } catch {
      return [];
    }
  }

  get selectedApi(): ApiListItem | null {
    return this.apiList.find((item) => item.key === this.selectedKey) ?? null;
  }

  // ========================================================================
  // Getters - 요청 관련
  // ========================================================================

  get requestParameters(): Record<string, unknown>[] {
    const api = this.selectedApi;
    if (!api || !this.metadata?.spec) {
      return [];
    }
    const spec = this.metadata.spec;
    if (!isRecord(spec)) {
      return [];
    }
    const paths = isRecord(spec.paths) ? spec.paths : null;
    if (!paths) {
      return [];
    }
    const pathItemRaw = paths[api.path];
    const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
    if (!pathItem) {
      return [];
    }
    const method = api.method.toLowerCase();
    const operationRaw = pathItem[method];
    const operation = isRecord(operationRaw) ? operationRaw : null;
    const pathParams = Array.isArray(pathItem.parameters) ? pathItem.parameters.filter(isRecord) : [];
    const operationParams = operation && Array.isArray(operation.parameters) ? operation.parameters.filter(isRecord) : [];
    const combined = [...pathParams, ...operationParams];

    return combined
      .map((param) => resolveParameter(this.metadata, param))
      .filter((param): param is Record<string, unknown> => param !== null);
  }

  get requestContentType(): string | null {
    const options = this.requestContentTypeOptions;
    if (!options.length) {
      return null;
    }
    const selected = this.requestContentTypeSelections[this.selectedKey] ?? '';
    if (selected && options.includes(selected)) {
      return selected;
    }
    return pickRequestContentType(
      getRequestContent(this.metadata, this.selectedApi) ?? undefined
    );
  }

  get requestContentTypeOptions(): string[] {
    return getRequestContentTypes(this.metadata, this.selectedApi);
  }

  getRequestBodyForContentType(contentType: string): string {
    const key = this.selectedKey;
    if (!key || !contentType) {
      return '';
    }
    const existing = this.requestBodiesByContentType[key]?.[contentType];
    if (existing !== undefined) {
      return existing;
    }
    const schema = getRequestSchemaForContentType(
      this.metadata,
      this.selectedApi,
      contentType
    );
    return schema
      ? JSON.stringify(buildDefaultFromSchema(schema, this.metadata), null, 2)
      : '';
  }

  getRequestBodyExamples(
    contentType: string | undefined
  ): Array<{ name: string; value: string }> {
    if (!contentType) {
      return [];
    }
    const content = getRequestContent(this.metadata, this.selectedApi);
    if (!content) {
      return [];
    }
    const contentTypeObj = isRecord(content[contentType]) ? content[contentType] : null;
    if (!contentTypeObj) {
      return [];
    }
    const payload = contentTypeObj;
    const examples = isRecord(payload.examples) ? payload.examples : {};
    const entries = Object.entries(examples).map(
      ([name, entry]: [string, unknown]) => ({
        name,
        value: normalizeExampleValue(
          isRecord(entry) && entry.value !== undefined ? entry.value : entry,
          this.metadata
        ),
      })
    );
    if (entries.length > 0) {
      return entries;
    }
    if (payload.example !== undefined) {
      return [
        {
          name: 'example',
          value: normalizeExampleValue(payload.example, this.metadata),
        },
      ];
    }
    return [];
  }

  get requestCallbacks(): Record<string, unknown> {
    if (!this.metadata || !this.selectedApi?.path) {
      return {};
    }
    const spec = this.metadata.spec;
    if (!isRecord(spec)) {
      return {};
    }
    const paths = isRecord(spec.paths) ? spec.paths : null;
    if (!paths) {
      return {};
    }
    const pathItemRaw = paths[this.selectedApi.path];
    const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
    if (!pathItem) {
      return {};
    }
    const method = this.selectedApi.method.toLowerCase();
    const operationRaw = pathItem[method];
    const operation = isRecord(operationRaw) ? operationRaw : null;
    if (!operation) {
      return {};
    }
    const callbacks = isRecord(operation.callbacks) ? operation.callbacks : null;
    return callbacks ?? {};
  }

  // ========================================================================
  // Getters - 보안 관련
  // ========================================================================

  get securitySchemes(): Record<string, Record<string, unknown>> {
    if (!this.metadata?.spec) {
      return {};
    }
    const spec = this.metadata.spec;
    if (!isRecord(spec)) {
      return {};
    }
    const components = isRecord(spec.components) ? spec.components : null;
    if (!components) {
      return {};
    }
    const securitySchemes = isRecord(components.securitySchemes) ? components.securitySchemes : null;
    if (!securitySchemes) {
      return {};
    }
    const result: Record<string, Record<string, unknown>> = {};
    Object.entries(securitySchemes).forEach(([key, value]) => {
      if (isRecord(value)) {
        result[key] = value;
      }
    });
    return result;
  }

  get securitySchemeList(): Array<{
    name: string;
    type?: string;
    description?: string;
    in?: string;
    scheme?: string;
    bearerFormat?: string;
    flows?: Record<string, unknown>;
    openIdConnectUrl?: string;
  }> {
    return Object.entries(this.securitySchemes).map(([name, scheme]) => ({
      name,
      type: typeof scheme.type === 'string' ? scheme.type : undefined,
      description: typeof scheme.description === 'string' ? scheme.description : undefined,
      in: typeof scheme.in === 'string' ? scheme.in : undefined,
      scheme: typeof scheme.scheme === 'string' ? scheme.scheme : undefined,
      bearerFormat: typeof scheme.bearerFormat === 'string' ? scheme.bearerFormat : undefined,
      flows: isRecord(scheme.flows) ? scheme.flows : undefined,
      openIdConnectUrl: typeof scheme.openIdConnectUrl === 'string' ? scheme.openIdConnectUrl : undefined,
    }));
  }

  getSecurityScopes(name: string): string[] {
    const scheme = this.securitySchemes[name];
    if (!scheme || !isRecord(scheme.flows)) {
      return [];
    }
    const scopes = new Set<string>();
    Object.values(scheme.flows).forEach((flow) => {
      if (isRecord(flow) && isRecord(flow.scopes)) {
        Object.keys(flow.scopes).forEach((scope) => scopes.add(scope));
      }
    });
    return Array.from(scopes);
  }

  get requestSecurityRequirements(): Record<string, unknown[]>[] {
    return resolveSecurityRequirements(this.metadata, this.selectedApi);
  }

  get selectedSecurityRequirementIndex(): number {
    return this.securityRequirementIndex[this.selectedKey] ?? 0;
  }

  get selectedSecurityRequirement(): Record<string, string[]> | null {
    const requirements = this.requestSecurityRequirements;
    if (!requirements.length) {
      return null;
    }
    const index = this.selectedSecurityRequirementIndex;
    const requirement = requirements[index] ?? requirements[0];
    if (!requirement) {
      return null;
    }
    const result: Record<string, string[]> = {};
    Object.entries(requirement).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        result[key] = value.filter((item): item is string => typeof item === 'string');
      }
    });
    return result;
  }

  // ========================================================================
  // Getters - 서버 관련
  // ========================================================================

  get metadataServers(): Array<{
    url: string;
    description?: string;
    templateUrl?: string;
    variables?: ServerVariableInfo[];
  }> {
    if (!this.metadata?.spec) {
      return [];
    }
    const spec = this.metadata.spec;
    if (!isRecord(spec)) {
      return [];
    }
    const servers = Array.isArray(spec.servers) ? spec.servers.filter(isRecord) : [];
    return servers
      .map((server) => {
        const { templateUrl, variables, resolvedUrl } =
          getResolvedServerInfo(server);
        return {
          url: resolvedUrl || templateUrl,
          templateUrl,
          description: typeof server?.description === 'string' ? server.description : undefined,
          variables,
        };
      })
      .filter((server: { url: string }) => Boolean(server.url));
  }

  private getParamDefaultsFromRequestParams(
    location: string
  ): Record<string, string> {
    return toParamDefaults(this.requestParameters, location);
  }

  // ========================================================================
  // Getters - 스키마 관련
  // ========================================================================

  get requestSchemaText(): string {
    const schema = getRequestSchema(this.metadata, this.selectedApi);
    return schema ? JSON.stringify(schema, null, 2) : '';
  }

  get responseSchemaText(): string {
    const schema = getResponseSchema(
      this.metadata,
      this.selectedApi,
      this.response.status
    );
    return schema ? JSON.stringify(schema, null, 2) : '';
  }

  private resolveSchema(
    schema: Record<string, unknown> | null | undefined,
    seenRefs: Set<string> = new Set(),
    depth: number = 0
  ): Record<string, unknown> | null | undefined {
    // Return original schema if depth is too deep (prevent infinite recursion)
    if (depth > MAX_SCHEMA_RESOLUTION_DEPTH) {
      return schema;
    }

    if (!schema) {
      return schema;
    }

    if (isString(schema.$ref)) {
      // Return immediately when circular reference detected (no additional logging)
      if (seenRefs.has(schema.$ref)) {
        return { ...schema, circularRef: true };
      }
      const resolved = getSchemaFromRef(this.metadata, schema.$ref);
      if (!resolved) {
        return schema;
      }
      const nextSeen = new Set(seenRefs);
      nextSeen.add(schema.$ref);
      return this.resolveSchema(resolved, nextSeen, depth + 1);
    }

    if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
      const merged = schema.allOf.reduce((acc: Record<string, unknown>, item: unknown) => {
        const resolved = this.resolveSchema(
          isRecord(item) ? item : null,
          seenRefs,
          depth + 1
        );
        const resolvedRecord = isRecord(resolved) ? resolved : {};
        const accProperties = isRecord(acc.properties) ? acc.properties : {};
        const resolvedProperties = isRecord(resolvedRecord.properties) ? resolvedRecord.properties : {};
        const accRequired = Array.isArray(acc.required) ? acc.required : [];
        const resolvedRequired = Array.isArray(resolvedRecord.required) ? resolvedRecord.required : [];
        return {
          ...acc,
          ...resolvedRecord,
          properties: {
            ...accProperties,
            ...resolvedProperties,
          },
          required: Array.from(
            new Set([...accRequired, ...resolvedRequired])
          ),
        };
      }, {});
      return { ...schema, ...merged };
    }

    if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      return {
        ...schema,
        oneOf: schema.oneOf.map((item: unknown) =>
          this.resolveSchema(isRecord(item) ? item : null, seenRefs, depth + 1)
        ),
      };
    }

    if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      return {
        ...schema,
        anyOf: schema.anyOf.map((item: unknown) =>
          this.resolveSchema(isRecord(item) ? item : null, seenRefs, depth + 1)
        ),
      };
    }

    if (isRecord(schema.properties)) {
      const props: Record<string, unknown> = {};
      Object.entries(schema.properties).forEach(([key, value]) => {
        props[key] = this.resolveSchema(
          isRecord(value) ? value : null,
          seenRefs,
          depth + 1
        );
      });
      return { ...schema, properties: props };
    }

    if (isRecord(schema.items)) {
      return {
        ...schema,
        items: this.resolveSchema(schema.items, seenRefs, depth + 1),
      };
    }

    return schema;
  }

  get requestSchema(): Record<string, unknown> | null | undefined {
    const schema = getRequestSchema(this.metadata, this.selectedApi);
    return this.resolveSchema(schema);
  }

  // Removed responseSchema getter, use getResponseSchemaForStatus instead
  // Getter can block main thread if called during rendering
  // get responseSchema(): any {
  //   const schema = getResponseSchema(
  //     this.metadata,
  //     this.selectedApi,
  //     this.response.status
  //   );
  //   if (!schema) {
  //     return null;
  //   }
  //   try {
  //     return this.resolveSchema(schema);
  //   } catch (error) {
  //     return schema;
  //   }
  // }

  get responseStatusOptions(): string[] {
    const api = this.selectedApi;
    if (!api?.path || !this.metadata?.spec) {
      return [];
    }
    const spec = this.metadata.spec;
    if (!isRecord(spec)) {
      return [];
    }
    const paths = isRecord(spec.paths) ? spec.paths : null;
    if (!paths) {
      return [];
    }
    const pathItemRaw = paths[api.path];
    const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
    if (!pathItem) {
      return [];
    }
    const method = api.method.toLowerCase();
    const operationRaw = pathItem[method];
    const operation = isRecord(operationRaw) ? operationRaw : null;
    if (!operation) {
      return [];
    }
    const responses = isRecord(operation.responses) ? operation.responses : null;
    if (!responses) {
      return [];
    }
    const keys = Object.keys(responses);
    return keys.sort((a, b) => {
      const aNum = Number(a);
      const bNum = Number(b);
      const aIsNum = !Number.isNaN(aNum);
      const bIsNum = !Number.isNaN(bNum);
      if (aIsNum && bIsNum) {
        return aNum - bNum;
      }
      if (aIsNum) {
        return -1;
      }
      if (bIsNum) {
        return 1;
      }
      if (a === 'default') {
        return 1;
      }
      if (b === 'default') {
        return -1;
      }
      return a.localeCompare(b);
    });
  }

  getResponseSchemaForStatus(status?: string): Record<string, unknown> | null | undefined {
    const schema = getResponseSchema(this.metadata, this.selectedApi, status);
    if (!schema) {
      return null;
    }
    try {
      // Process schema resolution in small chunks for async processing
      // But here we process synchronously, and the caller handles async processing
      const result = this.resolveSchema(schema);
      return result;
    } catch {
      return schema;
    }
  }

  getResponseContentTypesForStatus(status?: string): string[] {
    const content = getResponseContent(this.metadata, this.selectedApi, status);
    if (!content) {
      return [];
    }
    return Object.keys(content);
  }

  getResponseSchemaForStatusAndContentType(
    status: string | undefined,
    contentType: string | undefined
  ): Record<string, unknown> | null | undefined {
    if (!contentType) {
      const result = this.getResponseSchemaForStatus(status);
      return result;
    }
    const content = getResponseContent(this.metadata, this.selectedApi, status);
    if (!content) {
      return null;
    }
    const contentTypeObj = contentType && isRecord(content[contentType]) ? content[contentType] : null;
    if (!contentTypeObj) {
      return null;
    }
    const schema = isRecord(contentTypeObj.schema) ? contentTypeObj.schema : null;
    if (!schema) {
      return null;
    }
    try {
      let result: Record<string, unknown> | null | undefined;
      if (isString(schema.$ref)) {
        result = this.resolveSchema(
          getSchemaFromRef(this.metadata, schema.$ref)
        );
      } else {
        result = this.resolveSchema(schema);
      }
      return result;
    } catch {
      return schema;
    }
  }

  getResponseExamplesForStatus(
    status: string | undefined,
    contentType: string | undefined
  ): Array<{ name: string; value: string }> {
    if (!contentType) {
      return [];
    }
    const content = getResponseContent(this.metadata, this.selectedApi, status);
    if (!content) {
      return [];
    }
    const contentTypeObj = isRecord(content[contentType]) ? content[contentType] : null;
    if (!contentTypeObj) {
      return [];
    }
    const payload = contentTypeObj;
    const examples = isRecord(payload.examples) ? payload.examples : {};
    const entries = Object.entries(examples).map(
      ([name, entry]: [string, unknown]) => ({
        name,
        value: normalizeExampleValue(isRecord(entry) && entry.value !== undefined ? entry.value : entry, this.metadata),
      })
    );
    if (entries.length > 0) {
      return entries;
    }
    if (payload.example !== undefined) {
      return [
        {
          name: 'example',
          value: normalizeExampleValue(payload.example, this.metadata),
        },
      ];
    }
    return [];
  }

  getResponseInfoForStatus(status?: string): {
    description?: string;
    headers?: Record<string, unknown>;
  } {
    const api = this.selectedApi;
    if (!api?.path || !this.metadata?.spec) {
      return {};
    }
    const spec = this.metadata.spec;
    if (!isRecord(spec)) {
      return {};
    }
    const paths = isRecord(spec.paths) ? spec.paths : null;
    if (!paths) {
      return {};
    }
    const pathItemRaw = paths[api.path];
    const pathItem = isRecord(pathItemRaw) ? pathItemRaw : null;
    if (!pathItem) {
      return {};
    }
    const method = api.method.toLowerCase();
    const operationRaw = pathItem[method];
    const operation = isRecord(operationRaw) ? operationRaw : null;
    if (!operation) {
      return {};
    }
    const responses = isRecord(operation.responses) ? operation.responses : null;
    if (!responses) {
      return {};
    }
    const response = pickResponseByStatus(responses, status);
    if (!response) {
      return {};
    }
    const resolvedResponse = resolveResponseObject(this.metadata, response);
    if (!resolvedResponse) {
      return {};
    }
    const rawHeaders = isRecord(resolvedResponse.headers) ? resolvedResponse.headers : {};
    const resolvedHeaders = Object.entries(rawHeaders).reduce<
      Record<string, unknown>
    >((acc, [key, value]) => {
      if (isRecord(value)) {
        const resolved = resolveHeaderObject(this.metadata, value);
        if (resolved) {
          acc[key] = resolved;
        }
      }
      return acc;
    }, {});
    return {
      description: typeof resolvedResponse.description === 'string' ? resolvedResponse.description : undefined,
      headers: resolvedHeaders,
    };
  }

  // ========================================================================
  // 메타데이터 로딩
  // ========================================================================

  async loadMetadata(): Promise<void> {
    // loadUrl이 비어있고 paste도 없으면 즉시 리턴
    if (
      !this.loadUrl &&
      (!this.loadedFromPaste || !this.metadataDraft.trim())
    ) {
      runInAction(() => {
        this.isLoadingMetadata = false;
      });
      return;
    }

    // 기존 요청 취소 및 새 AbortController 생성
    if (this.loadAbortController) {
      this.loadAbortController.abort();
    }
    this.loadAbortController = new AbortController();
    const signal = this.loadAbortController.signal;

    try {
      runInAction(() => {
        this.isLoadingMetadata = true;
      });

      // Paste 데이터에서 로드
      if (this.loadedFromPaste && this.metadataDraft.trim()) {
        await this.loadMetadataFromPaste();
        return;
      }

      // URL에서 로드
      if (!this.loadUrl) {
        runInAction(() => {
          this.isLoadingMetadata = false;
        });
        this.setResponse({ error: 'Load URL is required.' });
        return;
      }

      await this.loadMetadataFromUrl(signal);
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'canceled')) {
        runInAction(() => {
          this.isLoadingMetadata = false;
        });
        return;
      }
      runInAction(() => {
        this.setResponse({
          error: error instanceof Error ? error.message : 'Failed to load swagger metadata',
        });
      });
    } finally {
      runInAction(() => {
        this.isLoadingMetadata = false;
        this.loadAbortController = null;
      });
    }
  }

  private async loadMetadataFromPaste(): Promise<void> {
    const parsed = await parseMetadataText(this.metadataDraft.trim());
    const normalized = { spec: parsed };

    runInAction(() => {
      this.metadata = normalized;
      this.loadedFromPaste = true;
      this.currentSpecKey = `paste:${hashText(this.metadataDraft.trim())}`;
      this.responseHistory =
        this.responseHistoryBySpec[this.currentSpecKey] ?? [];
      this.loadUrl = 'Paste loaded';
    });

    this.updateMetadataServerVariables(normalized);
    this.setFirstServerIfNeeded(normalized);
  }

  private async loadMetadataFromUrl(signal: AbortSignal): Promise<void> {
    const result = await this.getSwaggerMetadata(this.loadUrl, signal);

    if (signal.aborted) {
      return;
    }

    const parsed = await parseMetadataText(result);
    const normalized = { spec: parsed };

    runInAction(() => {
      this.metadata = normalized;
      this.loadedFromPaste = false;
      this.currentSpecKey = `url:${this.loadUrl.trim()}`;
      this.responseHistory =
        this.responseHistoryBySpec[this.currentSpecKey] ?? [];
    });

    this.updateMetadataServerVariables(normalized);
    this.setFirstServerIfNeeded(normalized);
  }

  private updateMetadataServerVariables(normalized: ApiMetadataResponse): void {
    runInAction(() => {
      const spec = normalized?.spec;
      const servers = isRecord(spec) && Array.isArray(spec.servers) 
        ? spec.servers.filter(isRecord)
        : [];
      this.metadataServerVariables = buildMetadataServerVariableState(
        servers,
        this.metadataServerVariables
      );
    });
  }

  private setFirstServerIfNeeded(normalized: ApiMetadataResponse): void {
    const spec = normalized?.spec;
    if (!this.activeServerUrl && isRecord(spec) && Array.isArray(spec.servers) && spec.servers.length > 0) {
      const firstServer = spec.servers[0];
      if (isRecord(firstServer)) {
        const { resolvedUrl, templateUrl } = getResolvedServerInfo(firstServer);
        const firstServerUrl = resolvedUrl || templateUrl;

        if (firstServerUrl) {
          runInAction(() => {
            this.activeServerKey = templateUrl || firstServerUrl;
            this.setActiveServerUrl(firstServerUrl);
          });
        }
      }
    }
  }

  cancelLoadMetadata(): void {
    if (this.loadAbortController) {
      this.loadAbortController.abort();
      this.loadAbortController = null;
      runInAction(() => {
        this.isLoadingMetadata = false;
      });
      toastStore.show('Metadata loading cancelled.', 'info');
    }
  }

  // ========================================================================
  // API 선택 관리
  // ========================================================================

  ensureSelectedApi(): void {
    if (this.apiList.length === 0) {
      return;
    }
    const selectedExists = this.apiList.some(
      (item) => item.key === this.selectedKey
    );
    if (!this.selectedKey || !selectedExists) {
      this.setSelectedKey(this.apiList[0].key);
    }
  }

  setSelectedKey(key: string): void {
    this.selectedKey = key;
    const api = this.selectedApi;
    if (!api) {
      return;
    }

    // 파라미터 기본값 설정
    this.pathParams = this.getParamDefaultsFromRequestParams('path');
    this.queryParams = this.getParamDefaultsFromRequestParams('query');
    this.headerParams = this.getParamDefaultsFromRequestParams('header');

    // Request body 설정
    const selectedContentType = this.requestContentTypeSelections[key];
    if (selectedContentType) {
      this.requestBody = this.getRequestBodyForContentType(selectedContentType);
    } else {
      const requestSchema = getRequestSchema(this.metadata, api);
      this.requestBody = requestSchema
        ? JSON.stringify(
            buildDefaultFromSchema(requestSchema, this.metadata),
            null,
            2
          )
        : '';
    }

    this.setResponse({});
  }

  toggleController(key: string): void {
    this.openControllers = {
      ...this.openControllers,
      [key]: !this.openControllers[key],
    };
  }

  // ========================================================================
  // 요청 파라미터 관리
  // ========================================================================

  setPathParam(key: string, value: string): void {
    this.pathParams = { ...this.pathParams, [key]: value };
  }

  setQueryParam(key: string, value: string): void {
    this.queryParams = { ...this.queryParams, [key]: value };
  }

  setHeaderParam(key: string, value: string): void {
    this.headerParams = { ...this.headerParams, [key]: value };
  }

  setRequestBody(value: string): void {
    this.requestBody = value;
  }

  setRequestContentType(value: string): void {
    if (!this.selectedApi) {
      return;
    }
    this.requestContentTypeSelections = {
      ...this.requestContentTypeSelections,
      [this.selectedApi.key]: value,
    };
    const nextBody = this.getRequestBodyForContentType(value);
    this.requestBody = nextBody;
  }

  setRequestBodyForContentType(contentType: string, value: string): void {
    if (!this.selectedApi) {
      return;
    }
    const key = this.selectedApi.key;
    const nextByContentType = {
      ...(this.requestBodiesByContentType[key] ?? {}),
      [contentType]: value,
    };
    this.requestBodiesByContentType = {
      ...this.requestBodiesByContentType,
      [key]: nextByContentType,
    };
    if (this.requestContentType === contentType) {
      this.requestBody = value;
    }
  }

  setActiveServerUrl(value: string): void {
    this.activeServerUrl = value.trim();
    this.axiosInstance.defaults.baseURL = this.activeServerUrl;
    this.axiosInstance.defaults.headers.common = {
      ...DEFAULT_HEADERS,
      ...this.globalHeaders,
    };
  }

  setActiveServerFromMetadata(key: string, url: string): void {
    if (key) {
      this.activeServerKey = key;
    }
    this.setActiveServerUrl(url);
  }

  clearActiveServerKey(): void {
    this.activeServerKey = '';
  }

  setLoadUrl(value: string): void {
    this.loadUrl = value.trim();
  }

  // ========================================================================
  // 다이얼로그 관리
  // ========================================================================

  setHeaderDialogOpen(open: boolean): void {
    this.headerDialogOpen = open;
  }

  setServerDialogOpen(open: boolean): void {
    if (open && this.serverDraft.length === 0) {
      this.serverDraft = getDefaultServerDraft();
    }
    this.serverDialogOpen = open;
  }

  setSourceDialogOpen(open: boolean): void {
    if (open) {
      if (this.selectedSourceKey && this.savedSources[this.selectedSourceKey]) {
        const entry = this.savedSources[this.selectedSourceKey];
        this.sourceDraftKey = this.selectedSourceKey;
        this.sourceDraftType = entry.type;
        this.sourceDraftValue = entry.value;
      } else if (this.loadedFromPaste) {
        this.sourceDraftKey = '';
        this.sourceDraftType = 'text';
        this.sourceDraftValue = this.metadataDraft;
      } else if (this.loadUrl && this.loadUrl !== 'Paste loaded') {
        this.sourceDraftKey = '';
        this.sourceDraftType = 'url';
        this.sourceDraftValue = this.loadUrl;
      } else {
        this.sourceDraftKey = '';
        this.sourceDraftType = 'url';
        this.sourceDraftValue = '';
      }
    }
    this.sourceDialogOpen = open;
  }

  setGlobalAuthDialogOpen(open: boolean): void {
    this.globalAuthDialogOpen = open;
  }

  setInfoDialogOpen(open: boolean): void {
    this.infoDialogOpen = open;
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    if (typeof document !== 'undefined') {
      if (this.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  // ========================================================================
  // 헤더 관리
  // ========================================================================

  setHeaderDraft(value: Record<string, string>): void {
    this.headerDraft = value;
  }

  setHeaderMappingDraft(value: HeaderMappingRule[]): void {
    this.headerMappingDraft = value;
  }

  // ========================================================================
  // 보안 관리
  // ========================================================================

  setSecurityValue(name: string, value: Record<string, unknown>): void {
    if (!name) {
      return;
    }
    this.securityValues = { ...this.securityValues, [name]: value };
  }

  setGlobalSecurityValue(name: string, value: Record<string, unknown>): void {
    if (!name) {
      return;
    }
    this.globalSecurityValues = { ...this.globalSecurityValues, [name]: value };
  }

  toggleGlobalScope(name: string, scope: string): void {
    if (!name || !scope) {
      return;
    }
    const current = this.globalSecurityScopes[name] ?? [];
    const next = current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope];
    this.globalSecurityScopes = {
      ...this.globalSecurityScopes,
      [name]: next,
    };
  }

  buildImplicitAuthUrl(name: string): string {
    const scheme = this.securitySchemes[name];
    if (!scheme || !isRecord(scheme.flows)) {
      return '';
    }
    const implicit = isRecord(scheme.flows.implicit) ? scheme.flows.implicit : null;
    const authorizationUrl = typeof implicit?.authorizationUrl === 'string' ? implicit.authorizationUrl : null;
    if (!authorizationUrl) {
      return '';
    }
    try {
      const url = new URL(authorizationUrl);
      url.searchParams.set('response_type', 'token');
      const scopes = this.globalSecurityScopes[name] ?? [];
      if (scopes.length > 0) {
        url.searchParams.set('scope', scopes.join(' '));
      }
      return url.toString();
    } catch {
      return '';
    }
  }

  buildAuthorizationCodeUrl(name: string): string {
    const scheme = this.securitySchemes[name];
    if (!scheme || !isRecord(scheme.flows)) {
      return '';
    }
    const authorizationCode = isRecord(scheme.flows.authorizationCode) ? scheme.flows.authorizationCode : null;
    const authorizationUrl = typeof authorizationCode?.authorizationUrl === 'string' ? authorizationCode.authorizationUrl : null;
    if (!authorizationUrl) {
      return '';
    }
    try {
      const url = new URL(authorizationUrl);
      url.searchParams.set('response_type', 'code');
      const scopes = this.globalSecurityScopes[name] ?? [];
      if (scopes.length > 0) {
        url.searchParams.set('scope', scopes.join(' '));
      }
      // client_id는 사용자가 입력해야 함
      const value = this.globalSecurityValues[name] ?? {};
      if (typeof value.clientId === 'string') {
        url.searchParams.set('client_id', value.clientId);
      }
      if (typeof value.redirectUri === 'string') {
        url.searchParams.set('redirect_uri', value.redirectUri);
      }
      return url.toString();
    } catch {
      return '';
    }
  }

  getOAuth2Flows(name: string): {
    authorizationCode?: { authorizationUrl?: string; tokenUrl?: string };
    implicit?: { authorizationUrl?: string };
    password?: { tokenUrl?: string };
    clientCredentials?: { tokenUrl?: string };
  } {
    const scheme = this.securitySchemes?.[name];
    return scheme?.flows ?? {};
  }

  setSecurityRequirementIndex(index: number): void {
    if (!this.selectedApi) {
      return;
    }
    this.securityRequirementIndex = {
      ...this.securityRequirementIndex,
      [this.selectedApi.key]: index,
    };
  }

  // ========================================================================
  // 소스 관리
  // ========================================================================

  setSourceDraftKey(value: string): void {
    this.sourceDraftKey = value;
  }

  setSourceDraftType(value: 'url' | 'text'): void {
    this.sourceDraftType = value;
  }

  setSourceDraftValue(value: string): void {
    this.sourceDraftValue = value;
  }

  setSelectedSourceKey(value: string): void {
    this.selectedSourceKey = value;
  }

  async addSavedSource(): Promise<void> {
    const key = this.sourceDraftKey.trim();
    if (!key) {
      toastStore.show('Source key is required.', 'error');
      return;
    }
    const value = this.sourceDraftValue.trim();
    if (!value) {
      toastStore.show('Source value is required.', 'error');
      return;
    }

    // 기존 요청이 있으면 취소
    if (this.loadAbortController) {
      this.loadAbortController.abort();
    }

    // 새로운 AbortController 생성
    this.loadAbortController = new AbortController();
    const signal = this.loadAbortController.signal;

    try {
      this.isLoadingMetadata = true;
      let rawMetadata = '';
      if (this.sourceDraftType === 'url') {
        rawMetadata = await this.getSwaggerMetadata(value, signal);
        // 취소되었는지 확인
        if (signal.aborted) {
          return;
        }
      } else {
        rawMetadata = value;
      }

      // Validate by parsing
      const parsed = await parseMetadataText(rawMetadata);

      const normalized = { spec: parsed };

      // 다이얼로그는 즉시 닫기
      runInAction(() => {
        this.sourceDialogOpen = false;
      });

      // 무거운 작업을 비동기로 처리하여 UI 블로킹 방지
      setTimeout(() => {
        runInAction(() => {
          this.savedSources = {
            ...this.savedSources,
            [key]: { type: this.sourceDraftType, value },
          };

          // Apply newly validated metadata directly
          this.metadata = normalized;
          this.selectedSourceKey = key;
          this.currentSpecKey = `source:${key}`;
          this.responseHistory =
            this.responseHistoryBySpec[this.currentSpecKey] ?? [];

          if (this.sourceDraftType === 'url') {
            this.loadedFromPaste = false;
            this.loadUrl = value;
          } else {
            this.metadataDraft = value;
            this.loadedFromPaste = true;
            this.loadUrl = 'Paste loaded';
          }
        });

        runInAction(() => {
          const spec = normalized?.spec;
          const servers = isRecord(spec) && Array.isArray(spec.servers) 
            ? spec.servers.filter(isRecord)
            : [];
          this.metadataServerVariables = buildMetadataServerVariableState(
            servers,
            this.metadataServerVariables
          );
        });

        const spec = normalized?.spec;
        if (!this.activeServerUrl && isRecord(spec) && Array.isArray(spec.servers) && spec.servers.length > 0) {
          const firstServer = spec.servers[0];
          if (isRecord(firstServer)) {
            const { resolvedUrl, templateUrl } = getResolvedServerInfo(firstServer);
            const firstServerUrl = resolvedUrl || templateUrl;
            if (firstServerUrl) {
              runInAction(() => {
                this.activeServerKey = templateUrl || firstServerUrl;
                this.setActiveServerUrl(firstServerUrl);
              });
            }
          }
        }

        runInAction(() => {
          this.ensureSelectedApi();
        });

      // apiList 계산을 다음 이벤트 루프로 미뤄서 UI 블로킹 방지
      setTimeout(() => {
        toastStore.show('Source added successfully.', 'success');
      }, 0);
      }, 0);
    } catch (error: unknown) {
      // 취소된 경우는 에러 메시지 표시하지 않음
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'canceled')) {
        return;
      }
      toastStore.show(error instanceof Error ? error.message : 'Failed to validate source.', 'error');
    } finally {
      runInAction(() => {
        this.isLoadingMetadata = false;
        this.loadAbortController = null;
      });
    }
  }

  async testConnect(): Promise<void> {
    const value = this.sourceDraftValue.trim();
    if (!value) {
      toastStore.show('Source value is required to test.', 'error');
      return;
    }

    // 기존 요청이 있으면 취소
    if (this.loadAbortController) {
      this.loadAbortController.abort();
    }

    // 새로운 AbortController 생성
    this.loadAbortController = new AbortController();
    const signal = this.loadAbortController.signal;

    try {
      this.isLoadingMetadata = true;
      let rawMetadata = '';
      if (this.sourceDraftType === 'url') {
        rawMetadata = await this.getSwaggerMetadata(value, signal);
        // 취소되었는지 확인
        if (signal.aborted) {
          return;
        }
      } else {
        rawMetadata = value;
      }

      // Validate by parsing
      const parsed = await parseMetadataText(rawMetadata);
      const spec = isRecord(parsed) ? parsed : null;
      const info = spec && isRecord(spec.info) ? spec.info : null;
      const title = typeof info?.title === 'string' ? info.title : 'Untitled API';
      toastStore.show(`Connected successfully! (Title: ${title})`, 'success');
    } catch (error: unknown) {
      // 취소된 경우는 에러 메시지 표시하지 않음
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'canceled')) {
        return;
      }
      toastStore.show(error instanceof Error ? error.message : 'Connection test failed.', 'error');
    } finally {
      runInAction(() => {
        this.isLoadingMetadata = false;
        this.loadAbortController = null;
      });
    }
  }

  removeSavedSource(key: string): void {
    if (!key) {
      return;
    }
    // Delete from savedSources
    const next = { ...this.savedSources };
    delete next[key];
    this.savedSources = next;

    // Delete all stored data related to this source
    const specKey = `source:${key}`;

    // Delete history for this source from responseHistoryBySpec
    if (this.responseHistoryBySpec[specKey]) {
      const nextHistory = { ...this.responseHistoryBySpec };
      delete nextHistory[specKey];
      this.responseHistoryBySpec = nextHistory;
    }

    // Initialize all related data if current specKey is the deleted source
    if (this.currentSpecKey === specKey) {
      this.currentSpecKey = '';
      this.responseHistory = [];

      // Initialize if selected source is deleted
      if (this.selectedSourceKey === key) {
        this.selectedSourceKey = '';
      }

      // Initialize metadata
      this.metadata = null;
      this.selectedKey = '';

      // Initialize request parameters and body
      this.pathParams = {};
      this.queryParams = {};
      this.headerParams = {};
      this.requestBody = '';
      this.requestContentTypeSelections = {};
      this.requestBodiesByContentType = {};

      // Initialize security-related data (stored per API, so only current API's data is initialized)
      // securityValues and securityRequirementIndex are based on selectedKey
      // so they are automatically affected when selectedKey is initialized

      // Initialize response
      this.response = {};

      // Initialize server-related data
      this.metadataServerVariables = {};
      this.activeServerKey = '';
      this.activeServerUrl = getDefaultServerUrl();

      // Initialize source-related data
      this.loadUrl = getOpenapiUrl();
      this.loadedFromPaste = false;
      this.metadataDraft = '';
    } else {
      // Initialize only if selected source is deleted
      if (this.selectedSourceKey === key) {
        this.selectedSourceKey = '';
      }
    }
  }

  async loadSavedSource(key: string): Promise<void> {
    const entry = this.savedSources[key];
    if (!entry) {
      return;
    }
    this.selectedSourceKey = key;
    this.currentSpecKey = `source:${key}`;
    this.responseHistory =
      this.responseHistoryBySpec[this.currentSpecKey] ?? [];
    if (entry.type === 'url') {
      this.loadedFromPaste = false;
      this.loadUrl = entry.value;
      await this.loadMetadata();
      return;
    }
    this.metadataDraft = entry.value;
    this.loadedFromPaste = true;
    await this.loadMetadataFromText(entry.value);
  }

  resetHeaderDraft(): void {
    this.headerDraft = { Authorization: 'Bearer ' };
    this.headerMappingDraft = [];
    this.headerVariables = {};
  }

  setServerDraft(value: Array<{ url: string; description?: string }>): void {
    const trimmed = value
      .map((server) => ({
        url: server.url.trim(),
        description: server.description?.trim() || undefined,
      }))
      .filter((server) => server.url);
    this.serverDraft = trimmed.length > 0 ? trimmed : getDefaultServerDraft();
  }

  resetServerDraft(): void {
    this.serverDraft = [];
  }

  saveHeader(): void {
    this.setGlobalHeaders(this.buildHeadersFromDraft(this.headerDraft));
    this.headerDialogOpen = false;
  }

  saveServers(): void {
    this.serverDialogOpen = false;
    if (!this.activeServerKey || !this.metadata?.spec) {
      return;
    }
    const spec = this.metadata.spec;
    if (!isRecord(spec) || !Array.isArray(spec.servers)) {
      return;
    }
    const target = spec.servers.find((server) => {
      if (!isRecord(server)) {
        return false;
      }
      const key = typeof server.url === 'string' ? server.url : '';
      return key && key === this.activeServerKey;
    });
    if (target && isRecord(target)) {
      const templateUrl = typeof target.url === 'string' ? target.url : '';
      const values = this.metadataServerVariables[this.activeServerKey] ?? {};
      const resolvedUrl = resolveServerUrlWithValues(templateUrl, values);
      if (resolvedUrl) {
        this.setActiveServerUrl(resolvedUrl);
      }
    }
  }

  setMetadataServerVariable(key: string, values: Record<string, string>): void {
    if (!key) {
      return;
    }
    this.metadataServerVariables = {
      ...this.metadataServerVariables,
      [key]: values,
    };
    if (this.activeServerKey === key) {
      const resolvedUrl = resolveServerUrlWithValues(key, values);
      if (resolvedUrl) {
        this.setActiveServerUrl(resolvedUrl);
      }
    }
  }

  setMetadataDraft(value: string): void {
    this.metadataDraft = value;
  }

  resetMetadataDraft(): void {
    this.metadataDraft = '';
  }

  async loadMetadataFromText(raw: string): Promise<void> {
    const trimmed = raw.trim();
    if (!trimmed) {
      toastStore.show('Metadata text is required.', 'error');
      return;
    }
    try {
      const parsed = await parseMetadataText(trimmed);

      const normalized = { spec: parsed };

      runInAction(() => {
        this.metadata = normalized;
        this.loadedFromPaste = true;
        this.currentSpecKey = `paste:${hashText(trimmed)}`;
        this.responseHistory =
          this.responseHistoryBySpec[this.currentSpecKey] ?? [];
        this.loadUrl = 'Paste loaded';
      });

      runInAction(() => {
        const spec = normalized?.spec;
        const servers = isRecord(spec) && Array.isArray(spec.servers) 
          ? spec.servers.filter(isRecord)
          : [];
        this.metadataServerVariables = buildMetadataServerVariableState(
          servers,
          this.metadataServerVariables
        );
      });

      const spec = normalized?.spec;
      if (!this.activeServerUrl && isRecord(spec) && Array.isArray(spec.servers) && spec.servers.length > 0) {
        const firstServer = spec.servers[0];
        if (isRecord(firstServer)) {
          const { resolvedUrl, templateUrl } = getResolvedServerInfo(firstServer);
          const firstServerUrl = resolvedUrl || templateUrl;
          if (firstServerUrl) {
            runInAction(() => {
              this.activeServerKey = templateUrl || firstServerUrl;
              this.setActiveServerUrl(firstServerUrl);
            });
          }
        }
      }

      this.ensureSelectedApi();
    } catch (error: unknown) {
      toastStore.show(
        error instanceof Error ? error.message : 'Failed to parse swagger metadata.',
        'error'
      );
    }
  }

  private setGlobalHeaders(headers: Record<string, string>): void {
    this.globalHeaders = { ...headers };
    this.axiosInstance.defaults.headers.common = {
      ...DEFAULT_HEADERS,
      ...this.globalHeaders,
    };
  }

  private buildHeadersFromDraft(
    headers: Record<string, string>
  ): Record<string, string> {
    return Object.entries(headers).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        const trimmedKey = key.trim();
        if (!trimmedKey) {
          return acc;
        }
        acc[trimmedKey] = resolveHeaderTemplate(value, this.headerVariables);
        return acc;
      },
      {}
    );
  }

  private setResponse(value: HttpResponse): void {
    this.response = value;
  }

  private pushResponseHistory(entry: ResponseHistoryItem): void {
    const key = this.currentSpecKey || 'default';
    const current = this.responseHistoryBySpec[key] ?? [];
    const nextHistory = [entry, ...current].slice(0, MAX_RESPONSE_HISTORY);
    this.responseHistoryBySpec = {
      ...this.responseHistoryBySpec,
      [key]: nextHistory,
    };
    this.responseHistory = nextHistory;
  }

  private createResponseHistory(
    response: HttpResponse,
    requestBody: string
  ): ResponseHistoryItem {
    const api = this.selectedApi;
    const path = api?.path ?? '';
    const method = api?.method ?? '';
    const resolvedPath = path ? applyPathParams(path, this.pathParams) : '';
    const query = buildQueryString(this.queryParams);
    const url = query ? `${resolvedPath}?${query}` : resolvedPath;
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      key: api?.key ?? '',
      method,
      path,
      url,
      pathParams: { ...this.pathParams },
      queryParams: { ...this.queryParams },
      headerParams: { ...this.headerParams },
      requestBody,
      response,
    };
  }

  selectResponseHistory(id: string): void {
    const item = this.responseHistory.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    const exists = this.apiList.some((api) => api.key === item.key);
    if (!exists) {
      toastStore.show('API not found in current spec.', 'error');
      return;
    }
    this.selectedKey = item.key;
    this.pathParams = { ...item.pathParams };
    this.queryParams = { ...item.queryParams };
    this.headerParams = { ...(item.headerParams ?? {}) };
    this.requestBody = item.requestBody;
    this.setResponse(item.response);
  }

  // ========================================================================
  // Private 메서드 - 요청 본문 처리
  // ========================================================================

  private isJsonContentType(contentType: string | null): boolean {
    if (!contentType) {
      return true;
    }
    return (
      contentType === 'application/json' ||
      contentType.endsWith('+json') ||
      contentType.includes('json')
    );
  }

  private parseBodyToObject(body: string): Record<string, unknown> {
    const parsed = JSON5.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  }

  private parseKeyValueLines(body: string): Record<string, string> {
    return body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, line) => {
        const index = line.indexOf('=');
        if (index === -1) {
          acc[line] = '';
          return acc;
        }
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        if (key) {
          acc[key] = value;
        }
        return acc;
      }, {});
  }

  // ========================================================================
  // Private 메서드 - 보안 처리
  // ========================================================================

  private buildSecurityPayload(): {
    headers: Record<string, string>;
    queryParams: Record<string, string>;
    useCookies: boolean;
  } {
    const headers: Record<string, string> = {};
    const queryParams: Record<string, string> = {};
    const cookies: string[] = [];
    let useCookies = false;
    const schemes = this.securitySchemes;

    // requirements를 조사하지 않고 모든 보안 스킴을 무조건 포함
    Object.entries(schemes).forEach(([schemeName, scheme]) => {
      if (!scheme) {
        return;
      }
      const value =
        this.securityValues[schemeName] ??
        this.globalSecurityValues[schemeName] ??
        {};

      // API Keys: header, query, cookie 지원
      if (scheme.type === 'apiKey') {
        const rawValue = typeof value.value === 'string' ? value.value : '';
        const keyValue = resolveHeaderTemplate(rawValue, this.headerVariables);
        if (!keyValue) {
          return;
        }
        const schemeName = typeof scheme.name === 'string' ? scheme.name : '';
        if (!schemeName) {
          return;
        }
        if (scheme.in === 'header') {
          // Header에 API Key 설정
          headers[schemeName] = keyValue;
        } else if (scheme.in === 'query') {
          // Query parameter에 API Key 설정
          queryParams[schemeName] = keyValue;
        } else if (scheme.in === 'cookie') {
          // Cookie 인증: 브라우저가 자동으로 전송하도록 document.cookie 설정
          // 동시에 Cookie 헤더도 설정 (수동 쿠키 전송용)
          if (typeof document !== 'undefined') {
            document.cookie = `${schemeName}=${encodeURIComponent(keyValue)}; path=/; SameSite=Lax`;
          }
          cookies.push(`${schemeName}=${encodeURIComponent(keyValue)}`);
          useCookies = true;
        }
        return;
      }

      // HTTP Authentication: Basic, Bearer 등
      if (scheme.type === 'http') {
        const schemeType = String(scheme.scheme ?? '').toLowerCase();

        // Basic Authentication
        if (schemeType === 'basic') {
          const username = resolveHeaderTemplate(
            typeof value.username === 'string' ? value.username : '',
            this.headerVariables
          );
          const password = resolveHeaderTemplate(
            typeof value.password === 'string' ? value.password : '',
            this.headerVariables
          );
          const raw = resolveHeaderTemplate(
            typeof value.value === 'string' ? value.value : '',
            this.headerVariables
          );

          // 이미 인코딩된 값이 있으면 사용
          if (raw) {
            headers.Authorization = raw.startsWith('Basic ')
              ? raw
              : `Basic ${raw}`;
            return;
          }
          // username:password를 Base64 인코딩
          if (username || password) {
            try {
              const encoded = btoa(`${username}:${password}`);
              headers.Authorization = `Basic ${encoded}`;
            } catch (error) {
              // btoa 실패 시 무시
            }
          }
          return;
        }

        // Bearer Authentication
        if (schemeType === 'bearer') {
          const token = resolveHeaderTemplate(
            typeof value.value === 'string' ? value.value : '',
            this.headerVariables
          );
          if (!token) {
            return;
          }
          // Bearer 토큰 형식: "Bearer <token>"
          // bearerFormat이 지정된 경우 문서화 목적 (예: "JWT")
          headers.Authorization = token.toLowerCase().startsWith('bearer ')
            ? token
            : `Bearer ${token}`;
          return;
        }

        // 기타 HTTP 스킴 (Digest 등)
        const token = resolveHeaderTemplate(
          typeof value.value === 'string' ? value.value : '',
          this.headerVariables
        );
        if (!token) {
          return;
        }
        headers.Authorization = `${schemeType} ${token}`;
        return;
      }

      // OAuth2 Authentication
      if (scheme.type === 'oauth2') {
        const token = resolveHeaderTemplate(
          typeof value.value === 'string' ? value.value : '',
          this.headerVariables
        );
        if (!token) {
          return;
        }
        // OAuth2는 Bearer 토큰 형식 사용
        // flows 정보는 토큰 획득 시 사용되며, 여기서는 획득한 토큰을 사용
        headers.Authorization = token.startsWith('Bearer ')
          ? token
          : `Bearer ${token}`;
        return;
      }

      // OpenID Connect Discovery
      if (scheme.type === 'openIdConnect') {
        const token = resolveHeaderTemplate(
          typeof value.value === 'string' ? value.value : '',
          this.headerVariables
        );
        if (!token) {
          return;
        }
        // OpenID Connect는 OAuth2 기반이므로 Bearer 토큰 형식 사용
        // openIdConnectUrl은 discovery용이며, 실제 인증은 Bearer 토큰 사용
        headers.Authorization = token.startsWith('Bearer ')
          ? token
          : `Bearer ${token}`;
        return;
      }
    });

    // Cookie 헤더 설정 (수동 쿠키 전송용)
    if (cookies.length > 0) {
      headers.Cookie = cookies.join('; ');
    }

    return { headers, queryParams, useCookies };
  }

  // ========================================================================
  // Private 메서드 - 헤더 매핑
  // ========================================================================

  private applyHeaderMappings(responseData: unknown): void {
    const apiPath = this.selectedApi?.path?.trim();
    if (!apiPath || this.headerMappingDraft.length === 0) {
      return;
    }
    const nextVariables = { ...this.headerVariables };
    let updated = false;
    this.headerMappingDraft.forEach((rule) => {
      const path = rule.path.trim();
      const responsePath = rule.responsePath.trim();
      const variable = rule.variable.trim();
      if (!path || !responsePath || !variable) {
        return;
      }
      if (path !== apiPath) {
        return;
      }
      const value = getValueByPath(responseData, responsePath);
      if (value === undefined || value === null) {
        return;
      }
      nextVariables[variable] =
        typeof value === 'string' ? value : JSON.stringify(value);
      updated = true;
    });
    if (updated) {
      this.headerVariables = nextVariables;
      this.setGlobalHeaders(this.buildHeadersFromDraft(this.headerDraft));
    }
  }

  // ========================================================================
  // Private 메서드 - HTTP 요청
  // ========================================================================

  private async request<T>(config: {
    method: string;
    url: string;
    data?: unknown;
    headers?: Record<string, string>;
    withCredentials?: boolean;
  }): Promise<{ data: T; headers: Record<string, string>; status: number }> {
    try {
      const response = await this.axiosInstance.request<T>(config);
      const headers: Record<string, string> = {};
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
          }
        });
      }
      return {
        data: response.data,
        headers,
        status: response.status,
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; config?: { baseURL?: string; url?: string }; message?: string };
      const status = axiosError?.response?.status;
      const baseURL = axiosError?.config?.baseURL ?? '';
      const path = axiosError?.config?.url ?? '';
      const fullUrl =
        baseURL && path ? `${baseURL.replace(/\/+$/, '')}${path}` : path;
      const message = status
        ? `Request failed (${status})${fullUrl ? `: ${fullUrl}` : ''}`
        : (axiosError?.message ?? 'Request failed');
      toastStore.show(message, 'error');
      throw error;
    }
  }

  private async getSwaggerMetadata(
    url: string,
    signal?: AbortSignal
  ): Promise<string> {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) {
      throw new Error('Load URL is required.');
    }

    // Basic URL format validation
    try {
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        throw new Error('URL must start with http:// or https://');
      }
      new URL(trimmed);
    } catch (e: unknown) {
      throw new Error(e instanceof Error ? e.message : 'Invalid URL format.');
    }

    try {
      const response = await axios.get<string>(trimmed, {
        withCredentials: false,
        responseType: 'text',
        signal,
      });
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { name?: string; code?: string; response?: { status?: number }; message?: string };
      if (axiosError?.name === 'AbortError' || axiosError?.code === 'ERR_CANCELED') {
        throw new Error('canceled');
      }
      const message = axiosError?.response
        ? `Failed to fetch metadata (${axiosError.response.status})`
        : (axiosError?.message ?? 'Failed to load metadata');
      throw new Error(message);
    }
  }

  // ========================================================================
  // 요청 전송
  // ========================================================================

  async sendRequest(): Promise<void> {
    if (!this.selectedApi) {
      return;
    }
    const securityPayload = this.buildSecurityPayload();
    const effectiveQueryParams = { ...this.queryParams };
    Object.entries(securityPayload.queryParams).forEach(([key, value]) => {
      if (
        effectiveQueryParams[key] === undefined ||
        effectiveQueryParams[key] === ''
      ) {
        effectiveQueryParams[key] = value;
      }
    });
    const path = applyPathParams(this.selectedApi.path, this.pathParams);
    const query = buildQueryString(effectiveQueryParams);
    const url = query ? `${path}?${query}` : path;
    const method = this.selectedApi.method.toLowerCase();
    const headerEntries = Object.entries(this.headerParams).filter(
      ([, value]) => value !== ''
    );
    const requestHeaders = {
      ...this.globalHeaders,
      ...(headerEntries.length > 0 ? Object.fromEntries(headerEntries) : {}),
    };
    Object.entries(securityPayload.headers).forEach(([key, value]) => {
      if (requestHeaders[key] === undefined || requestHeaders[key] === '') {
        requestHeaders[key] = value;
      } else if (key.toLowerCase() === 'cookie') {
        requestHeaders[key] = `${requestHeaders[key]}; ${value}`;
      }
    });
    const hasContentTypeHeader = Object.keys(requestHeaders).some(
      (key) => key.toLowerCase() === 'content-type'
    );
    const requestContentType = this.requestContentType;
    if (requestContentType && !hasContentTypeHeader) {
      requestHeaders['Content-Type'] = requestContentType;
    }
    const finalHeaders =
      Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined;

    const resolvedRequestBody = resolveHeaderTemplate(
      this.requestBody,
      this.headerVariables
    );
    let body: unknown = undefined;
    if (resolvedRequestBody.trim()) {
      const contentType = this.requestContentType;
      if (this.isJsonContentType(contentType)) {
        try {
          body = JSON5.parse(resolvedRequestBody);
        } catch (error: unknown) {
          const response = { error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` };
          this.setResponse(response);
          this.pushResponseHistory(
            this.createResponseHistory(response, resolvedRequestBody)
          );
          return;
        }
      } else if (contentType === 'multipart/form-data') {
        let payload: Record<string, unknown>;
        try {
          payload = this.parseBodyToObject(resolvedRequestBody);
        } catch {
          payload = this.parseKeyValueLines(resolvedRequestBody);
        }
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((item) =>
              formData.append(
                key,
                typeof item === 'string' ? item : JSON.stringify(item)
              )
            );
          } else if (value instanceof Blob) {
            formData.append(key, value);
          } else if (value !== undefined && value !== null) {
            formData.append(
              key,
              typeof value === 'string' ? value : JSON.stringify(value)
            );
          }
        });
        body = formData;
        if (requestHeaders && requestHeaders['Content-Type']) {
          delete requestHeaders['Content-Type'];
        }
      } else if (contentType === 'application/x-www-form-urlencoded') {
        let payload: Record<string, unknown>;
        try {
          payload = this.parseBodyToObject(resolvedRequestBody);
        } catch {
          payload = this.parseKeyValueLines(resolvedRequestBody);
        }
        const params = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, String(item)));
          } else if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
        body = params;
      } else {
        body = resolvedRequestBody;
      }
    }

    try {
      // Cookie 인증이 필요한 경우에만 withCredentials 설정
      const requestConfig: {
        method: string;
        url: string;
        data?: unknown;
        headers?: Record<string, string>;
        withCredentials?: boolean;
      } = {
        method,
        url,
        data: method === 'get' || method === 'delete' ? undefined : body,
        headers: finalHeaders,
        withCredentials: securityPayload.useCookies, // Cookie 인증이 필요한 경우에만 true
      };

      const result = await this.request(requestConfig);
      this.applyHeaderMappings(result.data);
      runInAction(() => {
        const response = {
          status: result.status,
          headers: JSON.stringify(result.headers, null, 2),
          body: JSON.stringify(result.data, null, 2),
        };
        this.setResponse(response);
        this.pushResponseHistory(
          this.createResponseHistory(response, resolvedRequestBody)
        );
      });
    } catch (error: unknown) {
      runInAction(() => {
        const errorMessage = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Request failed';
        const response = { error: errorMessage };
        this.setResponse(response);
        this.pushResponseHistory(
          this.createResponseHistory(response, resolvedRequestBody)
        );
      });
    }
  }
}

const ApiStoreContext = createContext<ApiStore | null>(null);

export const apiStore = new ApiStore();

export const ApiStoreProvider = ApiStoreContext.Provider;

export const useApiStore = () => {
  const store = useContext(ApiStoreContext);
  if (!store) {
    throw new Error('SwaggerStoreProvider is missing.');
  }
  return store;
};
