import { redirect } from "next/navigation";

export default function PrescriptionsIndexPage() {
  redirect("/prescriptions/new");
}
