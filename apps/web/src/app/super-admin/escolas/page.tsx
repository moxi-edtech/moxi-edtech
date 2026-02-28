import SchoolsTableClient from "@/components/super-admin/escolas/SchoolsTableClient";
import AuditPageView from "@/components/audit/AuditPageView";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escolas_list" />
      <SchoolsTableClient
        initialSchools={[]}
        initialProgress={{}}
        initialErrorMsg={null}
        fallbackSource={null}
      />
    </>
  );
}
