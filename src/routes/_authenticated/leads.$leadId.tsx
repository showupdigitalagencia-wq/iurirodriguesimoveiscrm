import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/leads/$leadId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/leads", search: { open: params.leadId } });
  },
});
