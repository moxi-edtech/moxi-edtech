import SchoolsTableClient from "@/components/super-admin/escolas/SchoolsTableClient";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <SchoolsTableClient
      initialSchools={[]}
      initialProgress={{}}
      initialErrorMsg={null}
      fallbackSource={null}
    />
  );
}
