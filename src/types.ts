import type { OpenAPIV3 } from 'openapi-types';

// OpenAPI spec type - supports both V3 and V2
export type OpenAPISpec = OpenAPIV3.Document | Record<string, unknown>;

export type ApiMetadataResponse = {
  spec: OpenAPISpec;
};

// OpenAPI Info type from openapi-types
export type OpenAPIInfo = OpenAPIV3.InfoObject;

// Helper function to safely access nested properties
export const getInfo = (spec: OpenAPISpec): OpenAPIInfo | undefined => {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return undefined;
  }
  const info = (spec as OpenAPIV3.Document)?.info;
  if (info && typeof info === 'object' && !Array.isArray(info)) {
    return info as OpenAPIInfo;
  }
  return undefined;
};

// Use OpenAPI types for parameters and request body
export type OpenAPIParameter = OpenAPIV3.ParameterObject;
export type OpenAPIRequestBody = OpenAPIV3.RequestBodyObject;

export type ApiListItem = {
  key: string;
  method: string;
  path: string;
  controller?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
};

export type HttpResponse = {
  status?: number;
  headers?: string;
  body?: string;
  error?: string;
};

export type HeaderMappingRule = {
  path: string;
  responsePath: string;
  variable: string;
};

export type ResponseHistoryItem = {
  id: string;
  timestamp: string;
  key: string;
  method: string;
  path: string;
  url: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headerParams?: Record<string, string>;
  requestBody: string;
  response: HttpResponse;
};
