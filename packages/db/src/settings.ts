// Outlet and business details the owner keeps up to date (receipts, UPI QR, GST).
import type { Db } from './client.ts';

/** A typed-in value, or null when left blank. */
function blank(value: string | null | undefined): string | null {
  const t = value?.trim() ?? '';
  return t === '' ? null : t;
}

export interface OutletDetails {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  upiVpa: string | null;
}

export interface BusinessDetails {
  id: string;
  name: string;
  gstin: string | null;
  gstScheme: 'regular' | 'composition';
  pricesIncludeTax: boolean;
}

export async function fetchOutletDetails(db: Db, outletId: string): Promise<OutletDetails> {
  const { data, error } = await db
    .from('outlets')
    .select('id, name, address, city, upi_vpa')
    .eq('id', outletId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    city: data.city,
    upiVpa: data.upi_vpa,
  };
}

export async function updateOutletDetails(db: Db, o: OutletDetails): Promise<void> {
  const { error } = await db
    .from('outlets')
    .update({
      name: o.name.trim(),
      address: blank(o.address),
      city: blank(o.city),
      upi_vpa: blank(o.upiVpa),
    })
    .eq('id', o.id);
  if (error) throw error;
}

export async function fetchBusinessDetails(db: Db, orgId: string): Promise<BusinessDetails> {
  const { data, error } = await db
    .from('orgs')
    .select('id, name, gstin, gst_scheme, prices_include_tax')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    gstin: data.gstin,
    gstScheme: data.gst_scheme === 'composition' ? 'composition' : 'regular',
    pricesIncludeTax: data.prices_include_tax,
  };
}

export async function updateBusinessDetails(db: Db, b: BusinessDetails): Promise<void> {
  const { error } = await db
    .from('orgs')
    .update({
      name: b.name.trim(),
      gstin: blank(b.gstin)?.toUpperCase() ?? null,
      gst_scheme: b.gstScheme,
      prices_include_tax: b.pricesIncludeTax,
    })
    .eq('id', b.id);
  if (error) throw error;
}
