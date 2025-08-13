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

  // Keywords in title or description
  if (alert.keywords && alert.keywords.length > 0) {
    const fullText = (property.title + ' ' + (property.description || '')).toLowerCase();
    const matches = alert.keywords.some(keyword => fullText.includes(keyword.toLowerCase()));
    if (!matches) return false;
  }

  return true;
}

function formatPrice(price?: number): string {
  if (!price) return 'Price not available';
  return `€${price.toLocaleString()}`;
}

function createNotificationMessage(property: Property, alertName: string): string {
  return `New property match for "${alertName}": ${property.title} - ${formatPrice(property.price)} - ${property.address || 'Groningen'} - ${property.url}`;
}

function createEmailHTML(property: Property, alertName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>New Property Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .property { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .price { font-size: 20px; font-weight: bold; color: #059669; }
        .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏠 New Property Alert</h1>
        <p>Alert: ${alertName}</p>
    </div>
    <div class="content">
        <div class="property">
            <h2>${property.title}</h2>
            <div class="price">${formatPrice(property.price)}</div>
            <p><strong>📍 Location:</strong> ${property.address || 'Groningen'}</p>
            ${property.bedrooms ? `<p><strong>🛏️ Bedrooms:</strong> ${property.bedrooms}</p>` : ''}
            ${property.bathrooms ? `<p><strong>🚿 Bathrooms:</strong> ${property.bathrooms}</p>` : ''}
            ${property.surface_area ? `<p><strong>📐 Surface Area:</strong> ${property.surface_area}m²</p>` : ''}
            <p><strong>🏢 Source:</strong> ${property.source}</p>
            <a href="${property.url}" class="button">View Property →</a>
        </div>
    </div>
    <div class="footer">
        <p>This alert was sent because the property matches your search criteria.</p>
        <p>To manage your alerts, log in to your account.</p>
    </div>
</body>
</html>`;
}

async function checkUrlAvailable(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return { ok: response.ok, status: response.status };
  } catch (_error) {
    return { ok: false, status: 0 };
  }
}

async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.log("Twilio not configured, skipping SMS");
      return false;
    }

    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const body = new URLSearchParams({
      From: TWILIO_PHONE_NUMBER,
      To: to,
      Body: message
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      }
    );

    if (!response.ok) {
      console.error('Twilio error:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('SMS error:', error);
    return false;
  }
}

async function sendNotifications(property: Property, alert: UserAlert, userProfile: any): Promise<void> {
  const message = createNotificationMessage(property, alert.name);
  
  try {
    // Send email
    await resend.emails.send({
      from: RESEND_FROM,
      to: [userProfile.email],
      subject: `🏠 New Property: ${property.title}`,
      html: createEmailHTML(property, alert.name)
    });

    console.log(`Email sent to ${userProfile.email} for property ${property.id}`);
    
    // Send SMS if phone number is available
    if (userProfile.phone) {
      await sendSMS(userProfile.phone, message);
    }
  } catch (error) {
    console.error('Error sending notifications:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
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

    const { windowHours = 24, only_user_email, testAll = false, force = false, scraperTest = false } = body || {};

    console.log(`Processing with windowHours: ${windowHours}, testAll: ${testAll}, force: ${force}, scraperTest: ${scraperTest}`);

    // Get active alerts, optionally filtered by user email
    let alertsQuery = supabase
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);

    if (only_user_email) {
      // First get the user_id from profiles table
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', only_user_email);
      
      if (profiles && profiles.length > 0) {
        alertsQuery = alertsQuery.eq('user_id', profiles[0].user_id);
      }
    }

    const { data: alerts, error: alertsError } = await alertsQuery;

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      throw alertsError;
    }

    console.log(`Found ${alerts?.length || 0} active alerts`);

    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        alerts_processed: 0,
        notifications_sent: 0,
        message: "No active alerts found"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let properties: Property[] = [];
    
    if (scraperTest) {
      // SCRAPER TEST MODE: Get one most recent property per source
      console.log('🧪 SCRAPER TEST MODE: Finding most recent property per source...');
      
      const sources = ['pararius', 'kamernet', 'grunoverhuur', 'funda', 'campusgroningen', 'rotsvast', 
                      'expatrentalsholland', 'vandermeulen', 'housinganywhere', 'dcwonen', 'huure', 
                      'maxxhuren', 'kpmakelaars', 'househunting', 'woldringverhuur', '050vastgoed', 'pandomo'];
      
      const testProperties: Property[] = [];
      
      for (const source of sources) {
        const { data: sourceProps, error } = await supabase
          .from('properties')
          .select('*')
          .eq('source', source)
          .eq('is_active', true)
          .order('first_seen_at', { ascending: false })
          .limit(1);
          
        if (!error && sourceProps && sourceProps.length > 0) {
          testProperties.push(sourceProps[0]);
          console.log(`✅ ${source}: Found test property - ${sourceProps[0].title}`);
        } else {
          console.log(`❌ ${source}: No properties found`);
        }
      }
      
      properties = testProperties;
      console.log(`🧪 Scraper test mode: Found ${properties.length} test properties`);
      
    } else {
      // NORMAL MODE: Get properties from time window
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('*')
        .gte('first_seen_at', new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString())
        .eq('is_active', true)
        .order('first_seen_at', { ascending: false });

      if (propsError) {
        console.error("Error fetching properties:", propsError);
        throw propsError;
      }

      console.log(`Found ${propsData?.length || 0} properties in the database from the last ${windowHours} hours`);

      // Filter properties for quality
      const validProperties = (propsData || []).filter((property: Property) => {
        // Skip properties with no price or URL
        if (!property.url) return false;
        
        // Skip properties with obviously bad data
        if (property.bedrooms && property.bedrooms > 10) return false;
        if (property.bathrooms && property.bathrooms > 5) return false;
        if (property.price && (property.price < 50 || property.price > 5000)) return false;
        
        // Skip properties with unwanted patterns in title
        const badPatterns = [
          /^\s*$/,
          /unknown/i,
          /error/i,
          /404/i,
          /not found/i,
          /_IS_MISSING/
        ];
        
        if (badPatterns.some(pattern => pattern.test(property.title || ''))) {
          return false;
        }
        
        return true;
      });

      console.log(`Found ${validProperties.length} valid properties from the last ${windowHours} hours (filtered from ${propsData?.length || 0})`);

      // Check URL availability for properties
      const checkedProperties: Property[] = [];
      for (const property of validProperties) {
        try {
          const urlCheck = await checkUrlAvailable(property.url);
          if (urlCheck.ok) {
            checkedProperties.push(property);
          } else {
            console.log(`Property URL not available (${urlCheck.status}): ${property.url}`);
          }
        } catch (error) {
          console.log(`Error checking URL for property ${property.id}: ${error}`);
        }
      }

      properties = checkedProperties;
      console.log(`Found ${properties.length} properties with valid URLs`);
    }

    let notificationsSent = 0;

    // Process each alert
    for (const alert of alerts) {
      console.log(`Processing alert: ${alert.name} for user ${alert.user_id}`);
      
      // Get user profile for notification preferences
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', alert.user_id)
        .single();

      if (!userProfile) {
        console.log(`No profile found for user ${alert.user_id}`);
        continue;
      }

      // Check if notifications are paused for this user (skip in scraper test mode)
      if (!scraperTest && userProfile.notifications_paused) {
        console.log(`Notifications paused for user ${alert.user_id}`);
        continue;
      }

      for (const property of properties) {
        if (matchesAlert(property, alert)) {
          console.log(`Property ${property.id} matches alert ${alert.name}`);
          
          // Skip duplicate check in test modes or when forced
          if (testAll || force || scraperTest) {
            console.log(`Sending ${scraperTest ? 'scraper test' : 'forced'} notification (bypassing duplicate check)`);
            
            // Record the notification
            const { data: notificationData, error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: alert.user_id,
                property_id: property.id,
                alert_id: alert.id,
                message: createNotificationMessage(property, alert.name),
                delivery_status: 'pending'
              })
              .select()
              .single();

            if (notificationError) {
              console.error("Error creating notification record:", notificationError);
              continue;
            }

            try {
              await sendNotifications(property, alert, userProfile);
              
              // Update notification status
              await supabase
                .from('notifications')
                .update({
                  delivery_status: 'sent',
                  delivered_at: new Date().toISOString()
                })
                .eq('id', notificationData.id);
                
              notificationsSent++;
              console.log(`${scraperTest ? 'Scraper test' : 'Test'} notification sent successfully for property ${property.id} from ${property.source}`);
            } catch (error) {
              console.error(`Error sending notification:`, error);
              
              // Update notification status
              await supabase
                .from('notifications')
                .update({
                  delivery_status: 'failed',
                  delivery_error: error.message
                })
                .eq('id', notificationData.id);
            }
          } else {
            // Check for existing notifications in the last 6 hours (reduced from 24h for better testing)
            const { data: existingNotifications } = await supabase
              .from('notifications')
              .select('*')
              .eq('user_id', alert.user_id)
              .eq('property_id', property.id)
              .gte('sent_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

            if (!existingNotifications || existingNotifications.length === 0) {
              // Record the notification
              const { data: notificationData, error: notificationError } = await supabase
                .from('notifications')
                .insert({
                  user_id: alert.user_id,
                  property_id: property.id,
                  alert_id: alert.id,
                  message: createNotificationMessage(property, alert.name),
                  delivery_status: 'pending'
                })
                .select()
                .single();

              if (notificationError) {
                console.error("Error creating notification record:", notificationError);
                continue;
              }

              try {
                await sendNotifications(property, alert, userProfile);
                
                // Update notification status
                await supabase
                  .from('notifications')
                  .update({
                    delivery_status: 'sent',
                    delivered_at: new Date().toISOString()
                  })
                  .eq('id', notificationData.id);
                  
                notificationsSent++;
                console.log(`Notification sent successfully for property ${property.id} from ${property.source}`);
              } catch (error) {
                console.error(`Error sending notification:`, error);
                
                // Update notification status
                await supabase
                  .from('notifications')
                  .update({
                    delivery_status: 'failed',
                    delivery_error: error.message
                  })
                  .eq('id', notificationData.id);
              }
            } else {
              console.log(`Duplicate notification for user ${alert.user_id} and property ${property.id} — already sent in last 6h.`);
            }
          }
        }
      }
    }

    console.log(`Sent ${notificationsSent} notifications`);

    return new Response(JSON.stringify({
      success: true,
      alerts_processed: alerts.length,
      notifications_sent: notificationsSent,
      properties_checked: properties.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("Error in send-notifications function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        alerts_processed: 0,
        notifications_sent: 0
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});