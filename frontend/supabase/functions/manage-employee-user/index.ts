import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is HR/director/ops_head
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerEmployee } = await supabase
      .from("employees")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("is_active", true)
      .single();

    if (!callerEmployee || !["hr", "director", "ops_head"].includes(callerEmployee.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: HR access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create_user") {
      const { email, password, employee_id } = body;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: password || "Amoha@2026",
        email_confirm: true,
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Link auth user to employee
      if (employee_id && authData.user) {
        await supabase
          .from("employees")
          .update({ user_id: authData.user.id })
          .eq("id", employee_id);
      }

      return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "setup_admin") {
      const { email, password, employee_code } = body;

      // Check if employee already exists
      const { data: existing } = await supabase
        .from("employees")
        .select("id, user_id")
        .eq("employee_code", employee_code)
        .single();

      if (existing?.user_id) {
        return new Response(JSON.stringify({ success: true, message: "Admin already set up" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (existing) {
        // Link to existing employee
        await supabase.from("employees").update({ user_id: authData.user.id }).eq("id", existing.id);
      }

      return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
