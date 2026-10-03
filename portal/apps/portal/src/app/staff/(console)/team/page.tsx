import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { listTeam } from "@/lib/team-actions";
import { ASSIGNABLE_SECTIONS } from "@/lib/staff-sections";
import { CreateTeamMember, TeamRoster } from "./team-tools";

export const dynamic = "force-dynamic";

export default async function StaffTeamPage() {
  const team = await listTeam();
  const sections = ASSIGNABLE_SECTIONS.map((s) => ({ key: s.key, label: s.label }));

  return (
    <>
      <PageHeader
        title="Team & Access"
        subtitle="Master-admin control — add staff & employees, set their role, and decide which console sections each can access."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add a team member</CardTitle>
        </CardHeader>
        <CardBody>
          <CreateTeamMember sections={sections} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team roster &amp; access</CardTitle>
        </CardHeader>
        <CardBody>
          <TeamRoster team={team} sections={sections} />
        </CardBody>
      </Card>
    </>
  );
}
