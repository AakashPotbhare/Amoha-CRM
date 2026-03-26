
-- Assign all existing support tasks (willing_for_support = true) to Technical department/team
UPDATE public.support_tasks 
SET 
  assigned_to_department_id = 'd00fcd81-536d-4528-9a86-86b1e3c1ccfd',
  assigned_to_team_id = 'a5890c50-6b05-4aa5-968b-c1e4dbf4deff'
WHERE willing_for_support = true 
  AND assigned_to_department_id IS NULL;
