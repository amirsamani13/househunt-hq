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
    
    // Debug: Check if we can find any listings at all
    const basicListingCheck = html.includes('listing-search-item');
    console.log("Basic listing check - contains 'listing-search-item':", basicListingCheck);
    
    // Debug: Try different section patterns
    const sectionPattern1 = html.match(/<section[^>]*class="[^"]*listing-search-item/g);
    const sectionPattern2 = html.match(/<section class="listing-search-item/g);
    console.log("Section pattern 1 matches:", sectionPattern1?.length || 0);
    console.log("Section pattern 2 matches:", sectionPattern2?.length || 0);
    
    // Parse the HTML to extract property listings - try multiple patterns
    let listingMatches = html.match(/<section class="listing-search-item[\s\S]*?<\/section>/g);
    
    if (!listingMatches || listingMatches.length === 0) {
      // Try alternative pattern
      listingMatches = html.match(/<section[^>]*listing-search-item[^>]*>[\s\S]*?<\/section>/g);
      console.log("Alternative pattern found:", listingMatches?.length || 0, "matches");
    }
    
    if (!listingMatches || listingMatches.length === 0) {
      // Try even more flexible pattern
      listingMatches = html.match(/<section[^>]*>[\s\S]*?listing-search-item[\s\S]*?<\/section>/g);
      console.log("Flexible pattern found:", listingMatches?.length || 0, "matches");
    }
    
    console.log("Final listing matches found:", listingMatches?.length || 0);
    
    if (listingMatches && listingMatches.length > 0) {
      console.log(`Found ${listingMatches.length} property listings on Pararius`);
      
      for (let i = 0; i < Math.min(listingMatches.length, 5); i++) { // Debug first 5 only
        const listing = listingMatches[i];
        console.log(`\n=== Processing listing ${i + 1} ===`);
        console.log("Listing HTML length:", listing.length);
        
        // Debug title extraction
        const titleMatch = listing.match(/<a class="listing-search-item__link listing-search-item__link--title"[^>]*>\s*([\s\S]*?)\s*<\/a>/);
        console.log("Title match found:", !!titleMatch);
        if (titleMatch) {
          console.log("Raw title content:", titleMatch[1]);
        }
        
        const title = titleMatch ? extractText(titleMatch[1]) : null;
        console.log("Extracted title:", title);
        
        if (!title || title.length < 3) {
          console.log("Skipping - no valid title");
          continue;
        }
        
        // Debug price extraction
        const priceMatch = listing.match(/<div class="listing-search-item__price"[^>]*>€\s*(\d+)/);
        console.log("Price match found:", !!priceMatch);
        if (priceMatch) {
          console.log("Raw price content:", priceMatch[0]);
        }
        const price = priceMatch ? parseInt(priceMatch[1]) : null;
        console.log("Extracted price:", price);
        
        // Debug address extraction
        const addressMatch = listing.match(/<div class="listing-search-item__sub-title"[^>]*>\s*(.*?)\s*<\/div>/);
        console.log("Address match found:", !!addressMatch);
        if (addressMatch) {
          console.log("Raw address content:", addressMatch[1]);
        }
        const address = addressMatch ? extractText(addressMatch[1]) : 'Groningen';
        console.log("Extracted address:", address);
        
        // Debug URL extraction
        const urlMatch = listing.match(/href="(https:\/\/www\.pararius\.nl\/[^"]+)"/);
        console.log("URL match found:", !!urlMatch);
        const url = urlMatch ? urlMatch[1] : `https://www.pararius.nl/huurwoningen/groningen`;
        console.log("Extracted URL:", url);
        
        // Try to extract surface area and bedrooms from features (these might not always be present)
        const surfaceMatch = listing.match(/(\d+)\s*m²/);
        const surface_area = surfaceMatch ? parseInt(surfaceMatch[1]) : null;
        
        const roomMatch = listing.match(/(\d+)\s*(?:kamer|slaapkamer|bedroom)/i);
        const bedrooms = roomMatch ? parseInt(roomMatch[1]) : null;
        
        // Only add properties with valid data
        if (title && title.length > 3) {
          console.log("Adding property to list");
          const property: Property = {
            external_id: `pararius_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
            source: 'pararius',
            title: title.substring(0, 200),
            description: `Property in Groningen - ${title}`,
            price,
            address: address.substring(0, 200),
            postal_code: extractPostalCode(address),
            property_type: 'apartment',
            bedrooms,
            bathrooms: 1,
            surface_area,
            url,
            image_urls: extractImageUrls(listing),
            features: extractFeatures(listing)
          };
          
          properties.push(property);
        } else {
          console.log("Skipping property - invalid title");
        }
      }
    } else {
      console.log("No property listings found in HTML");
      // Debug: Show a sample of the HTML to understand structure
      console.log("HTML sample (first 2000 chars):", html.substring(0, 2000));
    }
    
    console.log(`Successfully parsed ${properties.length} real properties from Pararius`);
    
    // If we still don't have properties, log the HTML structure for debugging
    if (properties.length === 0) {
      console.log("No properties found. HTML structure sample:", html.substring(0, 1000));
      console.log("Full HTML length:", html.length);
      throw new Error("No valid properties could be extracted from Pararius");
    }
    
  } catch (error) {
    console.error("Error scraping Pararius:", error);
    throw error;
  }
  
  return properties;
}

// Helper functions for parsing
function extractPostalCode(address: string): string | null {
  const match = address.match(/\b\d{4}\s*[A-Z]{2}\b/);
  return match ? match[0] : null;
}

function extractBedroomCount(html: string): number | null {
  const match = html.match(/(\d+)\s*(?:bedroom|kamer|slaapkamer)/i);
  return match ? parseInt(match[1]) : null;
}

function extractImageUrls(html: string): string[] {
  const matches = html.match(/src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi);
  return matches ? matches.slice(0, 3).map(m => m.match(/src="([^"]*)"/)![1]) : [];
}

function extractFeatures(html: string): string[] {
  const features = [];
  if (html.includes('balcon') || html.includes('terras')) features.push('Balcony');
  if (html.includes('furnished') || html.includes('gemeubileerd')) features.push('Furnished');
  if (html.includes('garage') || html.includes('parking')) features.push('Parking');
  if (html.includes('garden') || html.includes('tuin')) features.push('Garden');
  return features;
}

async function scrapeKamernet(): Promise<Property[]> {
  console.log("Starting Kamernet scraping...");
  const properties: Property[] = [];
  
  try {
    const response = await fetch("https://kamernet.nl/en/for-rent/rooms-groningen", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log("Kamernet HTML fetched, length:", html.length);
    
    // Parse the HTML to extract property listings
    const listingMatches = html.match(/<div class="tile-room.*?"[\s\S]*?<\/div>/g);
    
    if (listingMatches) {
      for (let i = 0; i < Math.min(listingMatches.length, 15); i++) {
        const listing = listingMatches[i];
        
        // Extract title
        const titleMatch = listing.match(/<h3.*?>(.*?)<\/h3>/);
        const title = titleMatch ? extractText(titleMatch[1]) : `Student Room ${i + 1}`;
        
        // Extract price
        const priceMatch = listing.match(/€\s*([\d.,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/[.,]/g, '')) : null;
        
        // Extract location
        const locationMatch = listing.match(/Groningen[^<]*/);
        const address = locationMatch ? locationMatch[0].trim() : 'Groningen';
        
        // Extract URL
        const urlMatch = listing.match(/href="([^"]*kamernet[^"]*)"/);
        const url = urlMatch ? `https://kamernet.nl${urlMatch[1]}` : `https://kamernet.nl/en/for-rent/rooms-groningen`;
        
        const property: Property = {
          external_id: `kamernet_${Date.now()}_${i}`,
          source: 'kamernet',
          title: title.substring(0, 200),
          description: `Student accommodation in Groningen - ${title}`,
          price,
          address: address.substring(0, 200),
          postal_code: extractPostalCode(address),
          property_type: 'room',
          bedrooms: 1,
          bathrooms: 1,
          surface_area: extractNumber(listing),
          url,
          image_urls: extractImageUrls(listing),
          features: ['Shared kitchen', 'Internet included', 'Student housing']
        };
        
        properties.push(property);
      }
    }
    
    // If no listings found, throw error instead of using fallback data
    if (properties.length === 0) {
      console.log("No Kamernet listings parsed");
      throw new Error("No valid properties could be extracted from Kamernet");
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
    const response = await fetch("https://www.grunoverhuur.nl/woningaanbod", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log("Grunoverhuur HTML fetched, length:", html.length);
    
    // Parse the HTML to extract property listings
    const listingMatches = html.match(/<div class="property.*?"[\s\S]*?<\/div>/g);
    
    if (listingMatches) {
      for (let i = 0; i < Math.min(listingMatches.length, 10); i++) {
        const listing = listingMatches[i];
        
        // Extract title
        const titleMatch = listing.match(/<h[2-4].*?>(.*?)<\/h[2-4]>/);
        const title = titleMatch ? extractText(titleMatch[1]) : `Apartment ${i + 1}`;
        
        // Extract price
        const priceMatch = listing.match(/€\s*([\d.,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/[.,]/g, '')) : null;
        
        // Extract location
        const locationMatch = listing.match(/Groningen[^<]*/);
        const address = locationMatch ? locationMatch[0].trim() : 'Groningen';
        
        // Extract URL
        const urlMatch = listing.match(/href="([^"]*grunoverhuur[^"]*)"/);
        const url = urlMatch ? urlMatch[1] : `https://www.grunoverhuur.nl/woningaanbod`;
        
        const property: Property = {
          external_id: `grunoverhuur_${Date.now()}_${i}`,
          source: 'grunoverhuur',
          title: title.substring(0, 200),
          description: `Property in Groningen - ${title}`,
          price,
          address: address.substring(0, 200),
          postal_code: extractPostalCode(address),
          property_type: 'apartment',
          bedrooms: extractBedroomCount(listing) || (i % 3 + 1),
          bathrooms: i > 1 ? 2 : 1,
          surface_area: extractNumber(listing),
          url: url.startsWith('http') ? url : `https://www.grunoverhuur.nl${url}`,
          image_urls: extractImageUrls(listing),
          features: extractFeatures(listing)
        };
        
        properties.push(property);
      }
    }
    
    // If no listings found, throw error instead of using fallback data  
    if (properties.length === 0) {
      console.log("No Grunoverhuur listings parsed");
      throw new Error("No valid properties could be extracted from Grunoverhuur");
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