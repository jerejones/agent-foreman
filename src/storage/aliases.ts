/**
 * Task terminology aliases
 * Provides aliases for feature functions using "task" terminology
 */
import { parseFeatureMarkdown } from "./parser.js";
import { serializeFeatureMarkdown } from "./serializer.js";
import { featureIdToPath, pathToFeatureId } from "./path-utils.js";
import { loadFeatureIndex, saveFeatureIndex } from "./index-ops.js";
import { loadSingleFeature, saveSingleFeature } from "./single-ops.js";

/**
 * Alias for parseFeatureMarkdown - parses task markdown
 * @see parseFeatureMarkdown
 */
export const parseTaskMarkdown = parseFeatureMarkdown;

/**
 * Alias for serializeFeatureMarkdown - serializes task to markdown
 * @see serializeFeatureMarkdown
 */
export const serializeTaskMarkdown = serializeFeatureMarkdown;

/**
 * Alias for featureIdToPath - converts task ID to path
 * @see featureIdToPath
 */
export const taskIdToPath = featureIdToPath;

/**
 * Alias for pathToFeatureId - converts path to task ID
 * @see pathToFeatureId
 */
export const pathToTaskId = pathToFeatureId;

/**
 * Alias for loadFeatureIndex - loads task index
 * @see loadFeatureIndex
 */
export const loadTaskIndex = loadFeatureIndex;

/**
 * Alias for saveFeatureIndex - saves task index
 * @see saveFeatureIndex
 */
export const saveTaskIndex = saveFeatureIndex;

/**
 * Alias for loadSingleFeature - loads single task
 * @see loadSingleFeature
 */
export const loadSingleTask = loadSingleFeature;

/**
 * Alias for saveSingleFeature - saves single task
 * @see saveSingleFeature
 */
export const saveSingleTask = saveSingleFeature;
