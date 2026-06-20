import { EditorApp } from "@/components/editor/EditorApp";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorApp id={id} />;
}
