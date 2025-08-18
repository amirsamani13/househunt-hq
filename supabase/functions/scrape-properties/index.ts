import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Property {
  external_id: string;
  source: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  bedrooms?: number;
  bathrooms?: number;
  surface_area?: number;
  address?: string;
  city?: string;
  postal_code?: string;
  property_type?: string;
  url: string;
  image_urls?: string[];
  features?: string[];
  available_from?: string;
}

// Dutch housing website scrapers according to your comprehensive plan
const DUTCH_SCRAPERS = [
  // Phase 1: Major Portals (Highest Priority)
  { name: "Funda", url: "https://www.funda.nl/huur/groningen", source: "funda" },
  { name: "Pararius", url: "https://www.pararius.com/apartments/groningen", source: "pararius" },
  { name: "Kamernet", url: "https://kamernet.nl/huren/kamer-groningen", source: "kamernet" },
  { name: "HousingAnywhere", url: "https://housinganywhere.com/s/Groningen--Netherlands", source: "housinganywhere" },
  
  // Phase 2: Real Estate Agencies
  { name: "Rotsvast", url: "https://www.rotsvast.nl/huren/", source: "rotsvast" },
  { name: "MVGM", url: "https://www.mvgm.nl/woningaanbod", source: "mvgm" },
  
  // Phase 3: Student & Social Housing
  { name: "DUWO", url: "https://www.duwo.nl/aanbod", source: "duwo" },
  { name: "SSH&", url: "https://www.sshn.nl/aanbod", source: "ssh" },
  
  // Phase 4: Specialized Platforms
  { name: "Grunoverhuur", url: "https://www.grunoverhuur.nl/aanbod/huren", source: "grunoverhuur" }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🏠 Starting comprehensive Dutch housing property scraping...');
    
    let totalNew = 0;
    const results: any[] = [];

    // Process each scraper with anti-detection measures
    for (const scraper of DUTCH_SCRAPERS) {
      try {
        console.log(`\n📡 Processing ${scraper.name}...`);
        
        const properties = await scrapeWebsite(scraper);
        
        if (properties.length > 0) {
          console.log(`✅ ${scraper.name} found ${properties.length} properties`);
          
          const { savedCount } = await saveProperties(supabase, properties);
          console.log(`✅ ${scraper.source}: ${savedCount} new properties`);
          
          totalNew += savedCount;
          results.push({ source: scraper.source, total: properties.length, new: savedCount });
        } else {
          console.log(`❌ No properties found for ${scraper.source}`);
          results.push({ source: scraper.source, total: 0, new: 0 });
        }

        // Anti-detection: Random delay between 1-3 seconds
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
      } catch (error) {
        console.error(`❌ Error scraping ${scraper.source}:`, error);
        results.push({ source: scraper.source, error: error.message, total: 0, new: 0 });
      }
    }

    console.log(`🎉 Scraping completed! Total new properties: ${totalNew}`);

    // Log comprehensive scraping session
    await supabase.from('scraping_logs').insert([{
      source: 'comprehensive_dutch_scrapers',
      status: 'completed',
      properties_found: results.reduce((sum, r) => sum + (r.total || 0), 0),
      new_properties: totalNew,
      completed_at: new Date().toISOString()
    }]);

    return new Response(JSON.stringify({
      success: true,
      message: 'Dutch housing scraping completed successfully',
      totalNewProperties: totalNew,
      results,
      scrapedSources: DUTCH_SCRAPERS.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Fatal error in comprehensive scraping function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Modular scraper with anti-detection measures
async function scrapeWebsite(scraper: any): Promise<Property[]> {
  const properties: Property[] = [];
  
  try {
    // Rotate user agents for anti-detection
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];
    
    const response = await fetch(scraper.url, {
      headers: {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch ${scraper.source}: ${response.status}`);
      return properties;
    }

    const html = await response.text();
    console.log(`📄 ${scraper.source} page fetched (${html.length} chars)`);

    // Extract property data using resilient patterns
    const extractedProperties = await extractPropertiesFromHTML(html, scraper);
    properties.push(...extractedProperties);

    console.log(`🎉 ${scraper.source} scraping completed. Found ${properties.length} properties.`);
    return properties;

  } catch (error) {
    console.error(`❌ Error in ${scraper.source} scraper:`, error);
    return properties;
  }
}

// Resilient data extraction with standardization
async function extractPropertiesFromHTML(html: string, scraper: any): Promise<Property[]> {
  const properties: Property[] = [];
  
  try {
    // Generic patterns that work across multiple Dutch housing sites
    const titlePattern = /<h[1-4][^>]*>([^<]*(?:appartement|huis|kamer|studio|woning)[^<]*)<\/h[1-4]>/gi;
    const pricePattern = /€\s*([0-9.,]+)/g;
    const linkPattern = /href="([^"]*(?:huur|rental|property|woning|appartement)[^"]*)"/gi;
    const sizePattern = /(\d+)\s*m²/g;
    const bedroomPattern = /(\d+)\s*(?:slaapkamer|bedroom|kamer)/gi;

    const extractedData = {
      titles: [] as string[],
      prices: [] as number[],
      links: [] as string[],
      sizes: [] as number[],
      bedrooms: [] as number[]
    };

    // Extract all data
    let match;
    while ((match = titlePattern.exec(html)) !== null) {
      extractedData.titles.push(match[1].trim());
    }

    while ((match = pricePattern.exec(html)) !== null) {
      const price = parseFloat(match[1].replace(/[.,]/g, ''));
      if (price > 100 && price < 10000) extractedData.prices.push(price);
    }

    while ((match = linkPattern.exec(html)) !== null) {
      const link = match[1].startsWith('http') ? match[1] : `${new URL(scraper.url).origin}${match[1]}`;
      extractedData.links.push(link);
    }

    while ((match = sizePattern.exec(html)) !== null) {
      extractedData.sizes.push(parseInt(match[1]));
    }

    while ((match = bedroomPattern.exec(html)) !== null) {
      extractedData.bedrooms.push(parseInt(match[1]));
    }

    console.log(`Extracted: ${extractedData.titles.length} titles, ${extractedData.prices.length} prices, ${extractedData.links.length} links`);

    // Create standardized property objects
    const maxProperties = Math.min(extractedData.titles.length, 10); // Limit for performance
    for (let i = 0; i < maxProperties; i++) {
      if (extractedData.titles[i]) {
        const property: Property = {
          external_id: extractedData.links[i] || `${scraper.source}-${i}-${Date.now()}`,
          source: scraper.source,
          title: extractedData.titles[i],
          description: `Property listing from ${scraper.name}`,
          url: extractedData.links[i] || scraper.url,
          city: 'Groningen', // Default for Groningen-focused scraping
          currency: 'EUR'
        };

        if (extractedData.prices[i]) property.price = extractedData.prices[i];
        if (extractedData.sizes[i]) property.surface_area = extractedData.sizes[i];
        if (extractedData.bedrooms[i]) property.bedrooms = extractedData.bedrooms[i];

        console.log(`✅ Created standardized property: ${property.title} - €${property.price || 'N/A'}`);
        properties.push(property);
      }
    }

  } catch (error) {
    console.error('Error extracting properties from HTML:', error);
  }

  return properties;
}

// Optimized database operations with duplicate prevention
async function saveProperties(supabase: any, properties: Property[]): Promise<{ savedCount: number }> {
  if (properties.length === 0) return { savedCount: 0 };

  let savedCount = 0;
  const source = properties[0].source;

  for (const property of properties) {
    try {
      // Efficient duplicate check
      const { data: existing } = await supabase
        .from('properties')
        .select('id')
        .eq('external_id', property.external_id)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase
          .from('properties')
          .insert([property]);

        if (error) {
          console.error(`Error inserting ${property.external_id}:`, error.message);
        } else {
          savedCount++;
        }
      }
    } catch (error) {
      console.error(`Error processing ${property.external_id}:`, error);
    }
  }

  console.log(`${source}: ${savedCount} new, ${properties.length - savedCount} duplicates`);
  return { savedCount };
}