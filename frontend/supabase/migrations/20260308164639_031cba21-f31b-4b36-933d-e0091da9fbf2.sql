
-- Create Technical Team Lead employee (user_id will be linked after signup)
INSERT INTO public.employees (employee_code, full_name, email, department_id, team_id, role, user_id)
VALUES (
  'ARS202307',
  'Ravi Shankar',
  'ravi.shankar@amoha.test',
  'd00fcd81-536d-4528-9a86-86b1e3c1ccfd',
  'a5890c50-6b05-4aa5-968b-c1e4dbf4deff',
  'team_lead',
  NULL
);
