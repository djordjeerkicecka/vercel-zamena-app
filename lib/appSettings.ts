import { createSupabaseServiceRoleClient } from "./supabase/server";

export interface PaketiSettings {
  neposlatiPragDana: number;
  // Upper bound for the unfulfilled tab — orders older than this are ancient history
  // (already handled elsewhere) and would only clutter the list.
  neposlatiMaxDana: number;
  danaCrvenoPrag: number;
  vraceniLookbackDana: number;
}

const DEFAULTS: PaketiSettings = {
  neposlatiPragDana: 5,
  neposlatiMaxDana: 50,
  danaCrvenoPrag: 10,
  vraceniLookbackDana: 90,
};

/** Reads the "Paketi" thresholds from app_settings, falling back to defaults for any missing key. */
export async function getPaketiSettings(): Promise<PaketiSettings> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data } = await supabase.from("app_settings").select("key, value");
    const map = new Map((data ?? []).map((r) => [r.key, r.value]));

    const num = (key: string, fallback: number) => {
      const raw = map.get(key);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      neposlatiPragDana: num("neposlati_prag_dana", DEFAULTS.neposlatiPragDana),
      neposlatiMaxDana: num("neposlati_max_dana", DEFAULTS.neposlatiMaxDana),
      danaCrvenoPrag: num("dana_crveno_prag", DEFAULTS.danaCrvenoPrag),
      vraceniLookbackDana: num("vraceni_lookback_dana", DEFAULTS.vraceniLookbackDana),
    };
  } catch {
    return DEFAULTS;
  }
}
