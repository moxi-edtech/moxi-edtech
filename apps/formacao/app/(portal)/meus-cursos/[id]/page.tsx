import CourseDetailClient from "./CourseDetailClient";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <CourseDetailClient id={p.id} />;
}
