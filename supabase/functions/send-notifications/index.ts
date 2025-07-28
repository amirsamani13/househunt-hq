import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    // Get all active user alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);

    if (alertsError) {
      throw alertsError;
    }

    console.log(`Found ${alerts?.length || 0} active alerts`);

    // Get new properties from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: newProperties, error: propertiesError } = await supabase
      .from('properties')
      .select('*')
      .gte('first_seen_at', oneHourAgo)
      .eq('is_active', true);

    if (propertiesError) {
      throw propertiesError;
    }

    console.log(`Found ${newProperties?.length || 0} new properties from the last hour`);

    let notificationsSent = 0;
    const notifications: any[] = [];

    // Process each alert against new properties
    for (const alert of alerts || []) {
      for (const property of newProperties || []) {
        if (matchesAlert(property, alert)) {
          // Check if notification already exists
          const { data: existingNotification } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', alert.user_id)
            .eq('property_id', property.id)
            .eq('alert_id', alert.id)
            .single();

          if (!existingNotification) {
            const message = createNotificationMessage(property, alert.name);
            
            notifications.push({
              user_id: alert.user_id,
              property_id: property.id,
              alert_id: alert.id,
              message,
              sent_at: new Date().toISOString()
            });
            
            notificationsSent++;
          }
        }
      }
    }

    // Batch insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        throw insertError;
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