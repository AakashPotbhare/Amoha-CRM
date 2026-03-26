import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find support tasks scheduled in the next 20 minutes that haven't been notified
  const now = new Date();
  const in20 = new Date(now.getTime() + 20 * 60 * 1000);
  const todayStr = now.toISOString().split("T")[0];

  // Get tasks scheduled today with start_time within 20 minutes from now
  const nowTime = now.toTimeString().slice(0, 8); // HH:MM:SS
  const in20Time = in20.toTimeString().slice(0, 8);

  const { data: tasks, error } = await supabase
    .from("support_tasks")
    .select(`
      id, task_type, company_name, interview_round, scheduled_date,
      start_time, support_person_id, created_by,
      candidates(full_name, assigned_to_employee_id)
    `)
    .eq("scheduled_date", todayStr)
    .in("status", ["pending", "in_progress"])
    .in("call_status", ["not_started", "link_sent"])
    .gte("start_time", nowTime)
    .lte("start_time", in20Time);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!tasks || tasks.length === 0) {
    return new Response(JSON.stringify({ message: "No upcoming calls", count: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check which tasks already have a recent reminder notification (within last 25 mins)
  const taskIds = tasks.map((t: any) => t.id);
  const { data: existingNotifs } = await supabase
    .from("notifications")
    .select("support_task_id")
    .in("support_task_id", taskIds)
    .eq("type", "reminder")
    .gte("created_at", new Date(now.getTime() - 25 * 60 * 1000).toISOString());

  const alreadyNotified = new Set((existingNotifs || []).map((n: any) => n.support_task_id));

  const notifications: any[] = [];

  for (const task of tasks as any[]) {
    if (alreadyNotified.has(task.id)) continue;

    const candidateName = task.candidates?.full_name ?? "Unknown";
    const title = `Upcoming ${task.task_type === "interview_support" ? "Interview" : "Call"} in ~20 min`;
    const body = `${candidateName}${task.company_name ? ` — ${task.company_name}` : ""} at ${task.start_time?.slice(0, 5)}`;

    // Notify: support person, recruiter (created_by), and candidate's assigned recruiter (marketing TL proxy)
    const recipients = new Set<string>();
    if (task.support_person_id) recipients.add(task.support_person_id);
    if (task.created_by) recipients.add(task.created_by);
    if (task.candidates?.assigned_to_employee_id) recipients.add(task.candidates.assigned_to_employee_id);

    for (const recipientId of recipients) {
      notifications.push({
        recipient_employee_id: recipientId,
        support_task_id: task.id,
        title,
        body,
        type: "reminder",
      });
    }
  }

  if (notifications.length > 0) {
    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({ message: "Notifications sent", count: notifications.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
