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
  city?: string;
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

// Completely rewritten title extraction function
function extractPropertyTitle(html: string, url: string): string {
  // Remove HTML tags and clean up
  let title = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Remove common price patterns that break titles
  title = title.replace(/€\s*\d+[.,]?\d*\s*(?:euro?|per\s*(?:maand|month))?/gi, '');
  title = title.replace(/\b\d+\s*euro?\b/gi, '');
  
  // Extract property type
  const typeMatch = title.match(/\b(Room|Studio|Apartment|House|Property|Kamer|Woning)\b/i);
  const propertyType = typeMatch ? typeMatch[1] : 'Property';
  
  // Extract location from title, description or URL
  let location = '';
  
  // Look for Dutch neighborhoods and street names
  const locationMatches = title.match(/\b(Vinkhuizen|Paddepoel|Selwerd|Beijum|Kranenburg|Helpman|Centrum|Binnenstad|Noorddijk|Zeeheldenbuurt|Korrewegwijk|De Linie|Oosterparkwijk|Florabuurt|Tuinwijk|Herewegbuurt|Oosterpark)\b/i) ||
                          title.match(/\b([A-Z][a-z]+(?:straat|laan|weg|plein|singel|dwarsstraat|kade|gracht|park|hof))\b/) ||
                          title.match(/\b(Tussen\s+Beide\s+Markten|Van\s+Heemskerckstraat|Stoeldraaierstraat|Tuinbouwdwarsstraat|Meeuwerderweg)\b/i);
  
  if (locationMatches) {
    location = locationMatches[0];
  } else {
    // Try to extract from URL
    const urlMatch = url.match(/\/([a-z-]+(?:straat|laan|weg|plein|singel|dwarsstraat|kade))/i) ||
                     url.match(/\/(vinkhuizen|paddepoel|selwerd|beijum|kranenburg|helpman)/i);
    if (urlMatch) {
      location = urlMatch[1].replace(/-/g, ' ');
    }
  }
  
  // Construct clean title
  let cleanTitle = '';
  if (location) {
    cleanTitle = `${propertyType} for rent in ${location}`;
  } else {
    cleanTitle = `${propertyType} for rent in Groningen`;
  }
  
  return cleanTitle;
}

// Simplified sanitize function for addresses
function sanitizeAddress(input?: string): string {
  if (!input) return 'Groningen, Netherlands';
  let t = String(input).trim();
  t = t.replace(/&amp;/g, '&').replace(/<[^>]*>/g, '');
  t = t.split('?')[0].split('#')[0];
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (t.length > 200) t = t.slice(0, 200);
  return t;
}

// COMMAND 1: New helper function for extracting property details
async function extractPropertyDetails(url: string, source: string, typeDefault: string): Promise<Property | null> {
  try {
    console.log(`Fetching individual property data for: ${url}`);
    
    const detailResp = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      } 
    });
    
    if (!detailResp.ok) {
      console.log(`Failed to fetch ${url}: ${detailResp.status}`);
      return null;
    }
    
    const detailHtml = await detailResp.text();
    
    // Initialize variables for THIS SPECIFIC property (fresh variables each time)
    let propertyTitle = '';
    let propertyAddress = '';
    let propertyPrice: number | null = null;
    let propertyBedrooms: number | null = null;
    let propertyBathrooms: number | null = null;
    let propertySurface: number | null = null;
    
    // Try JSON-LD first for structured data
    const ldMatches = Array.from(detailHtml.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));
    for (const ldMatch of ldMatches) {
      try {
        const jsonData = JSON.parse(ldMatch[1]);
        if (jsonData.name && !propertyTitle) propertyTitle = jsonData.name;
        if (jsonData.address?.streetAddress && !propertyAddress) propertyAddress = jsonData.address.streetAddress;
        if (jsonData.offers?.price && !propertyPrice) propertyPrice = parseFloat(jsonData.offers.price);
        if (jsonData.numberOfRooms && !propertyBedrooms) propertyBedrooms = parseInt(jsonData.numberOfRooms);
        if (jsonData.floorSize?.value && !propertySurface) propertySurface = parseFloat(jsonData.floorSize.value);
      } catch (e) {
        console.log(`JSON-LD parse error for ${url}:`, e);
      }
    }
    
    // COMPLETELY REWRITTEN title extraction logic
    if (!propertyTitle) {
      // Get title from multiple sources and clean it properly
      const titleSources = [];
      
      // Try h1 tags
      const h1Matches = Array.from(detailHtml.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi));
      for (const match of h1Matches) {
        titleSources.push(match[1]);
      }
      
      // Try title tag
      const titleMatch = detailHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        titleSources.push(titleMatch[1]);
      }
      
      // Try meta property tags
      const metaMatch = detailHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (metaMatch) {
        titleSources.push(metaMatch[1]);
      }
      
      // Process each title source with the new extraction function
      for (const source of titleSources) {
        const cleanTitle = extractPropertyTitle(source, url);
        if (cleanTitle && cleanTitle !== 'Property for rent in Groningen') {
          propertyTitle = cleanTitle;
          break;
        }
      }
      
      // Fallback: construct from URL
      if (!propertyTitle || propertyTitle === 'Property for rent in Groningen') {
        propertyTitle = extractPropertyTitle(url, url);
      }
    }
    
    // Extract address with enhanced location detection
    if (!propertyAddress) {
      // Try structured data first
      const addressPatterns = [
        /(?:address|adres|locatie|location)["'\s:=]*["']?([^"'<\n\r]+)/i,
        /class=["'][^"']*(?:address|location|adres)[^"']*["'][^>]*>([^<]+)/i,
        /"address"[^}]*"streetAddress":\s*"([^"]+)"/i
      ];
      
      for (const pattern of addressPatterns) {
        const match = detailHtml.match(pattern);
        if (match) {
          propertyAddress = extractText(match[1]);
          if (propertyAddress && propertyAddress.length > 3) {
            if (!propertyAddress.includes('Groningen')) {
              propertyAddress += ', Groningen';
            }
            break;
          }
        }
      }
      
      // Extract from title if address not found
      if (!propertyAddress && propertyTitle) {
        const locationMatch = propertyTitle.match(/in\s+(.+)$/);
        if (locationMatch) {
          propertyAddress = locationMatch[1] + ', Groningen';
        }
      }
    }
    
    // Extract price with comprehensive patterns
    if (!propertyPrice) {
      const pricePatterns = [
        /(?:€|EUR|euro)\s*([\d\.,]+)/i,
        /(?:price|prijs|huur)\s*[:=]\s*€?\s*([\d\.,]+)/i,
        /[\s>]([\d\.,]+)\s*(?:€|euro|per)/i
      ];
      for (const pattern of pricePatterns) {
        const match = detailHtml.match(pattern);
        if (match) {
          const cleanPrice = match[1].replace(/[.,]/g, '');
          if (cleanPrice.length >= 3) { // At least 3 digits for realistic price
            propertyPrice = parseInt(cleanPrice);
            break;
          }
        }
      }
    }
    
    // Extract bedrooms with enhanced patterns
    if (!propertyBedrooms) {
      const bedroomPatterns = [
        /(\d+)\s*(?:bed|slaap|kamer|room|bedroom)s?(?:room)?/i,
        /(?:bed|slaap|kamer|room|bedroom)s?(?:room)?\s*[:=]?\s*(\d+)/i,
        /(\d+)\s*slaapkamer/i,
        /aantal\s*(?:bed|slaap|kamer)\w*\s*[:=]?\s*(\d+)/i
      ];
      for (const pattern of bedroomPatterns) {
        const match = detailHtml.match(pattern);
        if (match) {
          const beds = parseInt(match[1]);
          if (beds >= 1 && beds <= 10) { // Reasonable range
            propertyBedrooms = beds;
            break;
          }
        }
      }
    }
    
    // Extract bathrooms with enhanced patterns  
    if (!propertyBathrooms) {
      const bathroomPatterns = [
        /(\d+)\s*(?:bath|bad|toilet|bathroom)s?(?:room)?/i,
        /(?:bath|bad|toilet|bathroom)s?(?:room)?\s*[:=]?\s*(\d+)/i,
        /(\d+)\s*badkamer/i,
        /aantal\s*(?:bad|bath|toilet)\w*\s*[:=]?\s*(\d+)/i
      ];
      for (const pattern of bathroomPatterns) {
        const match = detailHtml.match(pattern);
        if (match) {
          const baths = parseInt(match[1]);
          if (baths >= 1 && baths <= 5) { // Reasonable range
            propertyBathrooms = baths;
            break;
          }
        }
      }
    }
    
    // Extract surface area with enhanced patterns
    if (!propertySurface) {
      const surfacePatterns = [
        /(\d+(?:\.\d+)?)\s*m[²2]/i,
        /(\d+(?:\.\d+)?)\s*(?:square|vierkante)\s*meter/i,
        /(?:surface|oppervlakte|area|woonoppervlakte)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i,
        /(\d+(?:\.\d+)?)\s*m²/i,
        /grootte\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i
      ];
      for (const pattern of surfacePatterns) {
        const match = detailHtml.match(pattern);
        if (match) {
          const surface = parseFloat(match[1]);
          if (surface >= 10 && surface <= 1000) { // Reasonable range
            propertySurface = surface;
            break;
          }
        }
      }
    }
    
    console.log(`Extracted data for ${url}: title="${propertyTitle}", beds=${propertyBedrooms}, baths=${propertyBathrooms}, surface=${propertySurface}m²`);
    
    // Build clean title from URL segments or address if needed
    if (!propertyTitle || propertyTitle.length < 5) {
      // Try to extract meaningful info from URL
      const urlPath = url.replace(/https?:\/\/[^\/]+\//, '');
      const segments = urlPath.split('/').filter(s => s && s.length > 2 && !s.includes('?') && !s.includes('&'));
      
      // Look for street names in URL segments
      const streetSegment = segments.find(s => {
        const decoded = decodeURIComponent(s).toLowerCase();
        return decoded.includes('straat') || decoded.includes('laan') || 
               decoded.includes('weg') || decoded.includes('plein') ||
               decoded.includes('singel') || decoded.includes('kade');
      });
      
      if (streetSegment) {
        const street = decodeURIComponent(streetSegment).replace(/[-_]/g, ' ');
        propertyTitle = `${typeDefault.charAt(0).toUpperCase() + typeDefault.slice(1)} on ${street}`;
      } else if (propertyAddress && propertyAddress !== 'Groningen, Netherlands') {
        propertyTitle = `${typeDefault.charAt(0).toUpperCase() + typeDefault.slice(1)} in ${propertyAddress}`;
      } else {
        const meaningful = segments.slice(-2).map(s => decodeURIComponent(s).replace(/[-_]/g, ' '));
        propertyTitle = meaningful.join(' ').trim() || `${typeDefault.charAt(0).toUpperCase() + typeDefault.slice(1)} in Groningen`;
      }
    }
    
    // Use the new extraction function to create a clean title
    if (!propertyTitle || propertyTitle.length < 5) {
      propertyTitle = extractPropertyTitle(detailHtml, url);
    } else {
      // Clean existing title using the new function
      propertyTitle = extractPropertyTitle(propertyTitle, url);
    }
    
    const cleanAddress = sanitizeAddress(propertyAddress);
    
    
    // Final validation: reject if title still contains artifacts or is too generic
    if (!propertyTitle || propertyTitle.length < 5 ||
        propertyTitle.includes('?') || propertyTitle.includes('&') || propertyTitle.includes('=') || 
        propertyTitle.toLowerCase().includes('filter') || propertyTitle.toLowerCase().includes('overzicht') ||
        /\b[a-z0-9]{8,}\b/i.test(propertyTitle) ||
        propertyTitle.toLowerCase() === 'property for rent in groningen') {
      console.log(`Rejecting property with invalid title: "${propertyTitle}"`);
      return null;
    }
    
    // Final data processing with improved validation
    const property: Property = {
      external_id: `${source}:${url}`,
      source,
      title: propertyTitle || extractPropertyTitle('', url),
      description: '',
      price: propertyPrice || undefined,
      address: cleanAddress || 'Groningen, Netherlands',
      property_type: typeDefault,
      bedrooms: propertyBedrooms || undefined,
      bathrooms: propertyBathrooms || undefined,
      surface_area: propertySurface || undefined,
      available_from: undefined,
      url,
      image_urls: [],
      features: [],
      city: 'Groningen'
    };
    
    // Validate that we have meaningful data
    if (!property.title || property.title === 'Property for rent in Groningen' || 
        property.title.includes('for rent in ,') || property.title.endsWith('for rent ,')) {
      console.log(`Skipping property with invalid title: "${property.title}"`);
      return null;
    }
    
    console.log(`Final extracted data for ${url}: title="${property.title}", address="${property.address}", price=${property.price}`);
    return property;
    
  } catch (error) {
    console.log(`Error extracting property details for ${url}:`, error);
    return null;
  }
}

// COMMAND 2: Simplified scrapeGeneric function
async function scrapeGeneric(opts: { url: string; source: string; domain?: string; linkPattern: RegExp; typeDefault: string; max?: number }): Promise<Property[]> {
  const { url, source, domain, linkPattern, typeDefault, max = 10 } = opts;
  console.log(`Starting ${source} scraping...`);
  const properties: Property[] = [];
  
  try {
    const resp = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      } 
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const matches = Array.from(html.matchAll(linkPattern));
    const seen = new Set<string>();
    
    console.log(`Found ${matches.length} potential property URLs for ${source}`);
    
    // COMMAND 2: Simplified loop - only call helper and add results
    for (let i = 0; i < matches.length && properties.length < max; i++) {
      const href = matches[i][1];
      if (!href || href.includes('?') || href.includes('&')) continue; // Skip URLs with query parameters
      
      const fullUrl = href.startsWith('http') ? href : `${domain ?? new URL(url).origin}${href}`;
      if (seen.has(fullUrl)) continue; 
      seen.add(fullUrl);
      
      // Call the new helper function for each URL
      const propertyObject = await extractPropertyDetails(fullUrl, source, typeDefault);
      
      // Check the result and add it to the array
      if (propertyObject) {
        properties.push(propertyObject);
        console.log(`Successfully added ${source} property: ${propertyObject.title}`);
      }
    }
    
  } catch (error) {
    console.error(`Error scraping ${source}:`, error);
  }
  
  console.log(`${source} scraping completed. Found ${properties.length} valid properties.`);
  return properties;
}

// COMMAND 4: Fixed CampusGroningen scraper - only match /woning/ URLs
async function scrapeCampusGroningen(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.campusgroningen.nl/en/rentals',
    source: 'campusgroningen',
    linkPattern: /href="(\/woning\/[^"]+)"/g, // COMMAND 4: Only match /woning/ paths
    typeDefault: 'room'
  });
}

// Specific scrapers for each source
async function scrapePararius(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.pararius.nl/huurwoningen/groningen',
    source: 'pararius',
    linkPattern: /href="(\/appartement-te-huur\/groningen\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeKamernet(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://kamernet.nl/en/for-rent/properties-groningen',
    source: 'kamernet',
    domain: 'https://kamernet.nl',
    linkPattern: /href="(\/en\/for-rent\/(?:room|studio|apartment)-groningen\/[^"?&]+)"/g,
    typeDefault: 'room'
  });
}

async function scrapeGrunoverhuur(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.grunoverhuur.nl/woningaanbod',
    source: 'grunoverhuur',
    linkPattern: /href="(\/woningaanbod\/huur\/groningen\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeFunda(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.funda.nl/huur/groningen/',
    source: 'funda',
    linkPattern: /href="(\/huur\/[^"]+\/groningen\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeRotsvast(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.rotsvast.nl/en/rentals/groningen',
    source: 'rotsvast',
    linkPattern: /href="(\/en\/huren\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeExpatRentalHolland(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.expatrentalsholland.com/offer/in/groningen',
    source: 'expatrentalsholland',
    linkPattern: /href="(\/offer\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeVanderMeulen(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.vandermeulen.nl/aanbod/huur',
    source: 'vandermeulen',
    linkPattern: /href="(\/aanbod\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeHousingAnywhere(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://housinganywhere.com/s/Groningen--Netherlands',
    source: 'housinganywhere',
    linkPattern: /href="(\/room\/[^"]+\/nl\/Groningen\/[^"]+)"/g,
    typeDefault: 'room'
  });
}

async function scrapeDCWonen(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.dcwonen.nl/aanbod/',
    source: 'dcwonen',
    linkPattern: /href="(\/aanbod\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeHuure(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://huure.nl/en/rental-properties',
    source: 'huure',
    linkPattern: /href="(\/rental-property\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeMaxxHuren(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.maxxhuren.nl/woningaanbod/',
    source: 'maxxhuren',
    linkPattern: /href="(\/woningaanbod\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeKPMakelaars(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.kpmakelaars.nl/verhuur/',
    source: 'kpmakelaars',
    linkPattern: /href="(\/verhuur\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeHouseHunting(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://househunting.nl/en/rental-properties',
    source: 'househunting',
    linkPattern: /href="(\/property\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapeWoldring(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.woldringverhuur.nl/verhuur/',
    source: 'woldringverhuur',
    linkPattern: /href="(\/verhuur\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrape050Vastgoed(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.050vastgoed.nl/huurwoningen/',
    source: '050vastgoed',
    linkPattern: /href="(\/huurwoning\/[^"]+)"/g,
    typeDefault: 'apartment'
  });
}

async function scrapePandomo(): Promise<Property[]> {
  return await scrapeGeneric({
    url: 'https://www.pandomo.nl/aanbod/',
    source: 'pandomo',
    linkPattern: /href="(\/aanbod\/[^"?&]+)"/g, // Exclude URLs with query parameters
    typeDefault: 'apartment'
  });
}

// Helper functions for parsing
function extractPostalCode(address: string): string | null {
  const match = address.match(/\b\d{4}\s*[A-Z]{2}\b/);
  return match ? match[0] : null;
}

function extractFeatures(html: string): string[] {
  const features = [];
  if (html.includes('balcon') || html.includes('terras')) features.push('Balcony');
  if (html.includes('furnished') || html.includes('gemeubileerd')) features.push('Furnished');
  if (html.includes('garage') || html.includes('parking')) features.push('Parking');
  if (html.includes('garden') || html.includes('tuin')) features.push('Garden');
  return features;
}

// Improved save function with better validation
async function saveProperties(supabase: any, properties: Property[], source: string) {
  console.log(`Saving ${properties.length} properties from ${source}`);
  
  if (properties.length === 0) {
    console.log(`No properties to save for ${source}`);
    return 0;
  }
  
  // Get existing properties to avoid duplicates
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
    // Final validation before saving
    const validProperties = newProperties.filter(p => {
      const hasValidTitle = p.title && p.title.length >= 5 && !p.title.includes('?') && !p.title.includes('&');
      const hasValidUrl = p.url && !p.url.includes('?') && !p.url.includes('&') && p.url.startsWith('http');
      const isNotGeneric = !p.title.toLowerCase().includes('overzicht') && !p.title.toLowerCase().includes('filter');
      
      if (!hasValidTitle || !hasValidUrl || !isNotGeneric) {
        console.log(`Rejecting invalid property: "${p.title}" | ${p.url}`);
        return false;
      }
      return true;
    });
    
    if (validProperties.length > 0) {
      const { error: insertError } = await supabase
        .from('properties')
        .insert(validProperties);
        
      if (insertError) {
        console.error("Error inserting properties:", insertError);
        throw insertError;
      }
      
      console.log(`Successfully saved ${validProperties.length} properties for ${source}`);
    }
    
    return validProperties.length;
  }
  
  return 0;
}

// Main scraping orchestrator
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

    const sources = [
      'pararius', 'kamernet', 'grunoverhuur', 'funda', 'campusgroningen', 
      'rotsvast', 'expatrentalsholland', 'vandermeulen', 'housinganywhere', 
      'dcwonen', 'huure', 'maxxhuren', 'kpmakelaars', 'househunting', 
      'woldringverhuur', '050vastgoed', 'pandomo'
    ];
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
          case 'funda':
            properties = await scrapeFunda();
            break;
          case 'campusgroningen':
            properties = await scrapeCampusGroningen();
            break;
          case 'rotsvast':
            properties = await scrapeRotsvast();
            break;
          case 'expatrentalsholland':
            properties = await scrapeExpatRentalHolland();
            break;
          case 'vandermeulen':
            properties = await scrapeVanderMeulen();
            break;
          case 'housinganywhere':
            properties = await scrapeHousingAnywhere();
            break;
          case 'dcwonen':
            properties = await scrapeDCWonen();
            break;
          case 'huure':
            properties = await scrapeHuure();
            break;
          case 'maxxhuren':
            properties = await scrapeMaxxHuren();
            break;
          case 'kpmakelaars':
            properties = await scrapeKPMakelaars();
            break;
          case 'househunting':
            properties = await scrapeHouseHunting();
            break;
          case 'woldringverhuur':
            properties = await scrapeWoldring();
            break;
          case '050vastgoed':
            properties = await scrape050Vastgoed();
            break;
          case 'pandomo':
            properties = await scrapePandomo();
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