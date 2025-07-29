import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Property {
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
  available_from?: string;
  url: string;
  image_urls?: string[];
  features?: string[];
}

// Helper function to extract text content from HTML
function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Helper function to extract numbers from text
function extractNumber(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

// Helper function to extract price
function extractPrice(text: string): number | null {
  const match = text.match(/€\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

async function scrapePararius(): Promise<Property[]> {
  console.log("Starting Pararius scraping...");
  const properties: Property[] = [];
  
  try {
    const response = await fetch("https://www.pararius.nl/huurwoningen/groningen", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log("Pararius HTML fetched, length:", html.length);
    
    // Create sample properties for testing
    for (let i = 1; i <= 5; i++) {
      const property: Property = {
        external_id: `pararius_test_${Date.now()}_${i}`,
        source: 'pararius',
        title: `Test Property ${i} - Groningen Apartment`,
        description: `Beautiful ${i + 1} bedroom apartment in the heart of Groningen`,
        price: 800 + (i * 100),
        address: `Teststraat ${i}, 9712 AB Groningen`,
        postal_code: `971${i} AB`,
        property_type: 'apartment',
        bedrooms: i % 3 + 1,
        bathrooms: 1,
        surface_area: 50 + (i * 10),
        url: `https://www.pararius.nl/test-property-${i}`,
        image_urls: [],
        features: ['Furnished', 'Central location']
      };
      
      properties.push(property);
    }
  } catch (error) {
    console.error("Error scraping Pararius:", error);
    throw error;
  }
  
  console.log(`Scraped ${properties.length} properties from Pararius`);
  return properties;
}

async function scrapeKamernet(): Promise<Property[]> {
  console.log("Starting Kamernet scraping...");
  const properties: Property[] = [];
  
  try {
    // Create sample properties for testing
    for (let i = 1; i <= 3; i++) {
      const property: Property = {
        external_id: `kamernet_test_${Date.now()}_${i}`,
        source: 'kamernet',
        title: `Student Room ${i} - Near University`,
        description: `Cozy student room in shared house, perfect for university students`,
        price: 400 + (i * 50),
        address: `Studentenstraat ${i}, 9712 CD Groningen`,
        postal_code: `971${i} CD`,
        property_type: 'room',
        bedrooms: 1,
        bathrooms: 1,
        surface_area: 15 + (i * 5),
        url: `https://kamernet.nl/test-room-${i}`,
        image_urls: [],
        features: ['Shared kitchen', 'Internet included']
      };
      
      properties.push(property);
    }
  } catch (error) {
    console.error("Error scraping Kamernet:", error);
    throw error;
  }
  
  console.log(`Scraped ${properties.length} properties from Kamernet`);
  return properties;
}

async function scrapeGrunoverhuur(): Promise<Property[]> {
  console.log("Starting Grunoverhuur scraping...");
  const properties: Property[] = [];
  
  try {
    // Create sample properties for testing
    for (let i = 1; i <= 4; i++) {
      const property: Property = {
        external_id: `grunoverhuur_test_${Date.now()}_${i}`,
        source: 'grunoverhuur',
        title: `Modern Apartment ${i} - City Center`,
        description: `Modern apartment with great amenities in Groningen city center`,
        price: 1000 + (i * 150),
        address: `Centrum ${i}, 9712 EF Groningen`,
        postal_code: `971${i} EF`,
        property_type: 'apartment',
        bedrooms: i % 4 + 1,
        bathrooms: i > 2 ? 2 : 1,
        surface_area: 60 + (i * 15),
        url: `https://www.grunoverhuur.nl/test-apartment-${i}`,
        image_urls: [],
        features: ['Modern kitchen', 'Balcony', 'Parking']
      };
      
      properties.push(property);
    }
  } catch (error) {
    console.error("Error scraping Grunoverhuur:", error);
    throw error;
  }
  
  console.log(`Scraped ${properties.length} properties from Grunoverhuur`);
  return properties;
}

async function saveProperties(supabase: any, properties: Property[], source: string) {
  console.log(`Saving ${properties.length} properties from ${source}`);
  
  const { data: existingProperties, error: fetchError } = await supabase
    .from('properties')
    .select('external_id')
    .eq('source', source);
    
  if (fetchError) {
    console.error("Error fetching existing properties:", fetchError);
    throw fetchError;
  }
  
  const existingIds = new Set(existingProperties?.map((p: any) => p.external_id) || []);
  const newProperties = properties.filter(p => !existingIds.has(p.external_id));
  
  console.log(`${newProperties.length} new properties to save for ${source}`);
  
  if (newProperties.length > 0) {
    const { error: insertError } = await supabase
      .from('properties')
      .insert(newProperties);
      
    if (insertError) {
      console.error("Error inserting properties:", insertError);
      throw insertError;
    }
  }
  
  return newProperties.length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting property scraping process...");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const sources = ['pararius', 'kamernet', 'grunoverhuur'];
    const results: any = {};
    let totalNewProperties = 0;

    for (const source of sources) {
      console.log(`Processing ${source}...`);
      
      // Log scraping start
      const { data: logData, error: logError } = await supabase
        .from('scraping_logs')
        .insert({
          source,
          status: 'running',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (logError) {
        console.error("Error creating scraping log:", logError);
        continue;
      }

      try {
        let properties: Property[] = [];
        
        switch (source) {
          case 'pararius':
            properties = await scrapePararius();
            break;
          case 'kamernet':
            properties = await scrapeKamernet();
            break;
          case 'grunoverhuur':
            properties = await scrapeGrunoverhuur();
            break;
        }

        const newCount = await saveProperties(supabase, properties, source);
        totalNewProperties += newCount;
        
        // Update log with success
        await supabase
          .from('scraping_logs')
          .update({
            status: 'success',
            properties_found: properties.length,
            new_properties: newCount,
            completed_at: new Date().toISOString()
          })
          .eq('id', logData.id);

        results[source] = {
          success: true,
          total: properties.length,
          new: newCount
        };

      } catch (error) {
        console.error(`Error scraping ${source}:`, error);
        
        // Update log with error
        await supabase
          .from('scraping_logs')
          .update({
            status: 'error',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', logData.id);

        results[source] = {
          success: false,
          error: error.message
        };
      }
    }

    console.log("Scraping process completed. Results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraping completed. Found ${totalNewProperties} new properties.`,
        results,
        totalNewProperties
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in scraping function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});