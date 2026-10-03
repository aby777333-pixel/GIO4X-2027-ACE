import { Shell } from "@/components/Shell";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";

export function PlaceholderPage({ title, blurb }: { title: string; blurb: string }) {
  return (
    <Shell title={title}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-steel">{blurb}</p>
          <p className="mt-3 text-xs text-steel-light">
            This section is scaffolded. Real data and forms land in the next iteration.
          </p>
        </CardBody>
      </Card>
    </Shell>
  );
}
