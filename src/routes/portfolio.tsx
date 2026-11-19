import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy single-page portfolio URL (removed in 65e7c7e). Existing bookmarks and
// shared links redirect to the multi-page home; browsers keep any #section
// fragment, which the home page still renders as section anchors.
export const Route = createFileRoute("/portfolio")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true, statusCode: 301 });
  },
});
