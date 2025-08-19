import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Setting up scraper cron job...');

    // Create cron job to run scraper every 10 minutes
    const { data, error } = await supabase.rpc('cron_schedule', {
      job_name: 'comprehensive-dutch-housing-scraper',
      schedule: '*/10 * * * *', // Every 10 minutes
      sql_command: `
        SELECT
          net.http_post(
            url := 'https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/scrape-properties',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}'::jsonb,
            body := '{"automated": true}'::jsonb
          ) as request_id;
      `
    });

    if (error) {
      console.error('Error setting up cron job:', error);
      throw error;
    }

    console.log('✅ Cron job created successfully');

    // Also create a notification processing cron job every 2 minutes
    const { data: notificationData, error: notificationError } = await supabase.rpc('cron_schedule', {
      job_name: 'process-pending-notifications',
      schedule: '*/2 * * * *', // Every 2 minutes
      sql_command: `
        SELECT
          net.http_post(
            url := 'https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/send-notifications',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}'::jsonb,
            body := '{"processPending": true}'::jsonb
          ) as request_id;
      `
    });

    if (notificationError) {
      console.error('Error setting up notification cron job:', notificationError);
      throw notificationError;
    }

    console.log('✅ Notification processing cron job created successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Cron jobs set up successfully',
      scraper_schedule: 'Every 10 minutes',
      notification_schedule: 'Every 2 minutes',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error setting up cron jobs:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});