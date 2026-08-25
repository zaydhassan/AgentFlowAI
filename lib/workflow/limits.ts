/**
 * Workflow field-length limits — enforced on create (POST /api/workflows) and
 * update (PATCH /api/workflows/[id]) so both paths agree on the maximum stored
 * length for name, description, and tags.
 */
export const WORKFLOW_NAME_MAX = 120;
export const WORKFLOW_DESCRIPTION_MAX = 2000;
export const WORKFLOW_TAGS_MAX = 20;