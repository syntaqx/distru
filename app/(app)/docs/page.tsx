import { getDoc } from "@/lib/docs/content";
import { Article } from "@/components/docs/article";

export default function DocsIndexPage() {
  const doc = getDoc("overview")!;
  return <Article section={doc.section} body={doc.body} />;
}
