---
title: "Reports & delivery"
section: "Copilot"
summary: "Durable report artifacts the Copilot and automations produce - view, download, email, or upload to Drive."
keywords: ["report","reports","artifact","save report","generate report","csv","markdown","download","email","google drive","deliver","delivery","notification","snapshot"]
order: 8
---
# Reports & delivery

A **Report** is a durable artifact - a saved snapshot of output (Markdown, CSV, or JSON) - that lives in the **Reports** section, separate from the live [Insights](/docs/insights) dashboard.

## Where reports come from
- An **[automation](/docs/automations)** or the **Copilot** calls `save_report` to persist its output, or `generate_report` to snapshot one of the standard reports.
- The **Insights** page's **Save snapshot to Reports** action captures any of the ~two dozen registry reports on demand.

## View, download, deliver
Open **Reports** to read a report (Markdown renders as a formatted table), download it, or see where it's been delivered. An automation can **email** a report or **upload it to Google Drive** with `email_report` / `upload_to_drive` - these run through the [integrations](/docs/integrations) seam, and each delivery is recorded on the report.

## Notifications
When a report is ready or a workflow finishes, a **notification** appears on the topbar bell and in the **Notifications** inbox (in the nav under Overview), each linking straight to the result.
