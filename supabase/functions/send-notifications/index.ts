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

function matchesAlert(property: Property, alert: UserAlert): boolean {
  // Enhanced matching logic with better logging
  console.log(`🔍 Checking if property "${property.title}" matches alert "${alert.name}"`);
  
  // Check price range
  if (alert.min_price && property.price && property.price < alert.min_price) {
    console.log(`❌ Price too low: €${property.price} < €${alert.min_price}`);
    return false;
  }
  if (alert.max_price && property.price && property.price > alert.max_price) {
    console.log(`❌ Price too high: €${property.price} > €${alert.max_price}`);
    return false;
  }

  // Check bedroom range
  if (alert.min_bedrooms && property.bedrooms && property.bedrooms < alert.min_bedrooms) {
    console.log(`❌ Too few bedrooms: ${property.bedrooms} < ${alert.min_bedrooms}`);
    return false;
  }
  if (alert.max_bedrooms && property.bedrooms && property.bedrooms > alert.max_bedrooms) {
    console.log(`❌ Too many bedrooms: ${property.bedrooms} > ${alert.max_bedrooms}`);
    return false;
  }

  // Check sources (default to all sources if not specified)
  if (alert.sources && alert.sources.length > 0) {
    if (!alert.sources.includes(property.source)) {
      console.log(`❌ Source not included: ${property.source} not in [${alert.sources.join(', ')}]`);
      return false;
    }
  }

  // Check property types
  if (alert.property_types && alert.property_types.length > 0) {
    if (!alert.property_types.includes(property.property_type || '')) {
      console.log(`❌ Property type not included: ${property.property_type} not in [${alert.property_types.join(', ')}]`);
      return false;
    }
  }

  // Check cities (default to Groningen)
  if (alert.cities && alert.cities.length > 0) {
    const propertyCity = property.city?.toLowerCase() || 'groningen';
    const alertCities = alert.cities.map(c => c.toLowerCase());
    if (!alertCities.includes(propertyCity)) {
      console.log(`❌ City not included: ${propertyCity} not in [${alertCities.join(', ')}]`);
      return false;
    }
  }

  // Check postal codes
  if (alert.postal_codes && alert.postal_codes.length > 0 && property.postal_code) {
    const matches = alert.postal_codes.some(code => 
      property.postal_code?.startsWith(code.toString())
    );
    if (!matches) {
      console.log(`❌ Postal code not included: ${property.postal_code} not matching [${alert.postal_codes.join(', ')}]`);
      return false;
    }
  }

  // Check keywords
  if (alert.keywords && alert.keywords.length > 0) {
    const searchText = `${property.title} ${property.description || ''} ${property.address || ''}`.toLowerCase();
    const keywordMatch = alert.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    if (!keywordMatch) {
      console.log(`❌ No keyword match in: "${searchText}"`);
      return false;
    }
  }

  console.log(`✅ Property matches all criteria for alert "${alert.name}"`);
  return true;
}

async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log("SMS configuration missing, skipping SMS");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: TWILIO_PHONE_NUMBER,
          To: to,
          Body: message,
        }),
      }
    );

    if (response.ok) {
      console.log(`SMS sent successfully to ${to}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`Failed to send SMS: ${error}`);
      return false;
    }
  } catch (error) {
    console.error(`Error sending SMS: ${error}`);
    return false;
  }
}

async function sendNotifications(property: Property, alert: UserAlert, userProfile: any): Promise<void> {
  const subject = `🏠 New Property Alert: ${property.title}`;
  const message = `
    A new property matching your alert "${alert.name}" has been found!
    
    🏠 **${property.title}**
    💰 Price: €${property.price || 'N/A'}
    📍 Address: ${property.address || 'Not specified'}
    🛏️ Bedrooms: ${property.bedrooms || 'N/A'}
    🚿 Bathrooms: ${property.bathrooms || 'N/A'}
    📐 Surface: ${property.surface_area || 'N/A'}m²
    🌐 Source: ${property.source}
    
    🔗 **View Property**: ${property.url}
    
    Found on: ${new Date(property.first_seen_at).toLocaleString()}
    
    ---
    This alert was sent for: ${alert.name}
    To manage your alerts, visit your dashboard.
  `;

  // Send email notification
  try {
    const emailResult = await resend.emails.send({
      from: RESEND_FROM,
      to: [userProfile.email],
      subject: subject,
      text: message,
      html: message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    });

    console.log(`Email sent to ${userProfile.email} for property ${property.id}`);
  } catch (error) {
    console.error(`Failed to send email to ${userProfile.email}:`, error);
  }

  // Send SMS notification if phone number is provided
  if (userProfile.phone) {
    const smsMessage = `🏠 New Property: ${property.title} - €${property.price || 'N/A'} - ${property.url}`;
    await sendSMS(userProfile.phone, smsMessage);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting notification processing...');
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request body for configuration options
    const body = await req.json().catch(() => ({}));
    const windowHours = body.windowHours || 6; // Reduced from 24h to 6h for faster testing
    const onlyUserEmail = body.only_user_email;
    const testAll = body.testAll || false;
    const force = body.force || false;
    const scraperTest = body.scraperTest || false;

    console.log(`Processing with windowHours: ${windowHours}, testAll: ${testAll}, force: ${force}, scraperTest: ${scraperTest}`);

    // Get all active user alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      throw alertsError;
    }

    console.log(`Found ${alerts?.length || 0} active alerts`);

    let properties: Property[] = [];

    if (scraperTest) {
      console.log('🧪 SCRAPER TEST MODE: Testing all scrapers with most recent properties...');
      
      // Get the most recent property from each source for testing
      const allSources = ['pararius', 'kamernet', 'grunoverhuur', 'funda', 'campusgroningen', 'rotsvast', 'expatrentalsholland', 'vandermeulen', 'housinganywhere', 'studenthousing', 'roomspot', 'rentberry'];
      
      for (const source of allSources) {
        console.log(`🔍 Testing source: ${source}`);
        
        // Try to get the most recent property from this source
        const { data: sourceProperties, error: sourceError } = await supabase
          .from('properties')
          .select('*')
          .eq('source', source)
          .eq('is_active', true)
          .order('first_seen_at', { ascending: false })
          .limit(1);
        
        if (sourceError) {
          console.log(`❌ ${source}: Database error - ${sourceError.message}`);
          continue;
        }
        
        if (sourceProperties && sourceProperties.length > 0) {
          const property = sourceProperties[0];
          
          // Extra validation to ensure the property is good for testing
          if (property.title && 
              !property.title.includes('_IS_MISSING') && 
              property.title.length >= 5 &&
              property.url &&
              (!property.price || (property.price >= 200 && property.price <= 5000))) {
            
            properties.push(property);
            console.log(`✅ ${source}: Found valid test property - "${property.title}" (€${property.price || 'N/A'})`);
          } else {
            console.log(`⚠️ ${source}: Property found but failed validation - "${property.title}"`);
          }
        } else {
          console.log(`❌ ${source}: No properties found in database`);
        }
      }
      
      console.log(`🧪 Scraper test mode: Found ${properties.length} valid test properties from ${allSources.length} sources`);
    } else {
      // Get properties from the specified time window
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - windowHours);

      let query = supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .gte('first_seen_at', cutoffTime.toISOString())
        .order('first_seen_at', { ascending: false });

      if (onlyUserEmail) {
        // Filter to specific user's properties if testing
        query = query.limit(50);
      }

      const { data: recentProperties, error: propertiesError } = await query;

      if (propertiesError) {
        console.error('Error fetching properties:', propertiesError);
        throw propertiesError;
      }

      console.log(`Found ${recentProperties?.length || 0} properties in the database from the last ${windowHours} hours`);

      // Enhanced property filtering for quality
      properties = (recentProperties || []).filter(property => {
        // Strict validation to prevent notifications for bad data
        if (!property.url || !property.title) return false;
        if (property.title.includes('_IS_MISSING')) return false;
        if (property.title.length < 5) return false;
        if (property.bedrooms && property.bedrooms > 6) return false;
        if (property.bathrooms && property.bathrooms > 4) return false;
        if (property.price && (property.price < 200 || property.price > 5000)) return false;
        
        return true;
      });

      console.log(`Found ${properties.length} valid properties from the last ${windowHours} hours (filtered from ${recentProperties?.length || 0})`);
    }

    // Additional URL validation
    const validProperties = properties.filter(property => {
      try {
        const url = new URL(property.url);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    });

    console.log(`Found ${validProperties.length} properties with valid URLs`);

    let notificationsSent = 0;

    for (const alert of alerts || []) {
      // Get user profile for this alert
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, phone, notifications_paused')
        .eq('user_id', alert.user_id)
        .single();

      if (!profileData) {
        console.log(`No profile found for user ${alert.user_id}, skipping alert ${alert.name}`);
        continue;
      }

      const userProfile = profileData;
      
      if (userProfile.notifications_paused && !force && !scraperTest) {
        console.log(`Skipping notifications for paused user: ${userProfile.email}`);
        continue;
      }

      if (onlyUserEmail && userProfile.email !== onlyUserEmail) {
        continue;
      }

      console.log(`Processing alert: ${alert.name} for user ${alert.user_id}`);

      for (const property of validProperties) {
        if (matchesAlert(property, alert)) {
          console.log(`Property ${property.id} matches alert ${alert.name}`);

          // In scraper test mode, ALWAYS send notifications (true force mode)
          if (scraperTest || force) {
            console.log('Sending scraper test notification (bypassing duplicate check)');
          } else {
            // Check for existing notification only in normal mode
            const { data: existingNotifications } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', alert.user_id)
              .eq('property_id', property.id)
              .limit(1);

            if (existingNotifications && existingNotifications.length > 0) {
              console.log(`Notification already sent for property ${property.id} to user ${alert.user_id}`);
              continue;
            }
          }

          try {
            await sendNotifications(property, alert, userProfile);
            notificationsSent++;

            // Record the notification (try to insert, ignore duplicates in test modes)
            const { error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: alert.user_id,
                property_id: property.id,
                alert_id: alert.id,
                message: `New property match: ${property.title}`,
                delivery_status: 'delivered'
              });

            if (notificationError && !scraperTest) {
              console.error('Error creating notification record:', notificationError);
            } else if (scraperTest) {
              console.log(`Scraper test notification sent successfully for property ${property.id} from ${property.source}`);
            }

          } catch (error) {
            console.error(`Error sending notification for property ${property.id}:`, error);
          }
        }
      }
    }

    console.log(`Sent ${notificationsSent} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent,
        propertiesProcessed: validProperties.length,
        alertsProcessed: alerts?.length || 0,
        mode: scraperTest ? 'scraper_test' : force ? 'force' : 'normal',
        windowHours: windowHours
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error('Error in send-notifications function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});