import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  last_updated_at: string;
  is_active?: boolean;
  currency?: string;
  available_from?: string;
  image_urls?: string[];
  features?: string[];
}

// Helper functions for extracting data from HTML
function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function extractNumber(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function extractPrice(text: string): number | null {
  const match = text.match(/€\s*(\d+(?:[\.,]\d+)*)/);
  if (match) {
    return parseInt(match[1].replace(/[,\.]/g, ''), 10);
  }
  return null;
}

function extractPropertyTitle(html: string, url: string): string {
  // Try multiple title patterns
  const titlePatterns = [
    /<h1[^>]*>([^<]+)/i,
    /<title[^>]*>([^<]+)/i,
    /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i,
    /<meta[^>]*name="title"[^>]*content="([^"]+)"/i
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let title = extractText(match[1]).trim();
      title = title.replace(/^(Te huur:?\s*|For rent:?\s*)/i, '').trim();
      if (title.length > 5) {
        return title;
      }
    }
  }

  // Fallback to URL-based title
  const urlParts = url.split('/');
  const lastPart = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
  return lastPart ? lastPart.replace(/-/g, ' ').replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  ) : 'Property Listing';
}

// Enhanced property detail extraction with strict validation and auto-repair integration
async function extractPropertyDetails(url: string, source: string, typeDefault: string, useCustomSelectors?: any): Promise<Property | null> {
  try {
    console.log(`Fetching individual property data for: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Use custom selectors if provided by auto-repair system
    if (useCustomSelectors?.pricePattern) {
      console.log(`🔧 Using auto-repaired selectors for ${source}`);
    }
    
    // Extract title with fallbacks
    let title = extractPropertyTitle(html, url);
    
    // STRICT validation - reject bad titles immediately
    if (!title || title.includes('_IS_MISSING') || title.length < 3) {
      console.log(`❌ Invalid title: "${title}" for ${url}`);
      return null;
    }
    
    // Extract address with multiple patterns
    let address = '';
    const addressPatterns = [
      /<span[^>]*class="[^"]*address[^"]*"[^>]*>([^<]+)/i,
      /<div[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)/i,
      /<h2[^>]*>([^<]+(?:straat|laan|weg|plein|gracht)[^<]*)/i
    ];
    
    for (const pattern of addressPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        address = extractText(match[1]).trim();
        break;
      }
    }
    
    // Extract price
    let price: number | null = null;
    const priceText = html.match(/€\s*(\d+(?:[\.,]\d+)*)/);
    if (priceText) {
      price = parseInt(priceText[1].replace(/[,\.]/g, ''), 10);
    }
    
    // STRICT price validation
    if (price && (price < 200 || price > 5000)) {
      console.log(`❌ Invalid price: €${price} for ${url}`);
      return null;
    }
    
    // Extract bedrooms/bathrooms with strict validation
    let bedrooms: number | null = null;
    let bathrooms: number | null = null;
    
    const bedroomMatch = html.match(/(\d+)\s*(?:slaap)?kam[e]?r[s]?/i) || html.match(/(\d+)\s*bedroom[s]?/i);
    if (bedroomMatch) {
      bedrooms = parseInt(bedroomMatch[1], 10);
      // STRICT validation
      if (bedrooms > 6 || bedrooms < 1) {
        console.log(`❌ Invalid bedrooms: ${bedrooms} for ${url}`);
        return null;
      }
    }
    
    const bathroomMatch = html.match(/(\d+)\s*badkam[e]?r[s]?/i) || html.match(/(\d+)\s*bathroom[s]?/i);
    if (bathroomMatch) {
      bathrooms = parseInt(bathroomMatch[1], 10);
      // STRICT validation
      if (bathrooms > 4 || bathrooms < 1) {
        console.log(`❌ Invalid bathrooms: ${bathrooms} for ${url}`);
        return null;
      }
    }
    
    // Extract surface area
    let surface_area: number | null = null;
    const surfaceMatch = html.match(/(\d+)\s*m[²2]/i);
    if (surfaceMatch) {
      surface_area = parseInt(surfaceMatch[1], 10);
    }
    
    // Use URL as external_id for proper duplicate detection
    const external_id = url;
    
    const property: Property = {
      id: crypto.randomUUID(),
      external_id,
      source,
      title,
      description: `Property listing from ${source}`,
      price,
      address: address || undefined,
      postal_code: undefined,
      property_type: typeDefault,
      bedrooms,
      bathrooms,
      surface_area,
      city: 'Groningen',
      url,
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      is_active: true,
      currency: 'EUR'
    };
    
    console.log(`✅ Extracted valid property: ${title} - €${price || 'N/A'}`);
    return property;
    
  } catch (error) {
    console.error(`❌ Error extracting property details from ${url}:`, error);
    return null;
  }
}

// Generic scraper function with enhanced error handling
async function scrapeGeneric(opts: {
  url: string;
  source: string;
  domain?: string;
  linkPattern: RegExp;
  typeDefault: string;
  max?: number;
}): Promise<Property[]> {
  const { url, source, linkPattern, typeDefault, max = 20 } = opts;
  
  try {
    console.log(`Starting ${source} scraping...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch ${source} listing page: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    console.log(`📄 ${source} page fetched (${html.length} chars)`);
    
    // Extract property URLs
    const matches = Array.from(html.matchAll(linkPattern));
    console.log(`🔍 Found ${matches.length} potential property URLs for ${source}`);
    
    if (matches.length === 0) {
      console.log(`❌ No ${source} links found`);
      return [];
    }
    
    const uniqueUrls = Array.from(new Set(matches.map(match => match[1]))).slice(0, max);
    console.log(`📋 Processing ${uniqueUrls.length} unique URLs for ${source}`);
    
    const properties: Property[] = [];
    
    for (let i = 0; i < uniqueUrls.length; i++) {
      const link = uniqueUrls[i];
      const fullUrl = link.startsWith('http') ? link : `https://${opts.domain || new URL(url).hostname}${link}`;
      
      console.log(`🔍 ${source}: Processing URL ${i + 1}/${uniqueUrls.length}: ${fullUrl}`);
      
      try {
        const property = await extractPropertyDetails(fullUrl, source, typeDefault);
        
        if (property) {
          properties.push(property);
          console.log(`✅ Added ${source} property: ${property.title}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing ${source} property ${fullUrl}:`, error);
      }
    }
    
    console.log(`🎉 ${source} scraping completed. Found ${properties.length} valid properties.`);
    return properties;
    
  } catch (error) {
    console.error(`❌ Critical error in ${source} scraper:`, error);
    return [];
  }
}

// ENHANCED KAMERNET SCRAPER - Complete rewrite
async function scrapeKamernet(): Promise<Property[]> {
  try {
    console.log('🔍 Starting ENHANCED Kamernet scraper...');
    
    // Try multiple Kamernet URL approaches
    const urls = [
      'https://kamernet.nl/en/for-rent/properties-groningen',
      'https://kamernet.nl/huren/kamer-groningen',
      'https://kamernet.nl/en/for-rent/room-groningen'
    ];
    
    for (const url of urls) {
      console.log(`📡 Trying Kamernet URL: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          console.log(`❌ URL ${url} failed: ${response.status}`);
          continue;
        }
        
        const html = await response.text();
        console.log(`📄 Successfully fetched ${url} (${html.length} chars)`);
        
        // Enhanced link patterns specifically for current Kamernet structure
        const patterns = [
          // New Kamernet patterns from Selenium code
          /href="([^"]*\/room\/[^"]*\/\d+[^"]*)"/gi,
          /href="([^"]*\/kamer\/[^"]*\/\d+[^"]*)"/gi,
          // General property patterns
          /href="(\/en\/for-rent\/[^"]+\/\d+[^"]*)"/gi,
          /href="(\/huren\/kamer-[^"]+\/\d+[^"]*)"/gi,
          // JSON data patterns
          /"url":"([^"]*\/for-rent\/[^"]+)"/gi,
          /"href":"([^"]*\/room\/[^"]+)"/gi
        ];
        
        const foundUrls = new Set<string>();
        
        patterns.forEach((pattern, index) => {
          const matches = Array.from(html.matchAll(pattern));
          console.log(`🔍 Pattern ${index + 1}: Found ${matches.length} matches`);
          matches.forEach(match => {
            const cleanUrl = match[1].split('?')[0]; // Remove query params
            if (!cleanUrl.includes('/page/') && !cleanUrl.includes('/sort/')) {
              foundUrls.add(cleanUrl);
            }
          });
        });
        
        if (foundUrls.size > 0) {
          console.log(`🎯 Found ${foundUrls.size} property URLs from ${url}`);
          
          const properties: Property[] = [];
          
          // Process properties with enhanced error handling
          for (const link of Array.from(foundUrls).slice(0, 15)) {
            try {
              const fullUrl = link.startsWith('http') ? link : `https://kamernet.nl${link}`;
              console.log(`🔍 Processing: ${fullUrl}`);
              
              const property = await extractPropertyDetails(fullUrl, 'kamernet', 'room');
              
              if (!property) {
                console.log(`❌ No data extracted from ${fullUrl}`);
                continue;
              }
              
              // STRICT validation to prevent bad data
              if (property.bedrooms && (property.bedrooms > 6 || property.bedrooms < 1)) {
                console.log(`❌ Invalid bedrooms (${property.bedrooms}) for ${property.title}`);
                continue;
              }
              
              if (property.bathrooms && property.bathrooms > 4) {
                console.log(`❌ Invalid bathrooms (${property.bathrooms}) for ${property.title}`);
                continue;
              }
              
              if (!property.title || property.title.includes('_IS_MISSING') || property.title.length < 5) {
                console.log(`❌ Invalid title: "${property.title}"`);
                continue;
              }
              
              if (property.price && (property.price < 200 || property.price > 5000)) {
                console.log(`❌ Invalid price (€${property.price}) for ${property.title}`);
                continue;
              }
              
              properties.push(property);
              console.log(`✅ Kamernet property added: ${property.title} - €${property.price}`);
              
            } catch (error) {
              console.error(`❌ Error processing ${link}:`, error);
            }
          }
          
          if (properties.length > 0) {
            console.log(`🎉 Kamernet SUCCESS: ${properties.length} valid properties found`);
            return properties;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error with URL ${url}:`, error);
        continue;
      }
    }
    
  // Try multiple Kamernet approaches
  console.log('⚠️ All initial Kamernet URLs failed, trying alternative approaches...');
  
  const alternativeUrls = [
    'https://kamernet.nl/en/for-rent/rooms-groningen',
    'https://kamernet.nl/en/for-rent/room-groningen',
    'https://kamernet.nl/en/huren/kamer-groningen',
    'https://kamernet.nl/huren/kamer-groningen',
    'https://kamernet.nl/en/for-rent/property-groningen'
  ];
  
  const alternativePatterns = [
    /href="(\/en\/for-rent\/room-[^"]+)"/g,
    /href="(\/huren\/kamer-[^"]+)"/g,
    /href="(\/en\/for-rent\/property-[^"]+)"/g,
    /href="(\/for-rent\/[^"]+groningen[^"]+)"/g
  ];
  
  for (let i = 0; i < alternativeUrls.length; i++) {
    try {
      console.log(`🔄 Trying Kamernet alternative URL ${i + 1}: ${alternativeUrls[i]}`);
      
      const response = await fetch(alternativeUrls[i], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      });
      
      if (!response.ok) {
        console.log(`❌ Alternative URL ${i + 1} failed: ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      console.log(`✅ Alternative URL ${i + 1} loaded, content length: ${html.length}`);
      
      // Try all patterns for this URL
      let foundProperties: Property[] = [];
      
      for (const pattern of alternativePatterns) {
        const matches = Array.from(html.matchAll(pattern));
        console.log(`🔍 Pattern found ${matches.length} potential links`);
        
        for (const match of matches.slice(0, 5)) { // Limit to 5 per pattern
          try {
            const fullUrl = match[1].startsWith('http') ? match[1] : `https://kamernet.nl${match[1]}`;
            console.log(`🏠 Extracting from: ${fullUrl}`);
            
            const property = await extractPropertyDetails(fullUrl, 'kamernet', 'room');
            if (property && property.title && property.price && property.url) {
              foundProperties.push(property);
              console.log(`✅ Valid property found: ${property.title} - €${property.price}`);
            }
          } catch (err) {
            console.log(`⚠️ Failed to extract from individual property: ${err}`);
          }
        }
        
        if (foundProperties.length > 0) {
          console.log(`✅ Found ${foundProperties.length} valid Kamernet properties using alternative approach`);
          return foundProperties;
        }
      }
      
    } catch (error) {
      console.log(`❌ Alternative URL ${i + 1} error:`, error);
    }
  }
  
  console.error('❌ All Kamernet approaches failed - no properties found');
  return [];
  
  } catch (error) {
    console.error('❌ CRITICAL Kamernet error:', error);
    return [];
  }
}

async function scrapePararius(): Promise<Property[]> {
  console.log('🏠 Starting Pararius scraper...');
  const urls = [
    'https://www.pararius.nl/huurwoningen/groningen',
    'https://www.pararius.nl/huurwoningen/groningen/0-2500',
    'https://www.pararius.nl/apartement/huren/groningen'
  ];
  
  for (const url of urls) {
    const properties = await scrapeGeneric({
      url,
      source: 'pararius',
      linkPattern: /href="(\/appartement-te-huur\/groningen\/[^"]+)"/g,
      typeDefault: 'apartment'
    });
    if (properties.length > 0) {
      console.log(`✅ Pararius found ${properties.length} properties from ${url}`);
      return properties;
    }
  }
  console.log('⚠️ Pararius: No properties found from any URL');
  return [];
}

async function scrapeGrunoverhuur(): Promise<Property[]> {
  console.log('🏠 Starting Grunoverhuur scraper...');
  const urls = [
    'https://www.grunoverhuur.nl/woningaanbod',
    'https://www.grunoverhuur.nl/woningaanbod/huur/groningen',
    'https://www.grunoverhuur.nl/aanbod'
  ];
  
  for (const url of urls) {
    const properties = await scrapeGeneric({
      url,
      source: 'grunoverhuur',
      linkPattern: /href="(\/woningaanbod\/huur\/groningen\/[^"]+)"/g,
      typeDefault: 'apartment'
    });
    if (properties.length > 0) {
      console.log(`✅ Grunoverhuur found ${properties.length} properties from ${url}`);
      return properties;
    }
  }
  console.log('⚠️ Grunoverhuur: No properties found from any URL');
  return [];
}

async function scrapeFunda(): Promise<Property[]> {
  console.log('🏠 Starting Funda scraper...');
  const urls = [
    'https://www.funda.nl/huur/groningen/',
    'https://www.funda.nl/huur/heel-nederland/groningen/',
    'https://www.funda.nl/zoeken/huur?selected_area=["groningen"]',
    'https://www.funda.nl/huur/groningen/0-2500/'
  ];
  
  const patterns = [
    /href="(\/huur\/[^"]+\/groningen\/[^"]+)"/g,
    /href="(\/huur\/groningen\/[^"]+)"/g,
    /data-object-url-base="([^"]*huur[^"]*groningen[^"]*)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'funda',
        linkPattern,
        typeDefault: 'apartment'
      });
      if (properties.length > 0) {
        console.log(`✅ Funda found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Funda: No properties found from any URL/pattern');
  return [];
}

async function scrapeCampusGroningen(): Promise<Property[]> {
  console.log('🏠 Starting Campus Groningen scraper...');
  const urls = [
    'https://www.campusgroningen.nl/aanbod/huren',
    'https://www.campusgroningen.nl/aanbod',
    'https://campusgroningen.nl/aanbod/huren',
    'https://www.campusgroningen.nl/woningen'
  ];
  
  const patterns = [
    /href="(\/[^"]*woning[^"]+)"/g,
    /href="(\/aanbod\/[^"]+)"/g,
    /href="(\/property\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      try {
        const properties = await scrapeGeneric({
          url,
          source: 'campusgroningen',
          linkPattern,
          typeDefault: 'room'
        });
        if (properties.length > 0) {
          console.log(`✅ Campus Groningen found ${properties.length} properties from ${url}`);
          return properties;
        }
      } catch (error) {
        console.log(`⚠️ Campus Groningen failed ${url}: ${error.message}`);
      }
    }
  }
  console.log('⚠️ Campus Groningen: No properties found from any URL/pattern');
  return [];
}

async function scrapeRotsvast(): Promise<Property[]> {
  console.log('🏠 Starting Rotsvast scraper...');
  const urls = [
    'https://www.rotsvast.nl/aanbod/huur',
    'https://www.rotsvast.nl/woningaanbod/huur',
    'https://rotsvast.nl/aanbod/huur/groningen'
  ];
  
  const patterns = [
    /href="([^"]*\/huren\/[^"]+)"/g,
    /href="([^"]*\/aanbod\/[^"]*groningen[^"]*)"/g,
    /href="([^"]*\/property\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'rotsvast',
        linkPattern,
        typeDefault: 'apartment'
      });
      if (properties.length > 0) {
        console.log(`✅ Rotsvast found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Rotsvast: No properties found from any URL/pattern');
  return [];
}

async function scrapeExpatRentalHolland(): Promise<Property[]> {
  console.log('🏠 Starting Expat Rental Holland scraper...');
  const urls = [
    'https://www.expatrentalsholland.com/groningen',
    'https://expatrentalsholland.com/properties/groningen',
    'https://www.expatrentalsholland.com/properties?city=groningen'
  ];
  
  const patterns = [
    /href="(\/offer\/[^"]+)"/g,
    /href="(\/properties\/[^"]*groningen[^"]*)"/g,
    /href="(\/rental\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'expatrentalsholland',
        linkPattern,
        typeDefault: 'apartment'
      });
      if (properties.length > 0) {
        console.log(`✅ Expat Rental Holland found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Expat Rental Holland: No properties found from any URL/pattern');
  return [];
}

async function scrapeVanderMeulen(): Promise<Property[]> {
  console.log('🏠 Starting Van der Meulen scraper...');
  const urls = [
    'https://www.vandermeulen.nl/woningaanbod',
    'https://www.vandermeulen.nl/huur',
    'https://vandermeulen.nl/woningaanbod/huur'
  ];
  
  const patterns = [
    /href="([^"]*woningaanbod[^"]+)"/g,
    /href="([^"]*\/huur\/[^"]+)"/g,
    /href="([^"]*\/property\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'vandermeulen',
        linkPattern,
        typeDefault: 'apartment'
      });
      if (properties.length > 0) {
        console.log(`✅ Van der Meulen found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Van der Meulen: No properties found from any URL/pattern');
  return [];
}

async function scrapeHousingAnywhere(): Promise<Property[]> {
  console.log('🏠 Starting Housing Anywhere scraper...');
  const currentDate = new Date().toISOString().split('T')[0];
  const urls = [
    `https://housinganywhere.com/s/Groningen--Netherlands?moveInDate=${currentDate}`,
    'https://housinganywhere.com/s/Groningen--Netherlands',
    'https://housinganywhere.com/nl/s/Groningen--Nederland',
    'https://housinganywhere.com/rooms/groningen'
  ];
  
  const patterns = [
    /href="(\/room\/[^"]+groningen[^"]*)"/gi,
    /href="(\/room\/[\w-]+)"/g,
    /href="(\/property\/[^"]*groningen[^"]*)"/gi,
    /"url":"([^"]*\/room\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'housinganywhere',
        linkPattern,
        typeDefault: 'room'
      });
      if (properties.length > 0) {
        console.log(`✅ Housing Anywhere found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Housing Anywhere: No properties found from any URL/pattern');
  return [];
}

async function scrapeStudentHousing(): Promise<Property[]> {
  console.log('🏠 Starting Student Housing scraper...');
  const urls = [
    'https://www.student-housing.com/EN/student-housing/netherlands/groningen',
    'https://student-housing.com/EN/groningen',
    'https://www.student-housing.com/NL/studentenkamers/nederland/groningen'
  ];
  
  const patterns = [
    /href="([^"]*\/student-housing\/[^"]+)"/g,
    /href="([^"]*\/groningen\/[^"]+)"/g,
    /href="([^"]*\/room\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'studenthousing',
        linkPattern,
        typeDefault: 'room'
      });
      if (properties.length > 0) {
        console.log(`✅ Student Housing found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Student Housing: No properties found from any URL/pattern');
  return [];
}

async function scrapeRoomspot(): Promise<Property[]> {
  console.log('🏠 Starting Roomspot scraper...');
  const urls = [
    'https://www.roomspot.nl/groningen',
    'https://roomspot.nl/kamers/groningen',
    'https://www.roomspot.nl/kamers-groningen'
  ];
  
  const patterns = [
    /href="([^"]*\/room\/[^"]+)"/g,
    /href="([^"]*\/kamer\/[^"]+)"/g,
    /href="([^"]*\/groningen\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'roomspot',
        linkPattern,
        typeDefault: 'room'
      });
      if (properties.length > 0) {
        console.log(`✅ Roomspot found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Roomspot: No properties found from any URL/pattern');
  return [];
}

async function scrapeRentberry(): Promise<Property[]> {
  console.log('🏠 Starting Rentberry scraper...');
  const urls = [
    'https://rentberry.com/s/groningen',
    'https://www.rentberry.com/apartment-rentals/groningen',
    'https://rentberry.com/apartment-rentals/netherlands/groningen'
  ];
  
  const patterns = [
    /href="([^"]*\/apartment\/[^"]+)"/g,
    /href="([^"]*\/rental\/[^"]*groningen[^"]*)"/gi,
    /href="([^"]*\/property\/[^"]+)"/g
  ];
  
  for (const url of urls) {
    for (const linkPattern of patterns) {
      const properties = await scrapeGeneric({
        url,
        source: 'rentberry',
        linkPattern,
        typeDefault: 'apartment'
      });
      if (properties.length > 0) {
        console.log(`✅ Rentberry found ${properties.length} properties from ${url}`);
        return properties;
      }
    }
  }
  console.log('⚠️ Rentberry: No properties found from any URL/pattern');
  return [];
}

// Property saving with enhanced validation
async function saveProperties(supabase: any, properties: Property[], source: string) {
  if (!properties || properties.length === 0) {
    console.log(`No properties to save for ${source}`);
    return { newProperties: 0, duplicates: 0 };
  }
  
  console.log(`Saving ${properties.length} properties from ${source}`);
  
  let newProperties = 0;
  let duplicates = 0;
  
  for (const property of properties) {
    try {
      // FINAL validation before saving
      if (!property.title || property.title.includes('_IS_MISSING') || property.title.length < 3) {
        console.log(`❌ Rejecting property with invalid title: "${property.title}"`);
        continue;
      }
      
      if (property.bedrooms && (property.bedrooms > 6 || property.bedrooms < 1)) {
        console.log(`❌ Rejecting property with invalid bedrooms: ${property.bedrooms}`);
        continue;
      }
      
      if (property.bathrooms && property.bathrooms > 4) {
        console.log(`❌ Rejecting property with invalid bathrooms: ${property.bathrooms}`);
        continue;
      }
      
      if (property.price && (property.price < 200 || property.price > 5000)) {
        console.log(`❌ Rejecting property with invalid price: €${property.price}`);
        continue;
      }
      
      // Check for existing property
      const { data: existing } = await supabase
        .from('properties')
        .select('id')
        .eq('external_id', property.external_id)
        .limit(1);
      
      if (existing && existing.length > 0) {
        duplicates++;
        continue;
      }
      
      // Insert new property
      const { error } = await supabase
        .from('properties')
        .insert(property);
      
      if (error) {
        console.error(`❌ Error saving property ${property.title}:`, error);
      } else {
        newProperties++;
        console.log(`✅ Saved new property: ${property.title}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing property ${property.title}:`, error);
    }
  }
  
  console.log(`${source}: ${newProperties} new, ${duplicates} duplicates`);
  return { newProperties, duplicates };
}

// Main scraping function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting comprehensive property scraping...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sources = [
      { name: 'pararius', scraper: scrapePararius },
      { name: 'kamernet', scraper: scrapeKamernet },
      { name: 'grunoverhuur', scraper: scrapeGrunoverhuur },
      { name: 'funda', scraper: scrapeFunda },
      { name: 'campusgroningen', scraper: scrapeCampusGroningen },
      { name: 'rotsvast', scraper: scrapeRotsvast },
      { name: 'expatrentalsholland', scraper: scrapeExpatRentalHolland },
      { name: 'vandermeulen', scraper: scrapeVanderMeulen },
      { name: 'housinganywhere', scraper: scrapeHousingAnywhere },
      { name: 'studenthousing', scraper: scrapeStudentHousing },
      { name: 'roomspot', scraper: scrapeRoomspot },
      { name: 'rentberry', scraper: scrapeRentberry }
    ];

    const results: Record<string, any> = {};
    let totalNewProperties = 0;

    for (const { name, scraper } of sources) {
      try {
        console.log(`\n📡 Processing ${name}...`);
        
        // STEP 1: Check if auto-repair is needed for this scraper
        const { data: healthData } = await supabase
          .from('scraper_health')
          .select('*')
          .eq('source', name)
          .single();

        let shouldAttemptRepair = false;
        if (healthData && healthData.repair_status === 'needs_repair') {
          console.log(`🔧 ${name} needs repair, attempting auto-repair...`);
          shouldAttemptRepair = true;
          
          // Call auto-repair function
          try {
            const repairResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-repair-scraper`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ source: name, action: 'repair' })
            });
            
            if (repairResponse.ok) {
              const repairResult = await repairResponse.json();
              if (repairResult.success) {
                console.log(`✅ Auto-repair succeeded for ${name}`);
                
                // Update health status
                await supabase
                  .from('scraper_health')
                  .update({
                    repair_status: 'repaired',
                    last_successful_run: new Date().toISOString(),
                    consecutive_failures: 0,
                    consecutive_hours_zero_properties: 0,
                    updated_at: new Date().toISOString()
                  })
                  .eq('source', name);
              } else {
                console.log(`❌ Auto-repair failed for ${name}: ${repairResult.error}`);
              }
            }
          } catch (repairError) {
            console.log(`❌ Auto-repair error for ${name}:`, repairError);
          }
        }
        
        // Log scraping attempt - use valid status values
        const { data: logData, error: logError } = await supabase
          .from('scraping_logs')
          .insert({
            source: name,
            status: 'running',
            properties_found: 0,
            new_properties: 0,
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        const logId = logData?.id;
        
        // STEP 2: Run the scraper (potentially with repaired configuration)
        const properties = await scraper();
        const { newProperties, duplicates } = await saveProperties(supabase, properties, name);
        
        totalNewProperties += newProperties;
        
        // STEP 3: Update health tracking based on results
        const isHealthy = newProperties > 0 || properties.length > 0;
        
        await supabase
          .from('scraper_health')
          .update({
            last_successful_run: isHealthy ? new Date().toISOString() : healthData?.last_successful_run,
            last_failure_run: !isHealthy ? new Date().toISOString() : healthData?.last_failure_run,
            consecutive_failures: isHealthy ? 0 : (healthData?.consecutive_failures || 0) + 1,
            consecutive_hours_zero_properties: newProperties === 0 ? (healthData?.consecutive_hours_zero_properties || 0) + 1 : 0,
            repair_status: isHealthy ? 'healthy' : 
                          (healthData?.consecutive_hours_zero_properties || 0) >= 2 ? 'needs_repair' : 
                          healthData?.repair_status || 'healthy',
            updated_at: new Date().toISOString()
          })
          .eq('source', name);
        
        results[name] = {
          success: true,
          total_found: properties.length,
          new_properties: newProperties,
          duplicates: duplicates,
          auto_repaired: shouldAttemptRepair,
          health_status: isHealthy ? 'healthy' : 'unhealthy'
        };
        
        // Update log with correct status value
        if (logId) {
          await supabase
            .from('scraping_logs')
            .update({
              status: 'success',
              properties_found: properties.length,
              new_properties: newProperties,
              completed_at: new Date().toISOString()
            })
            .eq('id', logId);
        }
        
        console.log(`✅ ${name}: ${newProperties} new properties`);
        
      } catch (error) {
        console.error(`❌ Error scraping ${name}:`, error);
        
        // Update health tracking for failures
        await supabase
          .from('scraper_health')
          .update({
            last_failure_run: new Date().toISOString(),
            consecutive_failures: (healthData?.consecutive_failures || 0) + 1,
            repair_status: (healthData?.consecutive_failures || 0) >= 2 ? 'needs_repair' : healthData?.repair_status || 'healthy',
            updated_at: new Date().toISOString()
          })
          .eq('source', name);
        
        // Update log with error status
        if (logId) {
          await supabase
            .from('scraping_logs')
            .update({
              status: 'error',
              error_message: error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', logId);
        }
        
        results[name] = {
          success: false,
          error: error.message,
          total_found: 0,
          new_properties: 0,
          health_status: 'error'
        };
      }
    }

    console.log(`🎉 Scraping completed! Total new properties: ${totalNewProperties}`);

    return new Response(JSON.stringify({
      success: true,
      totalNewProperties,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Critical scraping error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});