import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "Property Alerts <onboarding@resend.dev>";

interface TestEmailBody {
  to?: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { to }: TestEmailBody = await req.json();
    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to' email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const subject = "Test: Property Alerts Email (Resend)";
    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;line-height:1.6">
        <h2>✅ Resend email test successful</h2>
        <p>This is a one-time test email sent from the send-test-email edge function.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p>If you received this, your RESEND_API_KEY is configured correctly.</p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: RESEND_FROM,
      to: [to],
      subject,
      html,
    });

    console.log("send-test-email: emailResponse", emailResponse);

    return new Response(JSON.stringify({ ok: true, to, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-test-email error", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
