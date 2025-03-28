import {Base64} from 'js-base64';
import {gzip, ungzip} from 'pako';
import {PlaygroundConfig} from "@/components/Playground";
import {OpenAPIFilterSet, parseString, stringify} from "openapi-format";

export interface DecodedShareUrl {
  openapi?: string;
  config?: PlaygroundConfig;
}

export const generateShareUrl = async (origin: string, openapi?: string, config?: PlaygroundConfig): Promise<string> => {
  const url = new URL(`${origin}`);

  if (openapi && openapi.length > 0) {
    const encodedInput = Base64.fromUint8Array(gzip(openapi));
    url.searchParams.set('input', encodedInput);
  }

  if (config && Object.keys(config).length > 0) {
    const configOps = {} as PlaygroundConfig;

    if (config.sortSet !== undefined) configOps.sortSet = await stringify(config.sortSet);
    if (config.filterSet !== undefined) configOps.filterSet = await stringify(config.filterSet);
    if (config.generateSet !== undefined) configOps.generateSet = await stringify(config.generateSet);
    if (config.casingSet !== undefined) configOps.casingSet = await stringify(config.casingSet);
    if (config.overlaySet !== undefined) configOps.overlaySet = (config.overlaySet);
    if (config.sort !== undefined) configOps.sort = config.sort;
    // if (options.rename !== undefined) config.rename = options.rename;
    // if (options.convertTo !== undefined) config.convertTo = options.convertTo

    if (config.isFilterOptionsCollapsed !== undefined) configOps.isFilterOptionsCollapsed = config.isFilterOptionsCollapsed;
    if (config.outputLanguage !== undefined) configOps.outputLanguage = config.outputLanguage;

    if (config.pathSort !== undefined) configOps.pathSort = config.pathSort;
    if (config.defaultFieldSorting !== undefined) configOps.defaultFieldSorting = config.defaultFieldSorting;

    const encodedConfig = Base64.fromUint8Array(gzip(JSON.stringify(config)));
    url.searchParams.set('config', encodedConfig);
  }
  return url.toString();
};

export const decodeShareUrl = async (url: string): Promise<DecodedShareUrl> => {
  const urlObj = new URL(url);
  const encodedInput = urlObj.searchParams.get('input');
  const encodedConfig = urlObj.searchParams.get('config');

  const result: DecodedShareUrl = {};

  if (encodedInput) {
    result.openapi = ungzip(Base64.toUint8Array(encodedInput), {to: 'string'});
  }
  if (encodedConfig) {
    const urlConfig = ungzip(Base64.toUint8Array(encodedConfig), {to: 'string'})
    result.config = await parseString(urlConfig) as PlaygroundConfig
  }
  return result;
};

export const includeUnusedComponents = (obj: OpenAPIFilterSet, include: boolean) => {
  const components = [
    "schemas",
    "parameters",
    "examples",
    "headers",
    "requestBodies",
    "responses"
  ];
  if (include) {
    if (!obj.hasOwnProperty('unusedComponents')) {
      obj.unusedComponents = components;
    }
  } else {
    if (obj.hasOwnProperty('unusedComponents')) {
      delete obj.unusedComponents;
    }
  }

  return obj;
}

// Storage keys
const STORAGE_KEY = 'openapi-playground-autosave';
const STORAGE_CONFIG_KEY = 'openapi-playground-config-autosave';
const STORAGE_OVERLAY_KEY = 'openapi-playground-overlay-autosave';

// Autosave functions
export const saveToStorage = (openapi: string, config: PlaygroundConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, openapi);
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
};

export const loadFromStorage = (): {openapi?: string; config?: PlaygroundConfig} => {
  try {
    const openapi = localStorage.getItem(STORAGE_KEY);
    const config = localStorage.getItem(STORAGE_CONFIG_KEY);
    return {
      openapi: openapi || undefined,
      config: config ? JSON.parse(config) : undefined
    };
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
    return {};
  }
};

export const clearStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_CONFIG_KEY);
  localStorage.removeItem(STORAGE_OVERLAY_KEY);
};

export const saveOverlayToStorage = (overlay: string) => {
  try {
    localStorage.setItem(STORAGE_OVERLAY_KEY, overlay);
  } catch (e) {
    console.warn('Failed to save overlay to localStorage', e);
  }
};

export const loadOverlayFromStorage = (): string | undefined => {
  try {
    return localStorage.getItem(STORAGE_OVERLAY_KEY) || undefined;
  } catch (e) {
    console.warn('Failed to load overlay from localStorage', e);
    return undefined;
  }
};

export const includePreserve = (obj: OpenAPIFilterSet, include: boolean) => {
  if (include) {
    if (!obj.hasOwnProperty('preserveEmptyObjects')) {
      obj.preserveEmptyObjects = true;
    }
  } else {
    if (obj.hasOwnProperty('preserveEmptyObjects')) {
      delete obj.preserveEmptyObjects;
    }
  }

  return obj;
}
