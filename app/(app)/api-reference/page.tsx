import { ApiReferenceView } from "@/components/api-reference-view";

export const metadata = { title: "API reference" };

/**
 * The full interactive API reference — Distru's public REST API rendered with an
 * OpenAPI explorer (getting-started docs, every endpoint, schemas, and try-it),
 * mirroring apidocs.distru.dev but driven by our own live spec.
 */
export default function ApiReferencePage() {
  return (
    <div className="h-full overflow-auto">
      <ApiReferenceView />
    </div>
  );
}
