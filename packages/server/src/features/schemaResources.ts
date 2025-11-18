import type { MCPResource } from "../types.js";

interface EntityFieldDescriptor {
  name: string;
  type: string;
  description: string;
}

interface EntityTypeDescriptor {
  machineName: string;
  label: string;
  description: string;
  fields: EntityFieldDescriptor[];
}

const coreEntityTypes: EntityTypeDescriptor[] = [
  {
    machineName: "node",
    label: "Content",
    description: "Drupal content entity representing published site content.",
    fields: [
      { name: "title", type: "string", description: "Human readable title." },
      { name: "body", type: "text_long", description: "Rich text body field." },
      { name: "uid", type: "entity:user", description: "Reference to the authoring user." },
      { name: "status", type: "boolean", description: "Published flag." },
    ],
  },
  {
    machineName: "user",
    label: "User",
    description: "Account entity storing authentication and profile data.",
    fields: [
      { name: "name", type: "string", description: "Login username." },
      { name: "mail", type: "email", description: "Primary e-mail address." },
      { name: "roles", type: "string[]", description: "Assigned Drupal roles." },
      { name: "status", type: "boolean", description: "Active state." },
    ],
  },
  {
    machineName: "taxonomy_term",
    label: "Taxonomy term",
    description: "Classification entity for vocabularies and tagging systems.",
    fields: [
      { name: "vid", type: "entity:taxonomy_vocabulary", description: "Vocabulary reference." },
      { name: "name", type: "string", description: "Term display name." },
      { name: "description", type: "text_long", description: "Optional descriptive text." },
    ],
  },
];

const exportedConfiguration = {
  modules: [
    { name: "drupal", type: "core" },
    { name: "toolbar", type: "core" },
    { name: "block", type: "core" },
    { name: "config", type: "core" },
  ],
  settings: {
    site: {
      name: "DriftCore Sandbox",
      mail: "admin@example.com",
      slogan: "Composable automation for Drupal",
    },
    performance: {
      cache: true,
      pageCacheMaxAge: 900,
    },
  },
};

const projectManifestTemplate = {
  schema_version: "0.1.0",
  drupal_root: "<configured drupalRoot>",
  drupal_core_version: null,
  project_type: null,
  composer: {
    status: "missing",
  },
  custom_modules: [],
  custom_themes: [],
};

export function listSchemaResources(): MCPResource[] {
  return [
    {
      id: "schema.entityTypes",
      name: "Drupal entity type registry",
      description: "Normalized entity type definitions exported from the Drupal 11 sandbox.",
      source: "drupal:config:core.entity_type",
      mimeType: "application/json",
      data: { entityTypes: coreEntityTypes },
    },
    {
      id: "config.exported",
      name: "Drupal exported configuration",
      description: "Selected configuration synchronised from the Drupal 11 sandbox export directory.",
      source: "drupal:config:sync",
      mimeType: "application/json",
      data: exportedConfiguration,
    },
    {
      id: "project_manifest",
      name: "Drupal project manifest",
      description:
        "Summarised Drupal project context including core version, Composer dependencies, and custom modules/themes.",
      source: "drupal:project_manifest",
      mimeType: "application/json",
      data: projectManifestTemplate,
    },
  ];
}
