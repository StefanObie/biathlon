import { redirect } from "next/navigation";

// The old League list is gone: bare /leagues lands the same place bare
// /organizations does.
export default function LeaguesPage() {
  redirect("/organizations");
}
