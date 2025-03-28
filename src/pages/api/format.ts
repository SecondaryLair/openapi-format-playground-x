import type {NextApiRequest, NextApiResponse} from 'next';
import {
  detectFormat, OpenAPICasingOptions, OpenAPICasingSet, openapiChangeCase,
  openapiFilter,
  OpenAPIFilterOptions,
  OpenAPIFilterSet,
  openapiGenerate, OpenAPIGenerateOptions, OpenAPIGenerateSet, openapiOverlay, OpenAPIOverlayOptions,
  OpenAPIResult,
  openapiSort,
  OpenAPISortOptions,
  OpenAPISortSet,
  parseString,
  stringify
} from 'openapi-format';

import defaultFilterJson from '../../defaults/defaultFilter.json'
import defaultSortJson from '../../defaults/defaultSort.json'
import {OpenAPIV3} from "openapi-types";

export default async function format(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({message: 'Method not allowed'});
    return;
  }

  try {
    if (typeof req.body !== 'object' || req.body === null) {
      throw new Error('Invalid request body');
    }

    const {openapi, config} = req.body;
    if (!openapi || typeof openapi !== 'string') {
      res.status(422).json({message: 'Missing or invalid openapi parameter'});
      return;
    }

    const {sort, keepComments, filterSet, sortSet, generateSet, casingSet, overlaySet, format} = config || {};

    const _format = format || await detectFormat(openapi);
    let convertOptions = {keepComments: keepComments || false, format: undefined};
    let oaObj = await parseString(openapi, convertOptions) as OpenAPIV3.Document || '';
    let output = {data: oaObj} as OpenAPIResult;

    // Generate OpenAPI elements
    if (generateSet?.length > 0) {
      const generateOpts = await parseString(generateSet) as OpenAPIGenerateSet;
      const options = {generateSet: generateOpts} as OpenAPIGenerateOptions;
      output = await openapiGenerate(oaObj, options) as OpenAPIResult;
      oaObj = output.data as OpenAPIV3.Document || {data: oaObj};
    }

    // Filter OpenAPI
    if (filterSet?.length > 0) {
      const filterOpts = await parseString(filterSet) as OpenAPIFilterSet;
      const defaultOpts = defaultFilterJson as OpenAPIFilterSet;
      const options = {filterSet: filterOpts, defaultFilter: defaultOpts} as OpenAPIFilterOptions;
      output = await openapiFilter(oaObj, options) as OpenAPIResult;
      oaObj = output.data as OpenAPIV3.Document || {data: oaObj};
    }

    // Apply OpenAPI Overlay
    if (overlaySet?.length > 0) {
      const OverlayOpts = await parseString(overlaySet) as Record<string, unknown>;
      const options = {overlaySet: OverlayOpts} as OpenAPIOverlayOptions;
      const { data, resultData } = await openapiOverlay(oaObj, options);
      output.data = data;
      oaObj = output.data as OpenAPIV3.Document || {data: oaObj};
      output.resultData = { ...output.resultData, ...resultData };
    }

    // Sort OpenAPI
    if (sort) {
      let sortOpts = {};
      if (sortSet) {
        sortOpts = await parseString(sortSet) as OpenAPISortSet;
      }
      const defaultOpts = defaultSortJson as OpenAPISortSet;
      const options = {sortSet: Object.assign({}, defaultOpts, sortOpts), sortComponentsSet: []} as OpenAPISortOptions;
      const sortedRes = await openapiSort(oaObj, options) as OpenAPIResult;
      output.data = sortedRes.data;
      oaObj = output.data as OpenAPIV3.Document || {data: oaObj};
    }

    // Change case OpenAPI
    if (casingSet?.length > 0) {
      const caseOpts = await parseString(casingSet) as OpenAPICasingSet;
      const options = {casingSet: caseOpts} as OpenAPICasingOptions;
      const casedRes = await openapiChangeCase(oaObj, options);
      output.data = casedRes.data;
    }

    // Convert output to JSON/YAML format
    convertOptions.format = _format;
    output.data = await stringify(output.data, convertOptions);
    res.status(200).json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({error: message});
  }
}
