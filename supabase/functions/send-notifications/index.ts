import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "Property Alerts <onboarding@resend.dev>";

// Twilio configuration
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserAlert {
  id: string;
  user_id: string;
  name: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  property_types?: string[];
  postal_codes?: string[];
  cities?: string[];
  sources?: string[];
  keywords?: string[];
  is_active: boolean;
}

interface Property {
  id: string;
  external_id: string;
  source: string;
  title: string;
  description?: string;
  price?: number;
  address?: string;
  postal_code?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  surface_area?: number;
  city?: string;
  url: string;
  first_seen_at: string;
}

function normalizeType(t?: string): string | undefined {
  if (!t) return undefined;
  const v = t.toLowerCase();
  if (v === 'flat') return 'apartment';
  if (v === 'apt') return 'apartment';
  if (v.includes('apartment')) return 'apartment';
  if (v.includes('studio')) return 'studio';
  if (v.includes('room')) return 'room';
  if (v.includes('house')) return 'house';
  return v;
}

function matchesAlert(property: Property, alert: UserAlert): boolean {
  // Price range
  if (alert.min_price && property.price && property.price < alert.min_price) return false;
  if (alert.max_price && property.price && property.price > alert.max_price) return false;

  // Bedrooms
  if (alert.min_bedrooms && property.bedrooms && property.bedrooms < alert.min_bedrooms) return false;
  if (alert.max_bedrooms && property.bedrooms && property.bedrooms > alert.max_bedrooms) return false;

  // Property types (normalize synonyms: flat -> apartment)
  if (alert.property_types && alert.property_types.length > 0) {
    const wanted = alert.property_types.map(normalizeType).filter(Boolean) as string[];
    const got = normalizeType(property.property_type);
    if (got && !wanted.includes(got)) return false;
  }

  // Sources
  if (alert.sources && alert.sources.length > 0) {
    if (!alert.sources.includes(property.source)) return false;
  }

  // City-level filtering
  if (alert.cities && alert.cities.length > 0) {
    const cityMatch = alert.cities.some(c => {
      const cLower = c.toLowerCase();
      return (property.city && property.city.toLowerCase().includes(cLower)) ||
             (property.address && property.address.toLowerCase().includes(cLower));
    });
    if (!cityMatch) return false;
  }

  // Postal codes or neighborhoods in address
  if (alert.postal_codes && alert.postal_codes.length > 0) {
    const matches = alert.postal_codes.some(code => {
      const cl = code.toLowerCase();
      return (property.postal_code && property.postal_code.toLowerCase().includes(cl)) ||
             (property.address && property.address.toLowerCase().includes(cl));
    });
    if (!matches) return false;
  }

  // Keywords
  if (alert.keywords && alert.keywords.length > 0) {
    const searchText = `${property.title} ${property.description ?? ''} ${property.address ?? ''}`.toLowerCase();
    const matches = alert.keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    if (!matches) return false;
  }

  return true;
}

function formatPrice(price?: number): string {
  if (!price) return "Price on request";
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function createNotificationMessage(property: Property, alertName: string): string {
  const price = formatPrice(property.price);
  const bedrooms = property.bedrooms ? ` • ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''}` : '';
  const area = property.surface_area ? ` • ${property.surface_area}m²` : '';
  
  return `🏠 New property match for "${alertName}": ${property.title} - ${price}${bedrooms}${area} in ${property.address || 'Groningen'}. View: ${property.url}`;
}

function createEmailHTML(property: Property, alertName: string): string {
  const price = formatPrice(property.price);
  const bedrooms = property.bedrooms ? `${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''}` : 'N/A';
  const bathrooms = property.bathrooms ? `${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''}` : 'N/A';
  const area = property.surface_area ? `${property.surface_area}m²` : 'N/A';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">🏠 New Property Match!</h1>
        <h2 style="color: #1f2937; margin-bottom: 15px;">${property.title}</h2>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px 0; color: #374151;"><strong>Alert:</strong> ${alertName}</p>
          <p style="margin: 0 0 10px 0; color: #374151;"><strong>Price:</strong> ${price}</p>
          <p style="margin: 0 0 10px 0; color: #374151;"><strong>Location:</strong> ${property.address || 'Groningen'}</p>
          <p style="margin: 0 0 10px 0; color: #374151;"><strong>Bedrooms:</strong> ${bedrooms}</p>
          <p style="margin: 0 0 10px 0; color: #374151;"><strong>Bathrooms:</strong> ${bathrooms}</p>
          <p style="margin: 0 0 10px 0; color: #374151;"><strong>Size:</strong> ${area}</p>
          <p style="margin: 0 0 10px 0; color: #374151;"><strong>Source:</strong> ${property.source}</p>
        </div>
        
        ${property.description ? `<p style="color: #6b7280; margin-bottom: 20px;">${property.description}</p>` : ''}
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${property.url}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Property</a>
        </div>
        
        <p style="color: #9ca3af; font-size: 14px; margin-top: 30px; text-align: center;">
          This notification was sent because this property matches your search criteria for "${alertName}".
        </p>
      </div>
    </div>
  `;
}

async function checkUrlAvailable(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    // Try HEAD first
    const headResp = await fetch(url, { method: 'HEAD' });
    if (headResp.ok) return { ok: true, status: headResp.status };
    // Some sites block HEAD; fallback to GET
    const getResp = await fetch(url, { method: 'GET', redirect: 'follow' });
    return { ok: getResp.ok, status: getResp.status };
  } catch (e) {
    console.error('URL check failed for', url, e);
    return { ok: false, status: 0 };
  }
}

async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error("Twilio credentials not configured");
    return false;
  }

  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const body = new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Body: message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    if (response.ok) {
      console.log("SMS sent successfully");
      return true;
    } else {
      const error = await response.text();
      console.error("Failed to send SMS:", error);
      return false;
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
    return false;
  }
}

async function sendNotifications(property: Property, alert: UserAlert, userProfile: any): Promise<void> {
  // Send Email only for now
  if (userProfile.email) {
    try {
      const emailHTML = createEmailHTML(property, alert.name);
      await resend.emails.send({
        from: RESEND_FROM,
        to: [userProfile.email],
        subject: `🏠 New Property Match: ${property.title}`,
        html: emailHTML,
        text: createNotificationMessage(property, alert.name),
      });
      console.log(`Email sent to ${userProfile.email} for property: ${property.title}`);
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  } else {
    console.log("No email address found for user");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting notification processing...");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse optional request body for test/filters
    let body: any = null;
    try {
      body = await req.json();
    } catch (_) {
      body = null;
    }
const windowHours = Number(body?.windowHours ?? 24);
const onlyUserEmail: string | undefined = body?.only_user_email;
const testAll: boolean = Boolean(body?.testAll) || body?.test === 'all';

    // Optionally resolve user by email
    let userIdFilter: string | undefined;
    if (onlyUserEmail) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', onlyUserEmail)
        .maybeSingle();
      if (profileError) {
        throw profileError;
      }
      userIdFilter = profile?.user_id;
      console.log(`Filtering alerts to user with email=${onlyUserEmail}, user_id=${userIdFilter ?? 'not found'}`);
    }

    // Get active alerts (optionally filtered by user)
    let alertsQuery = supabase
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);
    if (userIdFilter) {
      alertsQuery = alertsQuery.eq('user_id', userIdFilter);
    }
    const { data: alerts, error: alertsError } = await alertsQuery;

    if (alertsError) {
      throw alertsError;
    }

    console.log(`Found ${alerts?.length || 0} active alerts${userIdFilter ? ' for specified user' : ''}`);

    // Get new properties within windowHours (default 24h)
    const hours = isNaN(windowHours) ? 24 : windowHours;
    const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data: newProperties, error: propertiesError } = await supabase
      .from('properties')
      .select('*')
      .gte('first_seen_at', cutoffIso)
      .eq('is_active', true);

    if (propertiesError) {
      throw propertiesError;
    }

const safeProperties = (newProperties || []).filter((p: any) => {
  const u = String(p.url || '');
  const title = String(p.title || '');
  const path = u.split('?')[0].toLowerCase();
  
  // Enhanced filtering to ensure quality properties
  return u && 
         !u.includes('?') && 
         !path.includes('/overzicht') && 
         !/overzicht|\?|filter|page|sort/i.test(title) &&
         title.length > 5 &&
         title.toLowerCase() !== 'property in groningen' &&
         p.price > 0; // Ensure we have valid price data
});

    console.log(`Found ${safeProperties.length} valid properties from the last ${hours} hours (filtered from ${newProperties?.length || 0})`);
    let notificationsSent = 0;

    // Process each alert against new properties
    for (const alert of alerts || []) {
      // Get user profile for contact information and pause state
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email, phone, notifications_paused')
        .eq('user_id', alert.user_id)
        .maybeSingle();

      // Respect pause state even in test mode
      if (userProfile?.notifications_paused) {
        continue;
      }

      let sentForAlert = 0;
      let skipped404 = 0;
      for (const property of safeProperties) {
        // Validate listing URL before sending
        try {
          const { ok, status } = await checkUrlAvailable(property.url);
          if (!ok && (status === 404 || status === 410)) {
            console.log(`Property ${property.id} url not available (status ${status}). Marking inactive and skipping.`);
            await supabase
              .from('properties')
              .update({ is_active: false, last_updated_at: new Date().toISOString() })
              .eq('id', property.id);
            skipped404++;
            continue;
          }
        } catch (e) {
          console.error('Error validating property URL', property.url, e);
        }

        const inTest = testAll || Boolean(body?.test);
        const match = inTest ? true : matchesAlert(property, alert);
        if (!match) continue;

        if (inTest) {
          // Test mode: send without recording to DB (no de-dup). If testAll=true, send ALL within window.
          if (userProfile?.email) {
            await sendNotifications(property, alert, userProfile);
            notificationsSent++;
            sentForAlert++;
            if (!testAll && sentForAlert >= 3) break; // cap only when not sending all
          }
          continue;
        }

        const message = createNotificationMessage(property, alert.name);
        // Check if notification already exists for this user-property pair in the last 48 hours
        // This prevents both duplicates AND ensures new properties get notifications
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id, sent_at')
          .eq('user_id', alert.user_id)
          .eq('property_id', property.id)
          .gte('sent_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .maybeSingle();
        
        if (existingNotif) {
          console.log(`Duplicate notification for user ${alert.user_id} and property ${property.id} — already sent in last 48h.`);
          continue;
        }
        
        // Record the notification
        const { data: inserted, error: upsertError } = await supabase
          .from('notifications')
          .insert({
            user_id: alert.user_id,
            property_id: property.id,
            alert_id: alert.id,
            message,
            sent_at: new Date().toISOString()
          })
          .select('id');

        if (upsertError) {
          console.error('Failed to insert notification record', upsertError);
          continue;
        }
        
        // Send the notification
        if (inserted && inserted.length > 0) {
          try {
            if (userProfile?.email) {
              await sendNotifications(property, alert, userProfile);
              console.log(`Email sent to ${userProfile.email} for property: ${property.title}`);
            }
            await supabase
              .from('notifications')
              .update({ delivery_status: 'sent', delivered_at: new Date().toISOString() })
              .eq('id', inserted[0].id);
            notificationsSent++;
          } catch (e) {
            console.error('Failed to deliver notification', e);
            await supabase
              .from('notifications')
              .update({ delivery_status: 'failed', delivery_error: String(e) })
              .eq('id', inserted[0].id);
          }
        }
      }
    }

    console.log(`Sent ${notificationsSent} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${alerts?.length || 0} alerts and sent ${notificationsSent} notifications`,
        alertsProcessed: alerts?.length || 0,
        notificationsSent,
        newProperties: newProperties?.length || 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});