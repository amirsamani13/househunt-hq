import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const ADMIN_EMAIL = 'amirsamani13@gmail.com'; // Replace with your admin email

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('📧 QA Admin Alerts handler started');

    const { alert_id } = await req.json();

    let alerts;
    
    if (alert_id === 'latest') {
      // Get the latest unsent alert
      const { data, error } = await supabase
        .from('qa_admin_alerts')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(`Failed to fetch latest alert: ${error.message}`);
      }

      alerts = data;
    } else if (alert_id) {
      // Get specific alert
      const { data, error } = await supabase
        .from('qa_admin_alerts')
        .select('*')
        .eq('id', alert_id)
        .eq('status', 'pending');

      if (error) {
        throw new Error(`Failed to fetch alert: ${error.message}`);
      }

      alerts = data;
    } else {
      // Get all pending alerts
      const { data, error } = await supabase
        .from('qa_admin_alerts')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(`Failed to fetch pending alerts: ${error.message}`);
      }

      alerts = data;
    }

    if (!alerts || alerts.length === 0) {
      console.log('No pending alerts to send');
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending alerts'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    let sentCount = 0;
    let errors = [];

    for (const alert of alerts) {
      try {
        console.log(`📧 Sending admin alert: ${alert.title}`);

        const emailSubject = `🚨 QA Alert: ${alert.title}`;
        const emailBody = generateEmailHTML(alert);

        const { error: emailError } = await resend.emails.send({
          from: Deno.env.get('RESEND_FROM_EMAIL') || 'QA System <noreply@lovable.app>',
          to: [ADMIN_EMAIL],
          subject: emailSubject,
          html: emailBody
        });

        if (emailError) {
          console.error(`Failed to send email for alert ${alert.id}:`, emailError);
          errors.push({
            alert_id: alert.id,
            error: emailError.message
          });
          continue;
        }

        // Mark alert as sent
        await supabase
          .from('qa_admin_alerts')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', alert.id);

        sentCount++;
        console.log(`✅ Alert sent successfully: ${alert.id}`);

      } catch (error: any) {
        console.error(`Error sending alert ${alert.id}:`, error);
        errors.push({
          alert_id: alert.id,
          error: error.message
        });
      }
    }

    console.log(`📧 Admin alerts completed: ${sentCount} sent, ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      sent_count: sentCount,
      errors: errors
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('❌ QA Admin Alerts error:', error);

    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

function generateEmailHTML(alert: any): string {
  const severityColors = {
    warning: '#f59e0b',
    critical: '#ef4444',
    emergency: '#dc2626'
  };

  const severityColor = severityColors[alert.severity as keyof typeof severityColors] || '#6b7280';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>QA Alert: ${alert.title}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background-color: ${severityColor};
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 30px;
        }
        .severity-badge {
          display: inline-block;
          background-color: ${severityColor};
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .details {
          background-color: #f8f9fa;
          border-left: 4px solid ${severityColor};
          padding: 15px;
          margin: 20px 0;
          border-radius: 0 4px 4px 0;
        }
        .details h4 {
          margin-top: 0;
          color: ${severityColor};
        }
        .timestamp {
          color: #666;
          font-size: 14px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .actions {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .btn {
          display: inline-block;
          background-color: ${severityColor};
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          margin-right: 10px;
        }
        .btn:hover {
          opacity: 0.9;
        }
        pre {
          background-color: #f1f3f4;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
          border: 1px solid #e1e5e9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 QA System Alert</h1>
          <p>Automated Quality Control System</p>
        </div>
        
        <div class="content">
          <div class="severity-badge">${alert.severity}</div>
          
          <h2>${alert.title}</h2>
          
          <p><strong>Alert Type:</strong> ${alert.alert_type}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          
          ${alert.details ? `
            <div class="details">
              <h4>📊 Technical Details</h4>
              <pre>${JSON.stringify(alert.details, null, 2)}</pre>
            </div>
          ` : ''}
          
          <div class="actions">
            <a href="https://supabase.com/dashboard/project/oxdneiaojgwezxltivcl/logs/explorer" class="btn">
              View Logs
            </a>
            <a href="https://supabase.com/dashboard/project/oxdneiaojgwezxltivcl/editor" class="btn">
              Database Editor
            </a>
          </div>
          
          <div class="timestamp">
            <strong>Alert ID:</strong> ${alert.id}<br>
            <strong>Created:</strong> ${new Date(alert.created_at).toLocaleString()}<br>
            <strong>Test Run:</strong> ${alert.test_run_id || 'N/A'}
          </div>
        </div>
      </div>
      
      <p style="text-align: center; color: #666; margin-top: 20px; font-size: 12px;">
        This is an automated alert from your QA Continuous Agent system.<br>
        To resolve this alert, mark it as resolved in the qa_admin_alerts table.
      </p>
    </body>
    </html>
  `;
}

serve(serve_handler);