import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  url: string;
  first_seen_at: string;
}

function matchesAlert(property: Property, alert: UserAlert): boolean {
  // Check price range
  if (alert.min_price && property.price && property.price < alert.min_price) {
    return false;
  }
  if (alert.max_price && property.price && property.price > alert.max_price) {
    return false;
  }
  
  // Check bedrooms
  if (alert.min_bedrooms && property.bedrooms && property.bedrooms < alert.min_bedrooms) {
    return false;
  }
  if (alert.max_bedrooms && property.bedrooms && property.bedrooms > alert.max_bedrooms) {
    return false;
  }
  
  // Check property types
  if (alert.property_types && alert.property_types.length > 0 && property.property_type) {
    if (!alert.property_types.includes(property.property_type)) {
      return false;
    }
  }
  
  // Check sources
  if (alert.sources && alert.sources.length > 0) {
    if (!alert.sources.includes(property.source)) {
      return false;
    }
  }
  
  // Check postal codes
  if (alert.postal_codes && alert.postal_codes.length > 0 && property.postal_code) {
    const matches = alert.postal_codes.some(code => 
      property.postal_code?.toLowerCase().includes(code.toLowerCase()) ||
      property.address?.toLowerCase().includes(code.toLowerCase())
    );
    if (!matches) {
      return false;
    }
  }
  
  // Check keywords
  if (alert.keywords && alert.keywords.length > 0) {
    const searchText = `${property.title} ${property.description} ${property.address}`.toLowerCase();
    const matches = alert.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    if (!matches) {
      return false;
    }
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
        from: "Property Alert <onboarding@resend.dev>",
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

    console.log(`Found ${newProperties?.length || 0} new properties from the last ${hours} hours`);

    let notificationsSent = 0;

    // Process each alert against new properties
    for (const alert of alerts || []) {
      // Get user profile for contact information and pause state
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email, phone, notifications_paused')
        .eq('user_id', alert.user_id)
        .maybeSingle();

      // Skip this user if they paused notifications
      if (userProfile?.notifications_paused) {
        continue;
      }

      for (const property of newProperties || []) {
        if (!matchesAlert(property, alert)) continue;

        const message = createNotificationMessage(property, alert.name);
        // Atomically record the notification first to avoid duplicate sends across concurrent runs
        const { data: inserted, error: upsertError } = await supabase
          .from('notifications')
          .upsert({
            user_id: alert.user_id,
            property_id: property.id,
            alert_id: alert.id,
            message,
            sent_at: new Date().toISOString()
          }, { onConflict: 'user_id,property_id', ignoreDuplicates: true })
          .select('id');

        if (upsertError) {
          console.error('Failed to upsert notification record', upsertError);
          continue;
        }

        // If a row was returned, it means a new record was inserted (not ignored)
        if (inserted && inserted.length > 0) {
          if (userProfile?.email) {
            await sendNotifications(property, alert, userProfile);
          }
          notificationsSent++;
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