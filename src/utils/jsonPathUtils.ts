/**
 * Utility functions for JSONPath operations
 */

/**
 * Categorize JSONPath suggestions for better performance and UX
 */
export enum SuggestionCategory {
  SCHEMA_FIELD = 0,      // Actual fields from schema
  PROPERTY_ACCESS = 1,   // Direct property access like .properties, .type
  ARRAY_ACCESS = 2,      // Array access patterns like [0], [*]
  SYNTAX_ELEMENT = 3,    // Basic syntax elements like ., .., *
  OTHER = 4              // Other suggestions
}

/**
 * Interface for categorized suggestions with sorting information
 */
interface CategorizedSuggestion {
  text: string;
  category: SuggestionCategory;
  frequency?: number;  // How often this pattern appears in schema
  importance: number; // Custom importance score
}

/**
 * Extracts property paths from an OpenAPI schema object
 * @param obj The OpenAPI schema object
 * @param parentPath The parent path prefix (for recursion)
 * @param maxDepth Maximum recursion depth
 * @returns An array of property paths
 */
export const extractPropertyPaths = (
  obj: any,
  parentPath: string = '',
  maxDepth: number = 3
): string[] => {
  if (!obj || typeof obj !== 'object' || maxDepth <= 0) {
    return [];
  }

  let paths: string[] = [];

  // Add common OpenAPI paths as defaults
  if (!parentPath) {
    paths = [
      'info',
      'paths',
      'components',
      'tags',
      'servers',
      'externalDocs',
      'security',
      'webhooks',
      'openapi'
    ];
  }

  // Process object properties
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip properties that start with $ or _
      if (key.startsWith('$') || key.startsWith('_')) {
        continue;
      }

      // Add current property to paths
      paths.push(key);

      // Recursively process child properties
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const childPath = parentPath ? `${parentPath}.${key}` : key;

        // For arrays, add array syntax suggestions
        if (Array.isArray(obj[key])) {
          paths.push(`${key}[*]`);

          // Add index-based access for small arrays
          if (obj[key].length <= 5) {
            for (let i = 0; i < obj[key].length; i++) {
              paths.push(`${key}[${i}]`);
            }
          }

          // If array contains objects, recursively get their properties
          if (obj[key].length > 0 && typeof obj[key][0] === 'object') {
            const arrayChildPaths = extractPropertyPaths(obj[key][0], '', maxDepth - 1);
            arrayChildPaths.forEach(childKey => {
              paths.push(`${key}[*].${childKey}`);
            });
          }
        } else {
          // For objects, recursively extract properties
          const childPaths = extractPropertyPaths(obj[key], childPath, maxDepth - 1);
          paths.push(...childPaths);
        }
      }
    }
  }

  return Array.from(new Set(paths)); // Remove duplicates
};

/**
 * Specifically extract paths from OpenAPI schema with proper path formatting
 * @param schema OpenAPI schema object
 * @returns Array of JSONPath expressions for the OpenAPI schema
 */
export const extractOpenAPISpecificPaths = (schema: any): string[] => {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  const paths: string[] = [];

  // Special handling for paths object in OpenAPI
  if (schema.paths) {
    // Get all path keys
    const pathKeys = Object.keys(schema.paths);

    // Add basic paths entry
    paths.push('$.paths');

    for (const pathKey of pathKeys) {
      // Add path with proper escaping
      const escapedPath = pathKey.includes('/') ?
        `$.paths['${pathKey}']` :
        `$.paths.${pathKey}`;

      paths.push(escapedPath);

      // Add HTTP methods if they exist
      const pathItem = schema.paths[pathKey];
      if (pathItem && typeof pathItem === 'object') {
        const methods = ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'trace']
          .filter(method => pathItem[method]);

        for (const method of methods) {
          paths.push(`${escapedPath}.${method}`);

          // Add common operation properties
          if (pathItem[method]) {
            if (pathItem[method].operationId) {
              paths.push(`${escapedPath}.${method}.operationId`);
            }
            if (pathItem[method].parameters) {
              paths.push(`${escapedPath}.${method}.parameters`);
            }
            if (pathItem[method].requestBody) {
              paths.push(`${escapedPath}.${method}.requestBody`);

              // Add content types
              if (pathItem[method].requestBody.content) {
                paths.push(`${escapedPath}.${method}.requestBody.content`);

                const contentTypes = Object.keys(pathItem[method].requestBody.content);
                for (const contentType of contentTypes) {
                  const contentPath = `${escapedPath}.${method}.requestBody.content['${contentType}']`;
                  paths.push(contentPath);

                  // Add schema if exists
                  if (pathItem[method].requestBody.content[contentType].schema) {
                    paths.push(`${contentPath}.schema`);

                    // Add properties if they exist
                    const schema = pathItem[method].requestBody.content[contentType].schema;
                    if (schema.properties) {
                      paths.push(`${contentPath}.schema.properties`);

                      // Add each property
                      const properties = Object.keys(schema.properties);
                      for (const prop of properties) {
                        paths.push(`${contentPath}.schema.properties.${prop}`);
                      }
                    }
                  }
                }
              }
            }
            if (pathItem[method].responses) {
              paths.push(`${escapedPath}.${method}.responses`);

              // Add specific response codes
              const responseCodes = Object.keys(pathItem[method].responses);
              for (const code of responseCodes) {
                const responsePath = `${escapedPath}.${method}.responses['${code}']`;
                paths.push(responsePath);

                // Add content if it exists
                const response = pathItem[method].responses[code];
                if (response.content) {
                  paths.push(`${responsePath}.content`);

                  // Add content types
                  const contentTypes = Object.keys(response.content);
                  for (const contentType of contentTypes) {
                    paths.push(`${responsePath}.content['${contentType}']`);

                    // Add schema if exists
                    if (response.content[contentType].schema) {
                      paths.push(`${responsePath}.content['${contentType}'].schema`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Special handling for components
  if (schema.components) {
    paths.push('$.components');

    // Handle common component sections
    const componentSections = [
      'schemas', 'responses', 'parameters', 'examples',
      'requestBodies', 'headers', 'securitySchemes',
      'links', 'callbacks'
    ];

    for (const section of componentSections) {
      if (schema.components[section]) {
        paths.push(`$.components.${section}`);

        // Add specific component names
        const components = Object.keys(schema.components[section]);
        for (const component of components) {
          paths.push(`$.components.${section}.${component}`);

          // For schemas, add properties
          if (section === 'schemas' &&
              schema.components.schemas[component] &&
              schema.components.schemas[component].properties) {

            paths.push(`$.components.schemas.${component}.properties`);

            // Add individual properties
            const properties = Object.keys(schema.components.schemas[component].properties);
            for (const prop of properties) {
              paths.push(`$.components.schemas.${component}.properties.${prop}`);
            }
          }
        }
      }
    }
  }

  return paths;
};

/**
 * Get common JSONPath expressions for OpenAPI schemas
 * @returns An array of common JSONPath expressions
 */
export const getCommonJSONPathExpressions = (): string[] => {
  return [
    // Root-level expressions
    "$",
    "$.info",
    "$.info.title",
    "$.info.version",
    "$.info.description",
    "$.paths",
    "$.components",
    "$.tags",
    "$.servers",

    // Path operations
    "$.paths.*",
    "$.paths.*.*",
    "$.paths.*.get",
    "$.paths.*.post",
    "$.paths.*.put",
    "$.paths.*.delete",
    "$.paths.*.parameters",

    // Component schemas
    "$.components.schemas",
    "$.components.responses",
    "$.components.parameters",
    "$.components.examples",
    "$.components.requestBodies",
    "$.components.headers",
    "$.components.securitySchemes",
    "$.components.links",
    "$.components.callbacks",

    // Wildcards and array expressions
    "$..description",
    "$..schema",
    "$..type",
    "$..properties",
    "$..items",
    "$..required",
    "$..parameters",
    "$..responses",
    "$..operationId",
    "$..summary",
    "$..tags",
  ];
};

/**
 * Analyze a JSONPath to determine what segment the user is currently typing
 * @param path Current JSONPath being typed
 * @param cursorPosition Current cursor position in the path
 * @returns Information about the current segment
 */
export const analyzeCurrentSegment = (path: string, cursorPosition: number = path.length): {
  fullPath: string;
  currentSegmentStart: number;
  currentSegmentEnd: number;
  currentSegment: string;
  parentPath: string;
  isTypingProperty: boolean;
  isInBrackets: boolean;
} => {
  // Work with the portion of the path up to the cursor
  const pathToCursor = path.substring(0, cursorPosition);

  // Find delimiters
  const lastDotIndex = pathToCursor.lastIndexOf('.');
  const lastOpenBracketIndex = pathToCursor.lastIndexOf('[');
  const lastCloseBracketIndex = pathToCursor.lastIndexOf(']');

  let currentSegmentStart = 0;
  let parentPath = '';
  let isTypingProperty = false;
  let isInBrackets = false;

  // Determine if we're typing a property name (after a dot)
  if (lastDotIndex > lastCloseBracketIndex) {
    currentSegmentStart = lastDotIndex + 1;
    parentPath = path.substring(0, lastDotIndex);
    isTypingProperty = true;
  }
  // Determine if we're typing inside brackets
  else if (lastOpenBracketIndex > lastCloseBracketIndex) {
    currentSegmentStart = lastOpenBracketIndex + 1;
    parentPath = path.substring(0, lastOpenBracketIndex);
    isInBrackets = true;
  }
  // Just starting from root or after a closed bracket
  else if (lastCloseBracketIndex > 0 && lastCloseBracketIndex === pathToCursor.length - 1) {
    currentSegmentStart = lastCloseBracketIndex + 1;
    parentPath = path.substring(0, lastCloseBracketIndex + 1);
  }
  // At root level
  else if (pathToCursor.startsWith('$')) {
    currentSegmentStart = 1; // Start after the $
    parentPath = '$';
  }

  // Find the end of the current segment
  let currentSegmentEnd = path.length;

  // Extract the current segment
  const currentSegment = path.substring(currentSegmentStart, cursorPosition);

  return {
    fullPath: path,
    currentSegmentStart,
    currentSegmentEnd,
    currentSegment,
    parentPath,
    isTypingProperty,
    isInBrackets
  };
};

/**
 * Calculate the common path between two JSONPaths
 * @param path1 First JSONPath
 * @param path2 Second JSONPath
 * @returns Length of common prefix
 */
export const commonPathLength = (path1: string, path2: string): number => {
  // Parse path segments for more accurate comparison
  const segments1 = parsePathSegments(path1);
  const segments2 = parsePathSegments(path2);

  let commonLength = 0;
  const minLength = Math.min(segments1.length, segments2.length);

  for (let i = 0; i < minLength; i++) {
    if (segments1[i] === segments2[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  return commonLength;
};

/**
 * Parse a JSONPath into segments for better comparison
 */
const parsePathSegments = (path: string): string[] => {
  // Handle empty paths
  if (!path) return [];

  // Special case for root
  if (path === '$') return ['$'];

  // Remove leading $ if present
  const normalizedPath = path.startsWith('$') ? path.substring(1) : path;

  // Split by dots but preserve dots inside quotes or brackets
  const segments: string[] = [];
  let currentSegment = '';
  let inBrackets = false;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < normalizedPath.length; i++) {
    const char = normalizedPath[i];

    if (char === '[' && !inQuotes) {
      inBrackets = true;
      currentSegment += char;
    }
    else if (char === ']' && !inQuotes) {
      inBrackets = false;
      currentSegment += char;
    }
    else if ((char === "'" || char === '"') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      currentSegment += char;
    }
    else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      currentSegment += char;
    }
    else if (char === '.' && !inBrackets && !inQuotes) {
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = '';
      }
    }
    else {
      currentSegment += char;
    }
  }

  // Add the last segment if not empty
  if (currentSegment) {
    segments.push(currentSegment);
  }

  // Add the root at the beginning
  return ['$', ...segments];
};

/**
 * Categorize and sort suggestions based on relevance to current path
 * @param suggestions Raw suggestions
 * @param currentPath Path being typed
 * @param cursorPosition Current cursor position
 * @returns Sorted suggestions array
 */
export const categorizeAndSortSuggestions = (
  suggestions: string[],
  currentPath: string,
  cursorPosition: number = currentPath.length
): string[] => {
  if (!suggestions.length) return [];

  // Analyze the current path segment
  const analysis = analyzeCurrentSegment(currentPath, cursorPosition);

  // Track suggestion frequencies
  const frequencyMap = new Map<string, number>();

  // Categorize all suggestions
  const categorized: CategorizedSuggestion[] = suggestions.map(suggestion => {
    // Count frequency for popular segments
    const segments = suggestion.split(/\.|\[|\]/).filter(Boolean);
    segments.forEach(seg => {
      frequencyMap.set(seg, (frequencyMap.get(seg) || 0) + 1);
    });

    // Calculate common path length for similarity
    const commonLength = commonPathLength(currentPath, suggestion);

    // Determine category based on path analysis
    let category = SuggestionCategory.OTHER;
    let importance = 0;

    // Handle suggestions that match what the user is typing
    if (analysis.isTypingProperty || analysis.isInBrackets) {
      const prefix = analysis.currentSegment.toLowerCase();

      // Direct next segment - highest priority
      if (suggestion.toLowerCase().startsWith(prefix)) {
        category = SuggestionCategory.SCHEMA_FIELD;
        importance = 100 - suggestion.length; // Shorter matches are more likely what user wants
      }
      // Could be related to the parent path
      else if (analysis.parentPath && suggestion.startsWith(analysis.parentPath)) {
        category = SuggestionCategory.PROPERTY_ACCESS;
        importance = 80 - (suggestion.length - analysis.parentPath.length);
      }
      // Common sibling at the same level
      else if (commonLength > 0) {
        category = SuggestionCategory.ARRAY_ACCESS;
        importance = 70 - (suggestion.length - commonLength);
      }
      // JSONPath syntax element
      else if (isSyntaxElement(suggestion)) {
        category = SuggestionCategory.SYNTAX_ELEMENT;
        importance = 50;
      }
      // Related but not direct match
      else if (suggestion.includes(prefix)) {
        category = SuggestionCategory.OTHER;
        importance = 30;
      }
    }
    // Handle root level suggestions
    else if (currentPath === '$' || currentPath === '') {
      if (DEFAULT_JSONPATH_PARTS.includes(suggestion)) {
        category = SuggestionCategory.SCHEMA_FIELD;
        importance = 100;
      } else if (suggestion.startsWith('$.')) {
        category = SuggestionCategory.PROPERTY_ACCESS;
        importance = 80;
      }
    }

    return {
      text: suggestion,
      category,
      importance: importance || 0,
      frequency: frequencyMap.get(suggestion) || 0
    };
  });

  // Sort suggestions by category, then by importance, then by length
  const sorted = categorized.sort((a, b) => {
    // First by category (lower value = higher priority)
    if (a.category !== b.category) {
      return a.category - b.category;
    }

    // Then by importance (higher value = higher priority)
    if (a.importance !== b.importance) {
      return b.importance - a.importance;
    }

    // Finally by frequency (higher value = higher priority)
    return (b.frequency || 0) - (a.frequency || 0);
  });

  // Return sorted suggestions (text only)
  return sorted.map(s => s.text);
};

/**
 * Check if suggestion is a JSONPath syntax element
 */
const isSyntaxElement = (suggestion: string): boolean => {
  const syntaxElements = ['.', '.*', '.**', '[*]', '[?()]', '@', '$..*'];
  return syntaxElements.includes(suggestion) || suggestion.startsWith('$.');
};

/**
 * Generate path suggestions based on an OpenAPI schema and user input
 * @param schema The OpenAPI schema object
 * @param inputPath User's current input
 * @param cursorPosition Current cursor position
 * @returns An array of path suggestions
 */
export const generatePathSuggestions = (
  schema: any,
  inputPath: string = '',
  cursorPosition: number = inputPath.length
): string[] => {
  // Get all possible suggestions
  const commonPaths = getCommonJSONPathExpressions();
  const extractedPaths = extractPropertyPaths(schema);
  const specPaths = extractOpenAPISpecificPaths(schema);

  // Combine all suggestions
  const allSuggestions = Array.from(new Set([...commonPaths, ...extractedPaths, ...specPaths]));

  // Filter and sort suggestions based on the current input path
  if (!inputPath) {
    // If no input, return basic sorted suggestions
    return categorizeAndSortSuggestions(allSuggestions, '$');
  }

  // If we have a partial path, get the part being typed
  const analysis = analyzeCurrentSegment(inputPath, cursorPosition);

  // Filter suggestions based on current segment
  const filteredSuggestions = allSuggestions.filter(suggestion => {
    // If typing property after dot, filter by property name
    if (analysis.isTypingProperty && analysis.currentSegment) {
      const relevantPart = suggestion.toLowerCase();
      return relevantPart.includes(analysis.currentSegment.toLowerCase());
    }
    // If typing in brackets, filter by content that would go in brackets
    else if (analysis.isInBrackets && analysis.currentSegment) {
      // Look for suggestions that would appear in brackets
      return suggestion.toLowerCase().includes(analysis.currentSegment.toLowerCase());
    }
    // Otherwise, filter by the whole path so far
    return suggestion.toLowerCase().includes(inputPath.toLowerCase());
  });

  // Sort filtered suggestions by relevance
  return categorizeAndSortSuggestions(filteredSuggestions, inputPath, cursorPosition);
};

/**
 * Get path suggestions contextually based on the current path being typed
 * @param schema The OpenAPI schema object
 * @param currentPath Current partial path being typed
 * @param cursorPosition Current cursor position
 * @returns Array of relevant path suggestions
 */
/**
 * Extract keys from a YAML/JSON string
 */
export const extractKeysFromPreview = (preview: string): string[] => {
  if (!preview) return [];
  
  try {
    const parsed = JSON.parse(preview);
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.keys(parsed);
    }
  } catch (e) {
    // If not JSON, try parsing as YAML
    try {
      const parsed = require('yaml').parse(preview);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.keys(parsed);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  return [];
};

export const getContextualSuggestions = (
  schema: any,
  currentPath: string,
  cursorPosition: number = currentPath.length,
  previewValue?: string
): string[] => {
  if (!currentPath || !schema) {
    return DEFAULT_JSONPATH_PARTS;
  }

  // If starts with $ but no further context, give root suggestions
  if (currentPath === '$') {
    return ['.info', '.paths', '.components', '.tags', '.servers'];
  }

  // Analyze the current path segment
  const analysis = analyzeCurrentSegment(currentPath, cursorPosition);

  // Try to resolve the parent path to get context-aware suggestions
  try {
    // Try to resolve the parent object from schema
    const parent = resolveSchemaPath(schema, analysis.parentPath);

    if (parent && typeof parent === 'object') {
      // Extract keys from the parent object
      const keys = Object.keys(parent).filter(k => !k.startsWith('$') && !k.startsWith('_'));

      // Categorize suggestions
      const schemaFields: string[] = [];
      const commonProps: string[] = [];
      const syntaxElements: string[] = [];

      // Common OpenAPI properties
      const commonOpenAPIProps = ['type', 'properties', 'items', 'required', 'description', 'format'];

      keys.forEach(key => {
        if (commonOpenAPIProps.includes(key)) {
          commonProps.push(key);
        } else {
          schemaFields.push(key);
        }
      });

      // Add syntax elements if appropriate
      if (!analysis.currentSegment) {
        if (Array.isArray(parent)) {
          syntaxElements.push('[*]', '[0]');
        }
        syntaxElements.push('.*', '.**', '..');
      }

      // Format and combine suggestions in priority order
      let contextualSuggestions: string[] = [];

      const formatKey = (k: string) => {
        if (analysis.isInBrackets) {
          return (k.includes(' ') || k.includes('-') || k.includes('/')) ? `'${k}'` : k;
        }
        return analysis.isTypingProperty ? k : `.${k}`;
      };

      // Add suggestions in priority order
      contextualSuggestions = [
        ...schemaFields.map(formatKey),
        ...commonProps.map(formatKey),
        ...syntaxElements
      ];

      // Filter based on what's being typed
      if (analysis.currentSegment) {
        const prefix = analysis.currentSegment.toLowerCase();
        contextualSuggestions = contextualSuggestions.filter(suggestion =>
          suggestion.toLowerCase().startsWith(prefix)
        );
      }

      return contextualSuggestions;
    }
  } catch (e) {
    console.log('Error getting contextual suggestions:', e);
  }

  // Fall back to generic suggestions
  return generatePathSuggestions(schema, currentPath, cursorPosition);
};

/**
 * Resolve a JSONPath expression against a schema to get the referenced object
 * This is a simplified implementation for contextual suggestions
 * @param schema Schema object
 * @param path JSONPath expression
 * @returns The referenced object or undefined
 */
const resolveSchemaPath = (schema: any, path: string): any => {
  if (!schema || !path) return undefined;

  // Handle root
  if (path === '$') return schema;

  // Remove leading $ if present
  const normalizedPath = path.startsWith('$') ? path.substring(1) : path;

  let current = schema;
  let buffer = '';
  let inQuotes = false;
  let quoteChar = '';

  // Process path character by character for better accuracy
  for (let i = 0; i < normalizedPath.length; i++) {
    const char = normalizedPath[i];

    if ((char === "'" || char === '"') && (!inQuotes || quoteChar === char)) {
      inQuotes = !inQuotes;
      quoteChar = char;
      buffer += char;
    } else if (char === '[' && !inQuotes) {
      if (buffer) {
        current = current[buffer.replace(/^\./, '')];
        buffer = '';
      }
    } else if (char === ']' && !inQuotes) {
      const key = buffer.replace(/['"]/g, '');
      current = current[key];
      buffer = '';
    } else if (char === '.' && !inQuotes) {
      if (buffer) {
        const key = buffer.replace(/^\./, '');
        if (key) current = current[key];
        buffer = '';
      }
    } else {
      buffer += char;
    }

    if (current === undefined) return undefined;
  }

  // Handle any remaining buffer
  if (buffer) {
    const key = buffer.replace(/^\./, '');
    if (key) current = current[key];
  }

  return current;
};

/**
 * Default JSONPath common elements
 */
export const DEFAULT_JSONPATH_PARTS = [
  "$",
  ".",
  "..",
  "[",
  "]",
  "*",
  "?",
  "(",
  ")",
  "@",
  "$.paths",
  "$.components",
  "$.info"
];
