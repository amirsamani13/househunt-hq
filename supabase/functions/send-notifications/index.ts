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
  const bathrooms = property.bathrooms ? ` • ${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''}` : '';
  const area = property.surface_area ? ` • ${property.surface_area}m²` : '';
  const features = property.features && property.features.length > 0 ? ` • ${property.features.join(', ')}` : '';
  const address = property.address || 'Groningen';
  const postalCode = property.postal_code ? ` (${property.postal_code})` : '';
  
  let message = `🏠 New property match for "${alertName}":

${property.title}
💰 ${price}${bedrooms}${bathrooms}${area}
📍 ${address}${postalCode}`;

  if (property.description && property.description.length > 20) {
    message += `\n📝 ${property.description.substring(0, 100)}${property.description.length > 100 ? '...' : ''}`;
  }
  
  if (features) {
    message += `\n✨ Features:${features}`;
  }
  
  message += `\n\n🔗 View full details: ${property.url}`;
  
  return message;
}

function createEmailHTML(property: Property, alertName: string): string {
  const price = formatPrice(property.price);
  const bedrooms = property.bedrooms ? `${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''}` : 'N/A';
  const bathrooms = property.bathrooms ? `${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''}` : 'N/A';
  const area = property.surface_area ? `${property.surface_area}m²` : 'N/A';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Property Alert - ${property.title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: -30px -30px 30px -30px; text-align: center; }
            .property-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .price { font-size: 24px; font-weight: bold; color: #667eea; margin-bottom: 15px; }
            .details { margin: 15px 0; }
            .detail-item { display: inline-block; margin: 5px 10px 5px 0; padding: 5px 10px; background: #e9ecef; border-radius: 15px; font-size: 14px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏠 New Property Alert!</h1>
                <p>A property matching your "${alertName}" alert has been found</p>
            </div>
            
            <div class="property-card">
                <h2 style="margin-top: 0; color: #333;">${property.title}</h2>
                <div class="price">${price}</div>
                
                <div class="details">
                    ${property.surface_area ? `<span class="detail-item">📐 ${area}</span>` : ''}
                    ${property.bedrooms ? `<span class="detail-item">🛏️ ${bedrooms}</span>` : ''}
                    ${property.bathrooms ? `<span class="detail-item">🚿 ${bathrooms}</span>` : ''}
                    ${property.property_type ? `<span class="detail-item">🏷️ ${property.property_type}</span>` : ''}
                    <span class="detail-item">🌐 ${property.source}</span>
                </div>
                
                ${property.address ? `<p><strong>📍 Location:</strong> ${property.address}${property.postal_code ? ` (${property.postal_code})` : ''}</p>` : ''}
                ${property.description ? `<p><strong>📝 Description:</strong> ${property.description}</p>` : ''}
                ${property.features && property.features.length > 0 ? `<p><strong>✨ Features:</strong> ${property.features.join(', ')}</p>` : ''}
                
                <a href="${property.url}" class="cta-button" target="_blank" rel="noopener">
                    🔗 View Property Details
                </a>
            </div>
            
            <div class="footer">
                <p>This property was found on <strong>${property.source}</strong> and matches your saved alert "<em>${alertName}</em>".</p>
                <p>Act fast - good properties in Groningen are usually taken quickly!</p>
                <p style="margin-top: 15px;">
                    <small>You're receiving this because you have an active property alert.</small>
                </p>
            </div>
        </div>
    </body>
    </html>
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
  // Send Email notification
  if (userProfile.email) {
    try {
      const emailHTML = createEmailHTML(property, alert.name);
      const notificationText = createNotificationMessage(property, alert.name);
      
      // Enhanced subject line with key property details
      const priceStr = formatPrice(property.price);
      const locationStr = property.city || 'Groningen';
      const subject = `🏠 New Property Alert: ${priceStr} in ${locationStr}`;
      
      const { data, error } = await resend.emails.send({
        from: RESEND_FROM,
        to: [userProfile.email],
        subject: subject,
        html: emailHTML,
        text: notificationText,
      });

      if (error) {
        // Properly format Resend API errors
        const errorDetails = {
          message: error.message || 'Resend API error',
          name: error.name || 'ResendError',
          code: error.code || 'unknown',
          details: error
        };
        console.error('Resend API error details:', errorDetails);
        throw new Error(`Resend API failed: ${error.message || JSON.stringify(error)}`);
      }

      console.log(`✅ Email sent successfully to ${userProfile.email} for property: ${property.title}`);
    } catch (error) {
      // Properly handle and format error messages
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else {
        errorMessage = String(error);
      }
      
      console.error(`❌ Failed to send email to ${userProfile.email}:`, {
        error: errorMessage,
        propertyTitle: property.title,
        alertName: alert.name,
        userEmail: userProfile.email
      });
      throw new Error(`Email delivery failed: ${errorMessage}`);
    }
  } else {
    console.warn("⚠️ No email address found for user");
    throw new Error("No email address available for notification");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Starting notification processing...");
    
    // Check Resend API key is configured
    if (!Deno.env.get("RESEND_API_KEY")) {
      throw new Error("RESEND_API_KEY environment variable is not configured");
    }
    
    console.log("✅ Resend API key configured");
    console.log("📧 Using sender email:", RESEND_FROM);
    
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

      // Skip test users (safety check)
      if (userProfile?.email && (userProfile.email.includes('@test.com') || userProfile.email.startsWith('qa-'))) {
        console.log(`⚠️ Skipping test user: ${userProfile.email}`);
        continue;
      }

      // Respect pause state even in test mode
      if (userProfile?.notifications_paused) {
        console.log(`⏸️ Skipping paused user: ${userProfile?.email}`);
        continue;
      }

      // Validate email exists and is valid
      if (!userProfile?.email || !userProfile.email.includes('@')) {
        console.log(`⚠️ Skipping user with invalid email: ${userProfile?.email || 'no email'}`);
        continue;
      }

      let sentForAlert = 0;
      let skipped404 = 0;
      for (const property of newProperties || []) {
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

        const match = body?.test ? true : matchesAlert(property, alert);
        if (!match) continue;

        if (body?.test) {
          // Test mode: send without recording to DB (no de-dup), cap to a few emails
          if (userProfile?.email) {
            await sendNotifications(property, alert, userProfile);
            notificationsSent++;
            sentForAlert++;
            if (sentForAlert >= 3) break; // avoid spamming during tests
          }
          continue;
        }

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
          const notificationId = inserted[0].id;
          try {
            if (userProfile?.email) {
              await sendNotifications(property, alert, userProfile);
              
              // Update notification record to mark as successfully sent
              await supabase
                .from('notifications')
                .update({
                  delivery_status: 'sent',
                  delivered_at: new Date().toISOString()
                })
                .eq('id', notificationId);
                
              console.log(`✅ Notification ${notificationId} delivered successfully`);
            }
            notificationsSent++;
        } catch (emailError) {
          // Properly handle error logging
          let errorMessage = 'Unknown error';
          if (emailError instanceof Error) {
            errorMessage = emailError.message;
          } else if (typeof emailError === 'object' && emailError !== null) {
            errorMessage = JSON.stringify(emailError);
          } else {
            errorMessage = String(emailError);
          }
          
          console.error(`❌ Failed to send notification ${notificationId}:`, {
            error: errorMessage,
            propertyId: property.id,
            propertyTitle: property.title,
            userEmail: userProfile?.email,
            alertName: alert.name
          });
          
          // Update notification record to mark as failed
          await supabase
            .from('notifications')
            .update({
              delivery_status: 'failed',
              delivery_error: errorMessage
            })
            .eq('id', notificationId);
        }
        } else {
          console.log(`Duplicate notification for user ${alert.user_id} and property ${property.id} — already sent.`);
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