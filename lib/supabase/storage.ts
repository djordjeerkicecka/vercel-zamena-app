import { randomUUID } from "node:crypto";
import { createSupabaseServiceRoleClient } from "./server";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "ticket-images";

/**
 * Uploads a single ticket image to the private Storage bucket under a folder key.
 * Images are uploaded during Step 5 of the wizard, before a ticket (and its ticket_number)
 * exists yet — so the folder is keyed by a client-generated draft id, and the resulting
 * paths are attached to the ticket row once it's created in the final submit step.
 * Returns the storage path (not a public URL — the bucket is private, admins fetch
 * signed URLs on demand).
 */
export async function uploadTicketImage(
  folderKey: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  const supabase = createSupabaseServiceRoleClient();
  // Sanitize the filename — Supabase storage keys reject spaces and many non-ASCII chars
  // (Serbian đ/č/ž etc. in a phone photo's name would otherwise fail the upload).
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "slika";
  const path = `${folderKey}/${randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Neuspešan upload slike: ${error.message}`);
  }

  return path;
}

export async function createSignedImageUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new Error(`Neuspešno kreiranje signed URL-a: ${error?.message}`);
  }

  return data.signedUrl;
}

export async function deleteTicketImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    throw new Error(`Neuspešno brisanje slika: ${error.message}`);
  }
}
