// TODO: Implement schema resource discovery and normalization.
export interface SchemaResourceDescriptor {
  id: string;
  description: string;
  source: string;
}

export function listSchemaResources(): SchemaResourceDescriptor[] {
  // Placeholder returning empty set for now.
  return [];
}
