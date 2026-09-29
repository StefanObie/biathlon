import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewOrganizationPage() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Create organization</CardTitle>
        <CardDescription>
          An organization runs leagues and manages its own athletes. You&apos;ll
          be its admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateOrganizationForm />
      </CardContent>
    </Card>
  );
}
