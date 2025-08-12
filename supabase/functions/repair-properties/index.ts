import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeTitleFromUrl(url: string, fallbackAddress?: string): string {
  try {
    const slugMatch = decodeURIComponent(url).match(/\/([a-z0-9-]+)\/?$/i);
    let candidate = slugMatch ? slugMatch[1].replace(/-/g, ' ') : '';
    // Prefer street-like tokens
    if (!/\b(straat|laan|weg|plein|singel|kade|gracht|hof|markt|dijk|park)\b/i.test(candidate)) {
      // Try earlier segment if last is an id like h102621367
      const segs = decodeURIComponent(url).split('/').filter(Boolean);
      const last = segs[segs.length - 1] || '';
      const prev = segs[segs.length - 2] || '';
      if (/^h?\d{6,}$/i.test(last) && prev) candidate = prev.replace(/-/g, ' ');
    }
    candidate = candidate.replace(/\s{2,}/g, ' ').trim();
    if (!candidate || candidate.length < 3) {
      const fb = (fallbackAddress || 'Groningen').split(',')[0].trim();
      return fb || 'Property in Groningen';
    }
    return candidate;
  } catch {
    return 'Property in Groningen';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch problematic records
    const { data: badProps, error } = await supabase
      .from('properties')
      .select('id, title, url, address')
      .or('title.ilike.%IS_MISSING%,title.ilike.%overzicht%,title.ilike.%filter%')
      .limit(500);

    if (error) throw error;

    let fixed = 0;
    if (badProps && badProps.length > 0) {
      for (const p of badProps) {
        const newTitle = sanitizeTitleFromUrl(p.url, p.address);
        if (newTitle && newTitle !== p.title) {
          const { error: upErr } = await supabase
            .from('properties')
            .update({ title: newTitle, last_updated_at: new Date().toISOString() })
            .eq('id', p.id);
          if (!upErr) fixed++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, scanned: badProps?.length || 0, fixed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e: any) {
    console.error('repair-properties error', e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
