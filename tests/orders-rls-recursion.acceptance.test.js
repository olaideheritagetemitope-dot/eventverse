import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/0025_orders_rls_recursion_fix.sql'),
  'utf8',
);

const paymentsPolicy = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/0005_rbac_operational_boundaries.sql'),
  'utf8',
);

describe('orders RLS recursion fix', () => {
  it('uses security-definer helpers for order ownership and event visibility', () => {
    expect(migration).toMatch(/create or replace function public\.order_is_owned_by_current_user\(target_order_id uuid\)/i);
    expect(migration).toMatch(/create or replace function public\.order_is_visible_to_current_user\(target_order_id uuid\)/i);
    expect(migration).toMatch(/security\s+definer/i);
    expect(migration).toMatch(/set search_path = public/i);
  });

  it('removes direct recursive orders policy subqueries and recreates authenticated policies', () => {
    expect(migration).toMatch(/drop policy if exists "users view own orders" on public\.orders/i);
    expect(migration).toMatch(/drop policy if exists "organizers view own orders" on public\.orders/i);
    expect(migration).toMatch(/drop policy if exists "organizers view owned event orders" on public\.orders/i);
    expect(migration).toMatch(/for select\s+to authenticated\s+using \(public\.order_is_owned_by_current_user\(id\)\)/i);
    expect(migration).not.toMatch(/using \([^;]*from public\.orders/i);
  });

  it('preserves normal-user ownership and blocks anonymous access through authenticated grants', () => {
    expect(migration).toMatch(/grant execute on function public\.order_is_owned_by_current_user\(uuid\) to authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.order_is_visible_to_current_user\(uuid\) to authenticated/i);
    expect(migration).toMatch(/to authenticated\s+using \(public\.order_is_owned_by_current_user\(id\)\)/i);
    expect(migration).not.toMatch(/to anon/i);
  });

  it('keeps admin-only mutation semantics for order items and does not expose sensitive payment columns', () => {
    expect(migration).toMatch(/public\.order_is_owned_by_current_user\(order_id\) or public\.is_admin\(\)/i);
    expect(paymentsPolicy).toMatch(/authorized users view operational payments/i);
    expect(paymentsPolicy).toMatch(/users view own payments/i);
  });

  it('does not disable RLS or alter payment/ticket fulfillment contracts', () => {
    expect(migration).not.toMatch(/disable row level security/i);
    expect(migration).not.toMatch(/drop table|truncate|delete from/i);
    expect(migration).not.toMatch(/alter table public\.(payments|tickets)/i);
  });
});
