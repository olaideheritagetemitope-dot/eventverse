import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "supabase/0019_event_staff_workflow.sql"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/user.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/EventVerse.jsx"), "utf8");

describe("Event Staff production workflow", () => {
  it("creates assignment-scoped tables and RLS policies", () => {
    expect(migration).toContain("create table if not exists public.event_staff_assignments");
    expect(migration).toContain("create table if not exists public.event_staff_tasks");
    expect(migration).toContain("create table if not exists public.event_staff_notifications");
    expect(migration).toContain("alter table public.event_staff_assignments enable row level security");
    expect(migration).toContain("staff_user_id = auth.uid()");
  });

  it("protects Organizer assignment and staff acceptance workflows with RPCs", () => {
    expect(migration).toContain("create or replace function public.search_event_staff_users");
    expect(migration).toContain("create or replace function public.assign_event_staff");
    expect(migration).toContain("create or replace function public.list_event_staff_for_organizer");
    expect(migration).toContain("create or replace function public.get_event_staff_workspace");
    expect(migration).toContain("create or replace function public.respond_event_staff_assignment");
    expect(migration).toContain("create or replace function public.revoke_event_staff_assignment");
    expect(service).toContain('supabase.rpc("assign_event_staff"');
    expect(service).toContain('supabase.rpc("respond_event_staff_assignment"');
  });

  it("scopes check-in to accepted Event Staff assignments", () => {
    expect(migration).toContain("public.event_staff_can_operate(event_id)");
    expect(migration).toContain("status = 'ACCEPTED'");
    expect(migration).toContain("You are not authorized to check in this event");
  });

  it("keeps live UI entry points for staff and Organizer assignment management", () => {
    expect(app).toContain('eventStaff: <EventStaffWorkspace');
    expect(app).toContain('nav.push("eventStaff")');
    expect(app).toContain("Assign Event Staff");
    expect(app).toContain("Accept assignment");
    expect(app).toContain("Open check-in");
  });
});
