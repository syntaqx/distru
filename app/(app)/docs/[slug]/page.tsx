import { notFound } from "next/navigation";
import { getDoc } from "@/lib/docs/content";
import { Article } from "@/components/docs/article";

export default async function DocArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  return <Article section={doc.section} body={doc.body} />;
}
